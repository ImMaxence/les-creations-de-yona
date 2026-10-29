package fr.lescreationsdeyona.audit;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.jspecify.annotations.Nullable;

/**
 * What an update changed, field by field, for the history; a field left as it was is not kept.
 * Values are compared as they are shown: a blank text is empty, 2.50 is "2,5", true is "Oui".
 */
public final class AuditChanges {

	/** A long text (a step, "À propos") is cut there: the history shows what changed, it is no copy. */
	static final int MAX_LENGTH = 600;

	/** A whole recipe rewritten keeps the first ones only. */
	static final int MAX_CHANGES = 40;

	private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH'h'mm")
		.withZone(ZoneId.of("Europe/Paris"));

	private final List<AuditChange> changes = new ArrayList<>();

	public AuditChanges add(String field, @Nullable Object before, @Nullable Object after) {
		String shownBefore = shown(before);
		String shownAfter = shown(after);
		if (!Objects.equals(shownBefore, shownAfter)) {
			changes.add(new AuditChange(field, shorten(shownBefore), shorten(shownAfter)));
		}
		return this;
	}

	/**
	 * A list (ingredients, steps, recipes of a menu): the lines removed before, the lines added after.
	 * Only reordered, the whole list before and after, numbered.
	 */
	public AuditChanges addLines(String field, List<String> before, List<String> after) {
		List<String> removed = before.stream().filter(line -> !after.contains(line)).toList();
		List<String> added = after.stream().filter(line -> !before.contains(line)).toList();
		if (!removed.isEmpty() || !added.isEmpty()) {
			changes.add(new AuditChange(field, shorten(lines(removed)), shorten(lines(added))));
		}
		else if (!before.equals(after)) {
			changes.add(new AuditChange(field + " (ordre)", shorten(lines(numbered(before))), shorten(lines(numbered(after)))));
		}
		return this;
	}

	public boolean isEmpty() {
		return changes.isEmpty();
	}

	List<AuditChange> list() {
		return changes.size() > MAX_CHANGES ? List.copyOf(changes.subList(0, MAX_CHANGES)) : List.copyOf(changes);
	}

	/** "Oui" or "Non", for a yes or no field. */
	public static String yesNo(boolean value) {
		return value ? "Oui" : "Non";
	}

	/** "12/10/2026 à 14h05", Paris time. */
	public static String dateTime(Instant instant) {
		return DATE_TIME.format(instant);
	}

	/** An enum without a French label of its own: PATISSERIE_CHIC is "Patisserie chic". */
	public static @Nullable String named(@Nullable Enum<?> value) {
		if (value == null) {
			return null;
		}
		String words = value.name().replace('_', ' ').toLowerCase(Locale.ROOT);
		return Character.toUpperCase(words.charAt(0)) + words.substring(1);
	}

	private static @Nullable String shown(@Nullable Object value) {
		String text = switch (value) {
			case null -> null;
			case BigDecimal number -> number.stripTrailingZeros().toPlainString().replace('.', ',');
			case Boolean yes -> yesNo(yes);
			case Instant instant -> DATE_TIME.format(instant);
			case Collection<?> items -> items.stream().map(AuditChanges::shown).filter(Objects::nonNull)
				.collect(Collectors.joining(", "));
			default -> value.toString();
		};
		return text == null || text.isBlank() ? null : text.strip();
	}

	private static List<String> numbered(List<String> lines) {
		return IntStream.range(0, lines.size()).mapToObj(index -> (index + 1) + ". " + lines.get(index)).toList();
	}

	private static @Nullable String lines(List<String> lines) {
		return lines.isEmpty() ? null : String.join("\n", lines);
	}

	private static @Nullable String shorten(@Nullable String text) {
		return text == null || text.length() <= MAX_LENGTH ? text : text.substring(0, MAX_LENGTH - 1).stripTrailing() + "…";
	}

}
