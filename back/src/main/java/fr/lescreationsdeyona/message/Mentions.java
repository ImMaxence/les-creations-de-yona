package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.message.MessageResponses.Mention;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * What "@" offers in a message: the things of the site whose name holds what is typed after it, case
 * and accents ignored. The site holds a few hundred of them at most: all are read, then sorted here.
 */
@Component
class Mentions {

	static final int MAX_SHOWN = 8;

	/** How each kind is read: its id and the name it is mentioned by; the latest first where it matters. */
	private static final Map<MentionKind, String> QUERIES = Map.of(
			MentionKind.RECIPE, "select id, title as label from recipe order by id desc",
			MentionKind.CAP_ENTRY, "select id, title as label from cap_entry order by id desc",
			MentionKind.MENU, "select id, title as label from menu order by id desc",
			MentionKind.CATEGORY, "select id, name as label from category order by name",
			MentionKind.TAG, "select id, name as label from tag order by name",
			MentionKind.INGREDIENT, "select id, name as label from ingredient order by name",
			MentionKind.GLOSSARY_TERM, "select id, name as label from glossary_term order by name",
			MentionKind.SHOP_PRODUCT,
			"select p.id, r.title as label from shop_product p join recipe r on r.id = p.recipe_id order by p.id desc",
			MentionKind.SHOP_ORDER,
			"select id, 'Commande n° ' || id || ' · ' || customer_name as label from shop_order order by id desc limit 300");

	private final JdbcClient jdbc;

	Mentions(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	List<Mention> search(String query) {
		List<Mention> candidates = new ArrayList<>();
		for (MentionKind kind : MentionKind.values()) {
			jdbc.sql(QUERIES.get(kind))
				.query((row, index) -> new Mention(kind, row.getLong("id"), row.getString("label")))
				.list()
				.forEach(candidates::add);
		}
		return rank(query, candidates);
	}

	/**
	 * Nothing typed yet: the latest recipes and articles. Then those whose name holds the text, those
	 * starting with it first, then those with a word starting with it; within each, in the order of the
	 * kinds, then the shortest name.
	 */
	static List<Mention> rank(String query, List<Mention> candidates) {
		String typed = Texts.foldCaseAndAccents(query).strip();
		if (typed.isEmpty()) {
			return candidates.stream()
				.filter(mention -> mention.kind() == MentionKind.RECIPE || mention.kind() == MentionKind.CAP_ENTRY)
				.limit(MAX_SHOWN)
				.toList();
		}
		return candidates.stream()
			.filter(mention -> Texts.foldCaseAndAccents(mention.label()).contains(typed))
			.sorted(Comparator.<Mention>comparingInt(mention -> closeness(typed, Texts.foldCaseAndAccents(mention.label())))
				.thenComparing(Mention::kind)
				.thenComparingInt(mention -> mention.label().length()))
			.limit(MAX_SHOWN)
			.toList();
	}

	/** 0 when the name starts with the text, 1 when one of its words does, 2 otherwise. */
	private static int closeness(String typed, String label) {
		if (label.startsWith(typed)) {
			return 0;
		}
		return label.contains(" " + typed) || label.contains("-" + typed) || label.contains("'" + typed) ? 1 : 2;
	}

}
