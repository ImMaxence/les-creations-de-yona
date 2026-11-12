package fr.lescreationsdeyona.message;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/** The text of a message read for something else than showing it: its first link, its start. */
final class MessageTexts {

	/** @[Tarte au citron](RECIPE:12), as message-format.ts writes a mention. */
	private static final Pattern MENTION = Pattern.compile("@\\[([^\\[\\]\\n]{1,200})]\\(([A-Z_]{1,20}):(\\d{1,18})\\)");

	/** A web address as typed: up to the next space, its punctuation at the end left out (see link-format.ts). */
	private static final Pattern LINK = Pattern.compile("https?://[^\\s<>\"]+", Pattern.CASE_INSENSITIVE);

	private static final String TRAILING = ".,;:!?…»”’'\"";

	private MessageTexts() {
	}

	/** "@Tarte au citron" for each mention. */
	static String plain(String body) {
		return MENTION.matcher(body).replaceAll(match -> Matcher.quoteReplacement("@" + match.group(1)));
	}

	/** The start of the text, on one line, cut after a word with "…" when longer. */
	static String excerpt(String body, int length) {
		String text = plain(body).replaceAll("\\s+", " ").strip();
		if (text.length() <= length) {
			return text;
		}
		int cut = text.lastIndexOf(' ', length - 1);
		return text.substring(0, cut > length / 2 ? cut : length - 1).stripTrailing() + "…";
	}

	/** The first web address of the text (mentions left aside), or null. */
	static @Nullable String firstLink(String body) {
		Matcher link = LINK.matcher(MENTION.matcher(body).replaceAll(" "));
		return link.find() ? trimLink(link.group()) : null;
	}

	/** "https://site.fr/page)." → "https://site.fr/page"; a closing bracket kept when the address opens one. */
	static String trimLink(String link) {
		String trimmed = link;
		while (!trimmed.isEmpty()) {
			char last = trimmed.charAt(trimmed.length() - 1);
			boolean unbalanced = switch (last) {
				case ')' -> count(trimmed, '(') < count(trimmed, ')');
				case ']' -> count(trimmed, '[') < count(trimmed, ']');
				default -> TRAILING.indexOf(last) >= 0;
			};
			if (!unbalanced) {
				break;
			}
			trimmed = trimmed.substring(0, trimmed.length() - 1);
		}
		return trimmed;
	}

	private static long count(String text, char c) {
		return text.chars().filter(other -> other == c).count();
	}

}
