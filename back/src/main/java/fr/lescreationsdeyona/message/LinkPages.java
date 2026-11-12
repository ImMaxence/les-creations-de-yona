package fr.lescreationsdeyona.message;

import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * What the preview of a link shows of its page, read from its head as messaging apps do: the Open
 * Graph tags (og:title, og:description, og:image, og:site_name), else Twitter's, else its title and
 * description. Read with patterns, not a full HTML parser: only these few tags matter.
 */
final class LinkPages {

	static final int MAX_TITLE = 300;

	static final int MAX_DESCRIPTION = 500;

	static final int MAX_SITE = 100;

	private static final Pattern HEAD_END = Pattern.compile("</head\\s*>", Pattern.CASE_INSENSITIVE);

	private static final Pattern META = Pattern.compile("<meta\\s[^>]*>", Pattern.CASE_INSENSITIVE);

	private static final Pattern ATTRIBUTE = Pattern.compile("([^\\s=/>\"']+)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>\"']+))");

	private static final Pattern TITLE = Pattern.compile("<title[^>]*>(.*?)</title\\s*>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

	private static final Pattern CHARSET = Pattern.compile("charset\\s*=\\s*[\"']?([\\w.:-]{1,40})", Pattern.CASE_INSENSITIVE);

	private static final Pattern ENTITY = Pattern.compile("&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,10});");

	private static final Map<String, String> ENTITIES = Map.ofEntries(Map.entry("amp", "&"), Map.entry("lt", "<"),
			Map.entry("gt", ">"), Map.entry("quot", "\""), Map.entry("apos", "'"), Map.entry("nbsp", " "), Map.entry("rsquo", "’"),
			Map.entry("lsquo", "‘"), Map.entry("rdquo", "”"), Map.entry("ldquo", "“"), Map.entry("laquo", "«"), Map.entry("raquo", "»"),
			Map.entry("hellip", "…"), Map.entry("mdash", "—"), Map.entry("ndash", "–"), Map.entry("eacute", "é"), Map.entry("egrave", "è"),
			Map.entry("ecirc", "ê"), Map.entry("euml", "ë"), Map.entry("agrave", "à"), Map.entry("acirc", "â"), Map.entry("ccedil", "ç"),
			Map.entry("icirc", "î"), Map.entry("iuml", "ï"), Map.entry("ocirc", "ô"), Map.entry("ucirc", "û"), Map.entry("ugrave", "ù"),
			Map.entry("Eacute", "É"), Map.entry("Agrave", "À"), Map.entry("Ccedil", "Ç"), Map.entry("oelig", "œ"), Map.entry("euro", "€"),
			Map.entry("copy", "©"), Map.entry("reg", "®"), Map.entry("deg", "°"), Map.entry("middot", "·"));

	private LinkPages() {
	}

	/** What a page says of itself; {@code image} already made absolute. */
	record Meta(@Nullable String title, @Nullable String description, @Nullable String siteName, @Nullable URI image) {
	}

	/** The head of a page: its bytes read in the encoding it declares (UTF-8 otherwise). */
	static Meta read(byte[] body, @Nullable String contentType, URI page) {
		String html = new String(body, charsetOf(body, contentType));
		Matcher headEnd = HEAD_END.matcher(html);
		String head = headEnd.find() ? html.substring(0, headEnd.start()) : html;

		Map<String, String> tags = new HashMap<>();
		Matcher meta = META.matcher(head);
		while (meta.find()) {
			Map<String, String> attributes = attributes(meta.group());
			String key = attributes.getOrDefault("property", attributes.get("name"));
			String content = attributes.get("content");
			if (key != null && content != null && !content.isBlank()) {
				tags.putIfAbsent(key.toLowerCase(Locale.ROOT), content);
			}
		}
		Matcher title = TITLE.matcher(head);
		String pageTitle = title.find() ? title.group(1) : null;

		return new Meta(text(first(tags.get("og:title"), tags.get("twitter:title"), pageTitle), MAX_TITLE),
				text(first(tags.get("og:description"), tags.get("twitter:description"), tags.get("description")), MAX_DESCRIPTION),
				text(first(tags.get("og:site_name"), siteOf(page)), MAX_SITE),
				image(page, first(tags.get("og:image:secure_url"), tags.get("og:image"), tags.get("og:image:url"), tags.get("twitter:image"),
						tags.get("twitter:image:src"))));
	}

	/** "lescreationsdeyona.fr" for "https://www.lescreationsdeyona.fr/recettes". */
	static @Nullable String siteOf(URI page) {
		String host = page.getHost();
		return host == null ? null : host.toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
	}

	private static Charset charsetOf(byte[] body, @Nullable String contentType) {
		String declared = null;
		if (contentType != null) {
			Matcher header = CHARSET.matcher(contentType);
			declared = header.find() ? header.group(1) : null;
		}
		if (declared == null) {
			Matcher inPage = CHARSET.matcher(new String(body, 0, Math.min(body.length, 4096), StandardCharsets.ISO_8859_1));
			declared = inPage.find() ? inPage.group(1) : null;
		}
		try {
			return declared == null ? StandardCharsets.UTF_8 : Charset.forName(declared);
		}
		catch (IllegalArgumentException ex) {
			return StandardCharsets.UTF_8;
		}
	}

	private static Map<String, String> attributes(String tag) {
		Map<String, String> attributes = new HashMap<>();
		Matcher attribute = ATTRIBUTE.matcher(tag);
		while (attribute.find()) {
			String value = attribute.group(2) != null ? attribute.group(2) : attribute.group(3) != null ? attribute.group(3) : attribute.group(4);
			attributes.putIfAbsent(attribute.group(1).toLowerCase(Locale.ROOT), value);
		}
		return attributes;
	}

	@SafeVarargs
	private static <T> @Nullable T first(@Nullable T... values) {
		for (T value : values) {
			if (value != null) {
				return value;
			}
		}
		return null;
	}

	/** On one line, its entities read, cut with "…" when too long; null when empty. */
	static @Nullable String text(@Nullable String raw, int max) {
		if (raw == null) {
			return null;
		}
		String text = decode(raw.replaceAll("<[^>]*>", " ")).replaceAll("\\s+", " ").strip();
		if (text.isEmpty()) {
			return null;
		}
		return text.length() <= max ? text : text.substring(0, max - 1).stripTrailing() + "…";
	}

	/** &amp;, &eacute;, &#233;, &#xE9;… as the characters they stand for; an unknown one left as it is. */
	static String decode(String text) {
		return ENTITY.matcher(text).replaceAll(match -> {
			String entity = match.group(1);
			String decoded;
			if (entity.startsWith("#x") || entity.startsWith("#X")) {
				decoded = codePoint(Integer.parseInt(entity.substring(2), 16));
			}
			else if (entity.startsWith("#")) {
				decoded = codePoint(Integer.parseInt(entity.substring(1)));
			}
			else {
				decoded = ENTITIES.get(entity);
			}
			return Matcher.quoteReplacement(decoded != null ? decoded : match.group());
		});
	}

	private static @Nullable String codePoint(int codePoint) {
		return Character.isValidCodePoint(codePoint) && codePoint != 0 ? Character.toString(codePoint) : null;
	}

	/** The image's address made absolute ("/photo.jpg", "//cdn…"), on the web only. */
	private static @Nullable URI image(URI page, @Nullable String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		try {
			URI image = page.resolve(decode(raw.strip()).replace(" ", "%20"));
			String scheme = image.getScheme() == null ? "" : image.getScheme().toLowerCase(Locale.ROOT);
			return scheme.equals("http") || scheme.equals("https") ? image : null;
		}
		catch (IllegalArgumentException ex) {
			return null;
		}
	}

}
