package fr.lescreationsdeyona.message;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Reads a page of the web for the preview of a link, as a messaging app does. The address comes from
 * an admin's message: only http(s) on the usual ports, and only to public addresses, each redirect
 * checked again, so that a link cannot make the server read itself or its network (the database, the
 * storage, a router). A few seconds and a few megabytes at most; no cookie, nothing about the site sent.
 */
@Component
class LinkFetcher {

	private static final Duration CONNECT = Duration.ofSeconds(4);

	/** The whole answer, its body included. */
	private static final long DEADLINE_MS = 8_000;

	private static final int MAX_REDIRECTS = 4;

	/** Neutral: the server reads the page on its own, for nobody to recognize. */
	private static final String USER_AGENT = "Mozilla/5.0 (compatible; LinkPreview/1.0)";

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(CONNECT).followRedirects(HttpClient.Redirect.NEVER).build();

	/** What a page answered: where it was in the end (after redirects), its type and its first bytes. */
	record Fetched(URI uri, @Nullable String contentType, byte[] body) {
	}

	/** {@code maxBytes}: what is read of the body at most, the rest left unread. */
	Fetched fetch(URI uri, String accept, int maxBytes) throws IOException, InterruptedException {
		URI current = uri;
		for (int redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
			requirePublic(current);
			HttpRequest request = HttpRequest.newBuilder(current)
				.timeout(Duration.ofMillis(DEADLINE_MS))
				.header("User-Agent", USER_AGENT)
				.header("Accept", accept)
				.header("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.5")
				.GET()
				.build();
			CompletableFuture<HttpResponse<byte[]>> answer = http.sendAsync(request, info -> new FirstBytes(maxBytes));
			HttpResponse<byte[]> response;
			try {
				response = answer.get(DEADLINE_MS, TimeUnit.MILLISECONDS);
			}
			catch (TimeoutException ex) {
				answer.cancel(true);
				throw new IOException("No answer in time from " + current.getHost(), ex);
			}
			catch (ExecutionException ex) {
				throw new IOException("No answer from " + current.getHost(), ex.getCause());
			}
			int status = response.statusCode();
			if (status >= 300 && status < 400) {
				String location = response.headers().firstValue("location").orElseThrow(() -> new IOException("Redirect without a location"));
				current = current.resolve(location.strip().replace(" ", "%20"));
				continue;
			}
			if (status != 200) {
				throw new IOException(current.getHost() + " answered " + status);
			}
			return new Fetched(current, response.headers().firstValue("content-type").orElse(null), response.body());
		}
		throw new IOException("Too many redirects");
	}

	/** http or https, the usual port, no login in the address, and a name that leads to public addresses only. */
	static void requirePublic(URI uri) throws IOException {
		String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
		if (!scheme.equals("http") && !scheme.equals("https")) {
			throw new IOException("Not a web address");
		}
		int port = uri.getPort();
		if (uri.getHost() == null || uri.getRawUserInfo() != null || (port != -1 && port != 80 && port != 443)) {
			throw new IOException("Not an address to read");
		}
		for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
			if (!isPublic(address)) {
				throw new IOException("Not a public address: " + uri.getHost());
			}
		}
	}

	/** Neither this machine, nor a private network, nor a reserved range. */
	static boolean isPublic(InetAddress address) {
		if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() || address.isSiteLocalAddress()
				|| address.isMulticastAddress()) {
			return false;
		}
		byte[] bytes = address.getAddress();
		if (address instanceof Inet4Address) {
			return isPublicV4(bytes, 0);
		}
		if (address instanceof Inet6Address) {
			// fc00::/7 (unique local), and IPv4 written in IPv6: ::ffff:a.b.c.d, ::a.b.c.d, 64:ff9b::a.b.c.d (NAT64)
			if ((bytes[0] & 0xfe) == 0xfc) {
				return false;
			}
			boolean zeros = true;
			for (int i = 0; i < 10; i++) {
				zeros &= bytes[i] == 0;
			}
			boolean mapped = zeros && ((bytes[10] == (byte) 0xff && bytes[11] == (byte) 0xff) || (bytes[10] == 0 && bytes[11] == 0));
			boolean nat64 = bytes[0] == 0 && bytes[1] == 0x64 && bytes[2] == (byte) 0xff && bytes[3] == (byte) 0x9b;
			return !(mapped || nat64) || isPublicV4(bytes, 12);
		}
		return false;
	}

	private static boolean isPublicV4(byte[] bytes, int from) {
		int a = bytes[from] & 0xff;
		int b = bytes[from + 1] & 0xff;
		int c = bytes[from + 2] & 0xff;
		return !(a == 0 || a == 10 || a == 127 || a >= 224 // this network, private, loopback, multicast and reserved
				|| (a == 100 && b >= 64 && b <= 127) // shared address space (carrier NAT)
				|| (a == 169 && b == 254) // link-local
				|| (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168) // private
				|| (a == 192 && b == 0 && (c == 0 || c == 2)) || (a == 198 && (b == 18 || b == 19)) // IETF, documentation, benchmarks
				|| (a == 198 && b == 51 && c == 100) || (a == 203 && b == 0 && c == 113));
	}

	/** The body up to {@code max} bytes; the rest is not read. */
	private static final class FirstBytes implements HttpResponse.BodySubscriber<byte[]> {

		private final int max;

		private final ByteArrayOutputStream read = new ByteArrayOutputStream();

		private final CompletableFuture<byte[]> body = new CompletableFuture<>();

		private Flow.@Nullable Subscription subscription;

		FirstBytes(int max) {
			this.max = max;
		}

		@Override
		public void onSubscribe(Flow.Subscription subscription) {
			this.subscription = subscription;
			subscription.request(1);
		}

		@Override
		public void onNext(List<ByteBuffer> buffers) {
			for (ByteBuffer buffer : buffers) {
				int length = Math.min(buffer.remaining(), max - read.size());
				byte[] bytes = new byte[length];
				buffer.get(bytes);
				read.write(bytes, 0, length);
			}
			if (read.size() >= max) {
				body.complete(read.toByteArray());
				if (subscription != null) {
					subscription.cancel();
				}
			}
			else if (subscription != null) {
				subscription.request(1);
			}
		}

		@Override
		public void onError(Throwable error) {
			body.completeExceptionally(error);
		}

		@Override
		public void onComplete() {
			body.complete(read.toByteArray());
		}

		@Override
		public CompletionStage<byte[]> getBody() {
			return body;
		}

	}

}
