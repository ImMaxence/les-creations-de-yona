package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.cap.CapBlock.CapBlockPhoto;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.springframework.util.StringUtils;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** The blocks of an article: kept as JSON, tidied on save, and read with their photos still in the gallery. */
final class CapBlocks {

	static final int MAX_BLOCKS = 60;

	static final int MAX_TIP_LENGTH = 1000;

	static final int MAX_STEP_PHOTOS = 8;

	/** About 4 lines of the timeline. */
	static final int EXCERPT_LENGTH = 320;

	private static final TypeReference<List<CapBlock>> LIST = new TypeReference<>() {
	};

	private static final Pattern LINK = Pattern.compile("!?\\[([^\\]]*)]\\([^)]*\\)");

	private static final Pattern LINE_MARKS = Pattern.compile("(?m)^\\s{0,3}(#{1,6}\\s+|>\\s?|[-*+]\\s+|\\d+[.)]\\s+)");

	private static final Pattern EMPHASIS = Pattern.compile("(\\*\\*|__|\\*|_|~~|`)");

	private static final Pattern SPACES = Pattern.compile("\\s+");

	private CapBlocks() {
	}

	static List<CapBlock> read(JsonMapper json, @Nullable String blocks) {
		return blocks == null || blocks.isBlank() ? List.of() : json.readValue(blocks, LIST);
	}

	static String write(JsonMapper json, List<CapBlock> blocks) {
		return json.writeValueAsString(blocks);
	}

	/**
	 * As saved: each block with the fields of its type only, texts trimmed (blank ones dropped), the
	 * photos the gallery does not have dropped ({@code known}), a photo + text on the left unless told.
	 */
	static List<CapBlock> tidy(@Nullable List<CapBlock> blocks, Predicate<UUID> known) {
		if (blocks == null) {
			return List.of();
		}
		if (blocks.size() > MAX_BLOCKS) {
			throw new ApiException(ErrorCode.CAP_BLOCKS_TOO_MANY);
		}
		return blocks.stream().map(block -> tidy(block, known)).toList();
	}

	private static CapBlock tidy(CapBlock block, Predicate<UUID> known) {
		UUID imageId = block.imageId() != null && known.test(block.imageId()) ? block.imageId() : null;
		String text = trimmed(block.text());
		String caption = trimmed(block.caption());
		return switch (block.type()) {
			case TEXT -> new CapBlock(CapBlockType.TEXT, text, null, null, null, null);
			case TIP -> {
				if (text != null && text.length() > MAX_TIP_LENGTH) {
					throw new ApiException(ErrorCode.CAP_TIP_TOO_LONG);
				}
				yield new CapBlock(CapBlockType.TIP, text, null, null, null, null);
			}
			case IMAGE -> new CapBlock(CapBlockType.IMAGE, null, imageId, caption, null, null);
			case IMAGE_TEXT -> new CapBlock(CapBlockType.IMAGE_TEXT, text, imageId, caption,
					block.side() == null ? CapBlockSide.LEFT : block.side(), null);
			case STEPS -> new CapBlock(CapBlockType.STEPS, null, null, null, null,
					(block.photos() == null ? List.<CapBlockPhoto>of() : block.photos()).stream()
						.limit(MAX_STEP_PHOTOS)
						.map(photo -> new CapBlockPhoto(
								photo.imageId() != null && known.test(photo.imageId()) ? photo.imageId() : null,
								trimmed(photo.caption())))
						.toList());
		};
	}

	/** Every photo the blocks show, each once, in order. */
	static Set<UUID> imageIds(Collection<CapBlock> blocks) {
		Set<UUID> ids = new LinkedHashSet<>();
		for (CapBlock block : blocks) {
			if (block.imageId() != null) {
				ids.add(block.imageId());
			}
			if (block.photos() != null) {
				block.photos().stream().map(CapBlockPhoto::imageId).filter(Objects::nonNull).forEach(ids::add);
			}
		}
		return ids;
	}

