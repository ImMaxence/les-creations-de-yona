package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/** The latest message not read, as its toast shows it. */
class UnseenMessagesTest {

	@Test
	void namesTheAuthorAndGivesThePlainStartOfTheText() {
		UnseenMessages.Latest latest = UnseenMessages.Latest.of(12, 3, "Pâtisserie", "lea@example.com", " Léa Martin ", null,
				"**Regarde** la tarte d'hier", 0, Instant.EPOCH);

		assertThat(latest.authorName()).isEqualTo("Léa Martin");
		assertThat(latest.text()).isEqualTo("Regarde la tarte d'hier");
		assertThat(latest.groupName()).isEqualTo("Pâtisserie");
	}

	@Test
	void fallsBackOnTheEmailAndCutsALongText() {
		UnseenMessages.Latest latest = UnseenMessages.Latest.of(12, 3, "Tout le monde", "lea@example.com", "  ", null,
				"mot ".repeat(60), 2, Instant.EPOCH);

		assertThat(latest.authorName()).isEqualTo("lea@example.com");
		assertThat(latest.text()).endsWith("…").hasSizeLessThanOrEqualTo(UnseenMessages.Latest.EXCERPT);
		assertThat(latest.photos()).isEqualTo(2);
	}

	@Test
	void writesTheMarkdownAndTheMentionsAsPlainText() {
		assertThat(MessageTexts.readable("## Courses\n- *trois* œufs\n- `200 g` de ~~sucre~~ farine\n> pour @[Tarte au citron](RECIPE:12)"))
			.isEqualTo("Courses\ntrois œufs\n200 g de sucre farine\npour @Tarte au citron");
		// Not an emphasis: an underscore or a star inside a word, a multiplication
		assertThat(MessageTexts.readable("pate_a_choux et 2 * 3")).isEqualTo("pate_a_choux et 2 * 3");
	}

	@Test
	void leavesTheTextEmptyForPhotosAlone() {
		assertThat(UnseenMessages.Latest.of(12, 3, "Pâtisserie", "lea@example.com", "Léa", null, "", 3, Instant.EPOCH).text()).isEmpty();
	}

}
