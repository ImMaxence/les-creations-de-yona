package fr.lescreationsdeyona.ai;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** What Gemini is told: the rules of the site's recipes, and the JSON Schema of its answer. */
final class RecipeAiPrompt {

	private RecipeAiPrompt() {
	}

	static final String INSTRUCTIONS = """
			Tu aides Yona, autrice d'un blog français de cuisine et de pâtisserie maison, à saisir ses recettes. \
			On te donne une recette : un texte collé, la photo d'une recette écrite ou une capture d'écran. \
			Tu la ranges dans les champs demandés, sans rien inventer.

			Règles :
			- isRecipe : false si le contenu n'est pas une recette de cuisine ; laisse alors les autres champs vides.
			- N'invente aucune quantité, aucun temps, aucun ingrédient : ce que la recette ne dit pas reste null, ou une liste vide.
			- Garde les mots de l'autrice : corrige seulement l'orthographe et les fautes de frappe. Tout en français.
			- theme : SWEET pour une recette sucrée (dessert, gâteau, goûter, confiserie), SAVORY pour une recette salée.
			- title : le nom de la recette, court, sans emoji. intro : une ou deux phrases de présentation si la recette en a, sinon null.
			- servings : le nombre de personnes ou de parts. Temps en minutes : prepMinutes (préparation), cookMinutes (cuisson), \
			restMinutes (repos, levée, réfrigération, congélation).
			- difficulty : de 1 (très facile) à 5 (difficile), par demi-points, seulement si la recette l'indique ; sinon null.
			- parts : une seule partie, sans titre (title null), pour une recette simple. Plusieurs parties seulement si la recette \
			les distingue (la pâte, la crème, le montage), chacune avec un titre court (« La pâte sucrée »).
			- ingredients : un ingrédient par ligne, une seule fois par partie. name : le nom seul, sans quantité, première lettre en \
			majuscule (« Farine », « Œufs »). Si un nom de la liste « Ingrédients déjà connus » désigne le même ingrédient, \
			reprends-le exactement. quantity : un nombre (0.5 pour un demi, 1 pour « un »), null si la recette n'en donne pas \
			(« du sel », « un peu de »). unit : g, kg, ml, cl, l, c. à café, c. à soupe, pincée, sachet, feuille, gousse, tranche…, \
			null pour des pièces (3 œufs). note : une précision utile (« à température ambiante », « fondu »), sinon null.
			- steps : une action, ou quelques actions liées, par étape, sans numéro au début, à l'impératif. Garde le ton du \
			texte : tutoiement s'il tutoie (« Préchauffe le four »), vouvoiement sinon (« Préchauffez le four à 180 °C »). durationMinutes : la durée si l'étape en donne une (cuisson, repos), sinon null. \
			ingredientPositions : les positions (à partir de 0), dans la liste des ingrédients de la même partie, des ingrédients \
			que l'étape utilise.
			- equipment : le matériel nécessaire (« Moule à tarte », « Fouet »), un élément par entrée.
			- mold : le moule pour lequel les quantités sont écrites, si la recette le donne : ROUND (lengthCm = diamètre), \
			SQUARE (lengthCm = côté) ou RECTANGLE (lengthCm et widthCm), en centimètres ; sinon null.
			- tip : un conseil, une variante ou la conservation, si la recette en donne ; sinon null.
			- categories et tags : seulement des noms exacts des listes du site données plus bas ; une ou deux catégories, \
			la plus juste en premier ; listes vides si rien ne convient.""";

	/** The site's names, then the recipe. */
	static String message(String recipe, Collection<String> categories, Collection<String> tags,
			Collection<String> ingredients) {
		return "Catégories du site : " + names(categories) + "\nTags du site : " + names(tags) + "\nIngrédients déjà connus : "
				+ names(ingredients) + "\n\nRecette :\n" + (recipe.isBlank() ? "(voir la photo)" : recipe);
	}

	private static String names(Collection<String> names) {
		return names.isEmpty() ? "aucun" : String.join(" ; ", names);
	}

	/**
	 * Every property required, empty values as null: the model never leaves one out. In the order
	 * the answer is written: whether it is a recipe first.
	 */
	static Map<String, Object> schema() {
		Map<String, Object> ingredient = object("name", type("string"), "quantity", nullable("number"), "unit",
				nullable("string"), "note", nullable("string"));
		Map<String, Object> step = object("description", type("string"), "durationMinutes", nullable("integer"),
				"ingredientPositions", array(type("integer")));
		Map<String, Object> part = object("title", nullable("string"), "ingredients", array(ingredient), "steps", array(step));
		Map<String, Object> mold = new LinkedHashMap<>(object("shape",
				Map.of("type", "string", "enum", List.of("ROUND", "SQUARE", "RECTANGLE")), "lengthCm", type("number"), "widthCm",
				nullable("number")));
		mold.put("type", List.of("object", "null"));
		return object("isRecipe", type("boolean"), "theme", Map.of("type", "string", "enum", List.of("SWEET", "SAVORY")),
				"title", nullable("string"), "intro", nullable("string"), "servings",
				nullable("integer"), "prepMinutes", nullable("integer"), "cookMinutes", nullable("integer"), "restMinutes",
				nullable("integer"), "difficulty", nullable("number"), "categories", array(type("string")), "tags",
				array(type("string")), "parts", array(part), "equipment", array(type("string")), "mold", mold, "tip",
				nullable("string"));
	}

	/** Property names and their schemas, in turn. */
	private static Map<String, Object> object(Object... namesAndSchemas) {
		Map<String, Object> properties = new LinkedHashMap<>();
		for (int index = 0; index < namesAndSchemas.length; index += 2) {
			properties.put((String) namesAndSchemas[index], namesAndSchemas[index + 1]);
		}
		Map<String, Object> object = new LinkedHashMap<>();
		object.put("type", "object");
		object.put("properties", properties);
		object.put("required", List.copyOf(properties.keySet()));
		return object;
	}

	private static Map<String, Object> array(Map<String, Object> items) {
		return Map.of("type", "array", "items", items);
	}

	private static Map<String, Object> type(String type) {
		return Map.of("type", type);
	}

	private static Map<String, Object> nullable(String type) {
		return Map.of("type", List.of(type, "null"));
	}

}