	/**
	 * What visitors see: the photos gone from the gallery left out ({@code known}), then the blocks left
	 * empty. A photo + text without its photo keeps its text.
	 */
	static List<CapBlock> shown(List<CapBlock> blocks, Predicate<UUID> known) {
		List<CapBlock> shown = new ArrayList<>();
		for (CapBlock block : blocks) {
			UUID imageId = block.imageId() != null && known.test(block.imageId()) ? block.imageId() : null;
			CapBlock kept = switch (block.type()) {
				case TEXT, TIP -> block.text() == null ? null : block;
				case IMAGE -> imageId == null ? null : block;
				case IMAGE_TEXT -> imageId == null && block.text() == null ? null
						: new CapBlock(block.type(), block.text(), imageId, imageId == null ? null : block.caption(), block.side(), null);
				case STEPS -> {
					List<CapBlockPhoto> photos = block.photos() == null ? List.of()
							: block.photos().stream().filter(photo -> photo.imageId() != null && known.test(photo.imageId())).toList();
					yield photos.isEmpty() ? null : new CapBlock(block.type(), null, null, null, null, photos);
				}
			};
			if (kept != null) {
				shown.add(kept);
			}
		}
		return shown;
	}

	/** In the editor: the photos gone from the gallery taken out, the blocks kept. */
	static List<CapBlock> withKnownImages(List<CapBlock> blocks, Predicate<UUID> known) {
		return blocks.stream().map(block -> new CapBlock(block.type(), block.text(),
				block.imageId() != null && known.test(block.imageId()) ? block.imageId() : null, block.caption(), block.side(),
				block.photos() == null ? null
						: block.photos().stream()
							.map(photo -> photo.imageId() != null && known.test(photo.imageId()) ? photo
									: new CapBlockPhoto(null, photo.caption()))
							.toList()))
			.toList();
	}

	/**
	 * The start of the text, without its Markdown, for the timeline: cut at a word, about 4 lines.
	 * Null when the article has no text.
	 */
	static @Nullable String excerpt(List<CapBlock> blocks) {
		String text = blocks.stream()
			.filter(block -> block.type() == CapBlockType.TEXT || block.type() == CapBlockType.IMAGE_TEXT)
			.map(CapBlock::text)
			.filter(Objects::nonNull)
			.map(CapBlocks::plain)
			.filter(StringUtils::hasText)
			.reduce((first, second) -> first + " " + second)
			.orElse(null);
		if (text == null) {
			return null;
		}
		if (text.length() <= EXCERPT_LENGTH) {
			return text;
		}
		int cut = text.lastIndexOf(' ', EXCERPT_LENGTH);
		String start = text.substring(0, cut > EXCERPT_LENGTH / 2 ? cut : EXCERPT_LENGTH);
		return start.replaceAll("[\\s,;:.!?…—–-]+$", "") + "…";
	}

	/** "## Le matin\n**Une pâte** [feuilletée](/recettes/…)" → "Le matin Une pâte feuilletée". */
	static String plain(String markdown) {
		String text = LINK.matcher(markdown).replaceAll("$1");
		text = LINE_MARKS.matcher(text).replaceAll("");
		text = EMPHASIS.matcher(text).replaceAll("");
		return SPACES.matcher(text).replaceAll(" ").strip();
	}

	/** The text of a TEXT block, for the steps written before the articles. */
	static List<CapBlock> fromText(@Nullable String text) {
		String trimmed = trimmed(text);
		return trimmed == null ? List.of() : List.of(new CapBlock(CapBlockType.TEXT, trimmed, null, null, null, null));
	}

	private static @Nullable String trimmed(@Nullable String text) {
		return StringUtils.hasText(text) ? text.strip() : null;
	}

	/** For the history: the blocks' types, in order ("Texte, Grande photo, Texte"). */
	static String summary(List<CapBlock> blocks) {
		return String.join(", ", blocks.stream().map(block -> switch (block.type()) {
			case TEXT -> "Texte";
			case IMAGE -> "Grande photo";
			case IMAGE_TEXT -> "Photo + texte";
			case STEPS -> "Étapes en photos";
			case TIP -> "Astuce";
		}).toList());
	}

}
