package fr.lescreationsdeyona.ai;

import fr.lescreationsdeyona.cap.CapBlock;
import fr.lescreationsdeyona.cap.CapBlock.CapBlockPhoto;
import fr.lescreationsdeyona.cap.CapBlockSide;
import fr.lescreationsdeyona.cap.CapBlockType;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;

/**
 * The AI's answer turned into an article for the editor. Nothing it says is trusted: lengths and
 * counts are those of the editor, a block of an unknown type is left out, a link becomes its words
 * (the AI knows no address of the site), a "# title" becomes a subtitle.
 */
final class CapAiReader {

	/** Enough for a long article; the editor takes 60. */
	private static final int MAX_BLOCKS = 20;

	private static final int MAX_TEXT_LENGTH = 20_000;

	private static final int MAX_TIP_LENGTH = 1000;

	private static final int MAX_CAPTION_LENGTH = 300;

	private static final int MAX_STEP_CAPTION_LENGTH = 200;

	private static final int MIN_STEPS = 2;

	private static final int MAX_STEPS = 8;

	private static final Pattern LINK = Pattern.compile("!?\\[([^\\]]*)]\\([^)]*\\)");

	private static final Pattern MAIN_TITLE = Pattern.compile("(?m)^#\\s+");

	private CapAiReader() {
	}

	/** Null when the answer holds no article: said so, or no block with a text. */
	static @Nullable CapAiDraft read(JsonNode answer) {
		if (!answer.path("hasArticle").asBoolean(true)) {
			return null;
		}
		List<CapBlock> blocks = new ArrayList<>();
		CapBlockSide nextSide = CapBlockSide.LEFT;
		for (JsonNode block : answer.path("blocks")) {
			if (blocks.size() == MAX_BLOCKS) {
				break;
			}
			CapBlock read = block(block, nextSide);
			if (read != null) {
				blocks.add(read);
				if (read.type() == CapBlockType.IMAGE_TEXT) {
					// Each photo + text on the other side of the one before, as in the model "Carnet"
					nextSide = read.side() == CapBlockSide.LEFT ? CapBlockSide.RIGHT : CapBlockSide.LEFT;
				}
			}
		}
		if (blocks.stream().noneMatch(block -> block.text() != null)) {
			return null;
		}
		return new CapAiDraft(text(answer.path("title"), 150), text(answer.path("subtitle"), 200), blocks);
	}

	private static @Nullable CapBlock block(JsonNode block, CapBlockSide side) {
		String caption = text(block.path("caption"), MAX_CAPTION_LENGTH);
		return switch (block.path("type").asString("")) {
			case "TEXT" -> {
				String text = markdown(block.path("text"));
				yield text == null ? null : new CapBlock(CapBlockType.TEXT, text, null, null, null, null);
			}
			case "TIP" -> {
				String text = text(block.path("text"), MAX_TIP_LENGTH);
				yield text == null ? null : new CapBlock(CapBlockType.TIP, text, null, null, null, null);
			}
			case "IMAGE" -> new CapBlock(CapBlockType.IMAGE, null, null, caption, null, null);
			case "IMAGE_TEXT" -> {
				String text = markdown(block.path("text"));
				// Without its text, the place of a big photo
				yield text == null ? new CapBlock(CapBlockType.IMAGE, null, null, caption, null, null)
						: new CapBlock(CapBlockType.IMAGE_TEXT, text, null, caption, side, null);
			}
			case "STEPS" -> new CapBlock(CapBlockType.STEPS, null, null, null, null, steps(block.path("stepCaptions")));
			default -> null;
		};
	}

	/** One photo per caption, 2 to 8: too few captions leave empty ones, as the model "Pas à pas" does. */
	private static List<CapBlockPhoto> steps(JsonNode captions) {
		List<CapBlockPhoto> photos = new ArrayList<>();
		for (JsonNode caption : captions) {
			String text = text(caption, MAX_STEP_CAPTION_LENGTH);
			if (text != null && photos.size() < MAX_STEPS) {
				photos.add(new CapBlockPhoto(null, text));
			}
		}
		while (photos.size() < MIN_STEPS) {
			photos.add(new CapBlockPhoto(null, null));
		}
		return photos;
	}

	/** The Markdown the editor knows: links as their words, "# title" as "## title". */
	private static @Nullable String markdown(JsonNode node) {
		String text = text(node, MAX_TEXT_LENGTH);
		if (text == null) {
			return null;
		}
		return MAIN_TITLE.matcher(LINK.matcher(text).replaceAll("$1")).replaceAll("## ");
	}

	/** Trimmed and cut to its limit; blank as null. */
	private static @Nullable String text(JsonNode node, int max) {
		if (!node.isString()) {
			return null;
		}
		String text = node.asString().strip();
		if (text.isEmpty()) {
			return null;
		}
		return text.length() > max ? text.substring(0, max).strip() : text;
	}

}
