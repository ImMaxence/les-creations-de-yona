package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.message.MessageResponses.Mention;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class MentionsTest {

	private static final List<Mention> SITE = List.of(new Mention(MentionKind.RECIPE, 3, "Tarte au citron meringuée"),
			new Mention(MentionKind.RECIPE, 2, "Crème brûlée"), new Mention(MentionKind.CAP_ENTRY, 7, "Mon examen de tarte"),
			new Mention(MentionKind.MENU, 1, "Apéro entre amis"), new Mention(MentionKind.INGREDIENT, 9, "Citron"),
			new Mention(MentionKind.GLOSSARY_TERM, 4, "Crème pâtissière"),
			new Mention(MentionKind.SHOP_ORDER, 12, "Commande n° 12 · Marie"));

	private static List<String> labels(List<Mention> mentions) {
		return mentions.stream().map(Mention::label).toList();
	}

	@Test
	void findsWhatHoldsTheTextCaseAndAccentsIgnored() {
		assertThat(labels(Mentions.rank("creme", SITE))).containsExactly("Crème brûlée", "Crème pâtissière");
		assertThat(labels(Mentions.rank("APERO", SITE))).containsExactly("Apéro entre amis");
	}

	@Test
	void putsTheNamesStartingWithItFirstThenAWordStartingWithIt() {
		assertThat(labels(Mentions.rank("citron", SITE))).containsExactly("Citron", "Tarte au citron meringuée");
		assertThat(labels(Mentions.rank("tarte", SITE))).containsExactly("Tarte au citron meringuée", "Mon examen de tarte");
	}

	@Test
	void findsAnOrderByItsNumberOrItsCustomer() {
		assertThat(Mentions.rank("12", SITE)).extracting(Mention::kind).containsExactly(MentionKind.SHOP_ORDER);
		assertThat(Mentions.rank("marie", SITE)).extracting(Mention::id).containsExactly(12L);
	}

	@Test
	void offersTheLatestRecipesAndArticlesBeforeAnythingIsTyped() {
		assertThat(Mentions.rank(" ", SITE)).extracting(Mention::kind)
			.containsExactly(MentionKind.RECIPE, MentionKind.RECIPE, MentionKind.CAP_ENTRY);
	}

	@Test
	void showsEightAtMost() {
		List<Mention> many = IntStream.range(0, 20).mapToObj(i -> new Mention(MentionKind.TAG, i, "Tag " + i)).toList();

		assertThat(Mentions.rank("tag", many)).hasSize(Mentions.MAX_SHOWN);
	}

	@Test
	void refusesAnEmptyMessageAndTrimsTheOthers() {
		assertThat(AdminMessages.clean("\n  Tu as vu @[Crème brûlée](RECIPE:2) ?  \n", false)).isEqualTo("Tu as vu @[Crème brûlée](RECIPE:2) ?");
		assertThatThrownBy(() -> AdminMessages.clean("  \n ", false)).extracting("code").isEqualTo(ErrorCode.ADMIN_MESSAGE_EMPTY);
		assertThatThrownBy(() -> AdminMessages.clean(null, false)).extracting("code").isEqualTo(ErrorCode.ADMIN_MESSAGE_EMPTY);
	}

	@Test
	void takesPhotosWithoutText() {
		assertThat(AdminMessages.clean(null, true)).isEmpty();
		assertThat(AdminMessages.clean("  ", true)).isEmpty();
	}

}
