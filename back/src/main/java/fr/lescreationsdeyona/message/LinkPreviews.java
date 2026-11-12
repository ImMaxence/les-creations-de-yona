package fr.lescreationsdeyona.message;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import fr.lescreationsdeyona.image.ImageProcessor;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The preview of a link written in a message, as on a phone: the title, the text and the image of its
 * page. Read while the message is written (shown under the field), then again from memory once it is
 * sent, and kept with it. Kept 30 minutes for the next one, a page without anything to show included.
 */
@Component
class LinkPreviews {

	private static final int MAX_PAGE_BYTES = 1024 * 1024;

	private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;

	private static final int MAX_URL = 2000;

	private static final String PAGE_TYPES = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1";

	private static final String IMAGE_TYPES = "image/webp,image/jpeg,image/png,image/gif;q=0.9,*/*;q=0.1";

	private static final Logger log = LoggerFactory.getLogger(LinkPreviews.class);

	/** A page read: what its preview shows; the image ready to be stored with the message. */
	record Page(String url, @Nullable String title, @Nullable String description, @Nullable String siteName,
			ImageProcessor.@Nullable Sized image) {
	}

	private final Cache<String, Optional<Page>> pages = Caffeine.newBuilder().maximumSize(100).expireAfterWrite(Duration.ofMinutes(30)).build();

	private final LinkFetcher fetcher;

	private final ImageProcessor images;

	LinkPreviews(LinkFetcher fetcher, ImageProcessor images) {
		this.fetcher = fetcher;
		this.images = images;
	}

	/** Empty for an address that is not a web page, or a page with nothing to show. */
	Optional<Page> preview(String url) {
		URI uri = uriOf(url);
		return uri == null ? Optional.empty() : pages.get(uri.toString(), key -> read(uri));
	}

	/** An address of the web as typed, or null. */
	static @Nullable URI uriOf(String url) {
		if (url.length() > MAX_URL) {
			return null;
		}
		try {
			URI uri = URI.create(url.strip()).normalize();
			String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
			return (scheme.equals("http") || scheme.equals("https")) && uri.getHost() != null ? uri : null;
		}
		catch (IllegalArgumentException ex) {
			return null;
		}
	}

	private Optional<Page> read(URI uri) {
		try {
			LinkFetcher.Fetched page = fetcher.fetch(uri, PAGE_TYPES, MAX_PAGE_BYTES);
			if (!isHtml(page.contentType())) {
				return Optional.empty();
			}
			LinkPages.Meta meta = LinkPages.read(page.body(), page.contentType(), page.uri());
			if (meta.title() == null && meta.description() == null) {
				return Optional.empty();
			}
			return Optional.of(new Page(uri.toString(), meta.title(), meta.description(), meta.siteName(),
					meta.image() == null ? null : image(meta.image())));
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			return Optional.empty();
		}
		catch (IOException | RuntimeException ex) {
			log.debug("No preview for {}: {}", uri.getHost(), ex.toString());
			return Optional.empty();
		}
	}

	/** The page's image, or null: not one, too big, unreadable, an icon. */
	private ImageProcessor.@Nullable Sized image(URI uri) throws InterruptedException {
		try {
			LinkFetcher.Fetched image = fetcher.fetch(uri, IMAGE_TYPES, MAX_IMAGE_BYTES);
			String type = image.contentType();
			if (type != null && !type.toLowerCase(Locale.ROOT).startsWith("image/") || image.body().length >= MAX_IMAGE_BYTES) {
				return null;
			}
			return images.processPreview(image.body()).orElse(null);
		}
		catch (IOException | RuntimeException ex) {
			log.debug("No image for the preview of {}: {}", uri.getHost(), ex.toString());
			return null;
		}
	}

	private static boolean isHtml(@Nullable String contentType) {
		String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
		return type.startsWith("text/html") || type.startsWith("application/xhtml+xml");
	}

}
