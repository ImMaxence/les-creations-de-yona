package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.media.Schema;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The counters of the whole server (2.21), which only ever grow: processor time ({@code /proc/stat},
 * the same in every container), bytes of its network card (its {@code /proc/1/net}, mounted by Compose),
 * and bytes the gateway sent and received for the site (Caddy's metrics). Two readings give the load,
 * the estimated draw and the traffic between them: the live curves read them every few seconds, the
 * history every 10 minutes.
 */
@Component
class MachineCounters {

	private static final Logger log = LoggerFactory.getLogger(MachineCounters.class);

	/** Two readings closer than this give nothing new: the last rates are given again. */
	private static final Duration TOO_CLOSE = Duration.ofMillis(500);

	/** ServerRates averaged over more than this would not say much about "now". */
	private static final Duration TOO_FAR = Duration.ofMinutes(15);

	/** The gateway did not answer: left alone that long (a backend run outside Docker has no gateway). */
	private static final Duration GATEWAY_PAUSE = Duration.ofMinutes(1);

	private static final Pattern METRIC = Pattern.compile(
			"^caddy_http_(request|response)_size_bytes_(sum|count)\\{([^}]*)}\\s+(\\S+)", Pattern.MULTILINE);

	private static final Pattern LABEL = Pattern.compile("(\\w+)=\"((?:[^\"\\\\]|\\\\.)*)\"");

	/** Processor time since the server started, in ticks: all of it, and the part spent waiting. */
	record CpuTicks(long total, long idle) {
	}

	/** Bytes since the counter started. */
	record Traffic(long received, long sent) {
	}

	/** {@code at}: {@link System#nanoTime()}. */
	record Reading(long at, @Nullable CpuTicks cpu, @Nullable Traffic host, @Nullable Traffic site) {
	}

	/** Between two readings; absent what could not be read. */
	record ServerRates(
			@Schema(description = "Share of the processors of the whole server in use, from 0 to 1") @Nullable Double load,
			@Schema(description = "Estimated draw of the server, in watts") @Nullable Double watts,
			@Schema(description = "Bytes per second the network card of the server received") @Nullable Double hostReceived,
			@Nullable Double hostSent,
			@Schema(description = "Bytes per second the site (its gateway) received from the visitors") @Nullable Double siteReceived,
			@Nullable Double siteSent) {

		static final ServerRates UNKNOWN = new ServerRates(null, null, null, null, null, null);
	}

	/** A reading, and the rates since the previous one. */
	record Measure(Reading reading, ServerRates rates) {
	}

	private final MachineProperties properties;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();

	private @Nullable Reading previous;

	private ServerRates lastRates = ServerRates.UNKNOWN;

	private long gatewayPausedUntil;

	MachineCounters(MachineProperties properties) {
		this.properties = properties;
	}

	/** Reads the counters now; the rates since the previous call (live curves, page, history). */
	synchronized Measure measure() {
		Reading now = read();
		Reading before = previous;
		if (before != null && now.at() - before.at() < TOO_CLOSE.toNanos()) {
			return new Measure(now, lastRates);
		}
		previous = now;
		lastRates = before == null || now.at() - before.at() > TOO_FAR.toNanos() ? ServerRates.UNKNOWN : between(before, now, properties);
		return new Measure(now, lastRates);
	}

	Reading read() {
		return new Reading(System.nanoTime(), cpuTicks(text(Path.of("/proc/stat"))), hostTraffic(), siteTraffic());
	}

	static ServerRates between(Reading before, Reading after, MachineProperties properties) {
		double seconds = (after.at() - before.at()) / 1e9;
		if (seconds <= 0) {
			return ServerRates.UNKNOWN;
		}
		Double load = load(before.cpu(), after.cpu());
		return new ServerRates(load, load == null ? null : properties.watts(load),
				perSecond(before.host(), after.host(), seconds, true), perSecond(before.host(), after.host(), seconds, false),
				perSecond(before.site(), after.site(), seconds, true), perSecond(before.site(), after.site(), seconds, false));
	}

	/** Absent across a restart of the server (the counters start again from 0). */
	static @Nullable Double load(@Nullable CpuTicks before, @Nullable CpuTicks after) {
		if (before == null || after == null) {
			return null;
		}
		long total = after.total() - before.total();
		long idle = after.idle() - before.idle();
		return total <= 0 || idle < 0 || idle > total ? null : 1 - (double) idle / total;
	}

	/**
	 * What a counter added between two readings. Lower than before, it started again from 0 (the server
	 * or the gateway restarted): all it holds came after.
	 */
	static long added(long before, long after) {
		return after >= before ? after - before : after;
	}

	private static @Nullable Double perSecond(@Nullable Traffic before, @Nullable Traffic after, double seconds, boolean received) {
		if (before == null || after == null) {
			return null;
		}
		return received ? added(before.received(), after.received()) / seconds : added(before.sent(), after.sent()) / seconds;
	}

	/**
	 * The "cpu" line of /proc/stat: user, nice, system, idle, iowait, irq, softirq, steal (the guests are
	 * already in user). Waiting for the disk counts as idle.
	 */
	static @Nullable CpuTicks cpuTicks(@Nullable String procStat) {
		if (procStat == null || !procStat.startsWith("cpu ")) {
			return null;
		}
		String[] fields = procStat.substring(4, procStat.indexOf('\n') < 0 ? procStat.length() : procStat.indexOf('\n')).strip().split("\\s+");
		if (fields.length < 5) {
			return null;
		}
		try {
			long total = 0;
			for (int index = 0; index < Math.min(8, fields.length); index++) {
				total += Long.parseLong(fields[index]);
			}
			return new CpuTicks(total, Long.parseLong(fields[3]) + Long.parseLong(fields[4]));
		}
		catch (NumberFormatException ex) {
			return null;
		}
	}

	private @Nullable Traffic hostTraffic() {
		String devices = text(properties.hostNetwork().resolve("dev"));
		return devices == null ? null : cardTraffic(devices, text(properties.hostNetwork().resolve("route")));
	}

	/**
	 * The card that leads out (the default route of the server), or, without a route to read, every
	 * card but the loopback and the virtual ones of Docker (containers, bridges).
	 */
	static @Nullable Traffic cardTraffic(String netDev, @Nullable String route) {
		String card = route == null ? null : defaultCard(route);
		long received = 0;
		long sent = 0;
		boolean found = false;
		for (String line : netDev.split("\n")) {
			int colon = line.indexOf(':');
			if (colon < 0) {
				continue;
			}
			String name = line.substring(0, colon).strip();
			boolean counted = card != null ? name.equals(card) : !(name.equals("lo") || name.startsWith("veth") || name.startsWith("br-")
					|| name.startsWith("docker") || name.startsWith("virbr"));
			String[] fields = line.substring(colon + 1).strip().split("\\s+");
			if (counted && fields.length >= 9) {
				try {
					received += Long.parseLong(fields[0]);
					sent += Long.parseLong(fields[8]);
					found = true;
				}
				catch (NumberFormatException ex) {
					// A line of another shape: left out
				}
			}
		}
		return found ? new Traffic(received, sent) : null;
	}

	/** /proc/net/route: the card of destination 0.0.0.0 with mask 0.0.0.0, the lowest metric first. */
	static @Nullable String defaultCard(String route) {
		String best = null;
		long bestMetric = Long.MAX_VALUE;
		for (String line : route.split("\n")) {
			String[] fields = line.strip().split("\\s+");
			if (fields.length >= 8 && "00000000".equals(fields[1]) && "00000000".equals(fields[7])) {
				try {
					long metric = Long.parseLong(fields[6]);
					if (metric < bestMetric) {
						best = fields[0];
						bestMetric = metric;
					}
				}
				catch (NumberFormatException ex) {
					// Header or another shape: left out
				}
			}
		}
		return best;
	}

	private @Nullable Traffic siteTraffic() {
		String url = properties.gatewayMetrics();
		if (url.isEmpty() || System.nanoTime() < gatewayPausedUntil) {
			return null;
		}
		try {
			HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(2)).GET().build(),
					HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() == 200) {
				return gatewayTraffic(response.body());
			}
			log.debug("Gateway metrics answered {}", response.statusCode());
		}
		catch (IOException | RuntimeException ex) {
			log.debug("Gateway metrics unreachable: {}", ex.toString());
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
		}
		gatewayPausedUntil = System.nanoTime() + GATEWAY_PAUSE.toNanos();
		return null;
	}

	/**
	 * Caddy's metrics of the server named "site" (devops/gateway/Caddyfile). Each handler a request goes
	 * through counts it (compression, then the route, then the proxy): the outermost counts every request,
	 * and once compressed, so among the handlers that counted the most requests, the smallest total, the
	 * bytes that really went out.
	 */
	static @Nullable Traffic gatewayTraffic(String metrics) {
		Map<String, double[]> requests = new HashMap<>();
		Map<String, double[]> responses = new HashMap<>();
		Matcher matcher = METRIC.matcher(metrics);
		while (matcher.find()) {
			Map<String, String> labels = new HashMap<>();
			Matcher label = LABEL.matcher(matcher.group(3));
			while (label.find()) {
				labels.put(label.group(1), label.group(2));
			}
			if (!"site".equals(labels.get("server"))) {
				continue;
			}
			double value;
			try {
				value = Double.parseDouble(matcher.group(4));
			}
			catch (NumberFormatException ex) {
				continue;
			}
			double[] counted = ("request".equals(matcher.group(1)) ? requests : responses)
				.computeIfAbsent(labels.getOrDefault("handler", ""), handler -> new double[2]);
			counted["sum".equals(matcher.group(2)) ? 0 : 1] += value;
		}
		Long received = outermost(requests);
		Long sent = outermost(responses);
		return received == null || sent == null ? null : new Traffic(received, sent);
	}

	private static @Nullable Long outermost(Map<String, double[]> handlers) {
		double count = handlers.values().stream().mapToDouble(each -> each[1]).max().orElse(-1);
		OptionalDouble sum = handlers.values().stream().filter(each -> each[1] == count).mapToDouble(each -> each[0]).min();
		return sum.isPresent() ? Math.round(sum.getAsDouble()) : null;
	}

	private static @Nullable String text(Path file) {
		try {
			return Files.readString(file);
		}
		catch (IOException | RuntimeException ex) {
			// Not Linux, or not mounted: the other figures are still given
			return null;
		}
	}

}
