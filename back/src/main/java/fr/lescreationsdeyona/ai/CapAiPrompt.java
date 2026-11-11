package fr.lescreationsdeyona.ai;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/** What the AI is told to write an article of "Mon CAP" from Yona's notes, and the JSON Schema of its answer. */
final class CapAiPrompt {

	private CapAiPrompt() {
	}

	static final String INSTRUCTIONS = """
			Tu aides Yona, qui prépare le CAP pâtissier et le raconte sur son blog de cuisine et de pâtisserie maison, \
			dans la rubrique « Mon CAP ». On te donne ses notes : quelques lignes en vrac, un message, ou la photo de notes \
			écrites à la main. Tu en fais un article prêt à relire, découpé en blocs.

			Règles :
			- hasArticle : false si les notes ne racontent rien dont on puisse faire un article (vide, sans rapport, illisible) ; \
			laisse alors les autres champs vides.
			- N'invente rien : ni fait, ni recette, ni quantité, ni temps, ni température, ni note, ni personne, ni ressenti que \
			les notes ne donnent pas. Tu peux reformuler, remettre dans l'ordre et relier les idées. Des notes courtes donnent \
			un article court.
			- Recopie les nombres, les unités et les températures tels qu'ils sont écrits (« 200 °C », « 5 cm », « 14/20 »).
			- Écris à la première personne, comme Yona : simple, naturel et chaleureux, sans emphase ni formule toute faite. \
			Garde ses mots et ses expressions ; corrige l'orthographe. Tout en français, sans emoji.
			- title : court et parlant (« Mon premier examen blanc »), 80 caractères au plus. subtitle : une phrase courte \
			qui donne envie de lire, ou null.
			- blocks : les blocs de l'article dans l'ordre, de 1 à 12. Le premier est un TEXT qui pose le contexte. Types :
			  - TEXT : du texte en Markdown simple. Une ligne vide entre deux paragraphes, « ## » au début d'une ligne pour un \
			intertitre, **mots** pour le gras, « - » au début d'une ligne pour une liste. Pas d'autre Markdown, ni lien, ni titre « # ».
			  - TIP : une astuce ou un piège à retenir, en une à trois phrases, sans Markdown ; seulement si les notes en donnent un.
			  - IMAGE : la place d'une grande photo, là où les notes parlent d'une réalisation à montrer ; Yona ajoutera la photo. \
			caption : la légende proposée, courte.
			  - IMAGE_TEXT : une photo à côté d'un texte (Markdown comme TEXT), pour une remarque à illustrer. caption : la légende \
			proposée, ou null.
			  - STEPS : de 2 à 8 photos numérotées, quand les notes décrivent une technique pas à pas. stepCaptions : la légende \
			courte de chaque étape, dans l'ordre (« Abaisser la pâte à 3 mm »).
			- Trois places de photo au plus en tout (IMAGE, IMAGE_TEXT, STEPS), seulement là où une photo a du sens.
			- Les champs dont le type du bloc ne se sert pas : null, ou une liste vide.""";

	/** The shape asked, then the notes. */
	static String message(String notes, @Nullable CapAiForm form) {
		return (form == null ? CapAiForm.AUTO : form).instruction + "\n\nNotes de Yona :\n"
				+ (notes.isBlank() ? "(voir la photo)" : notes);
	}

	/** For the model of the browser: nothing forces its answer into the schema, it is asked to follow it. */
	static String localInstructions(String schema) {
		return INSTRUCTIONS + "\n\nRéponds uniquement avec un objet JSON conforme à ce schéma, sans aucun texte autour :\n" + schema;
	}

	/** Every property required, empty values as null: the model never leaves one out. Whether there is an article first. */
	static Map<String, Object> schema() {
		Map<String, Object> block = object("type",
				Map.of("type", "string", "enum", List.of("TEXT", "TIP", "IMAGE", "IMAGE_TEXT", "STEPS")), "text",
				nullable("string"), "caption", nullable("string"), "stepCaptions",
				Map.of("type", "array", "items", Map.of("type", "string")));
		return object("hasArticle", Map.of("type", "boolean"), "title", nullable("string"), "subtitle", nullable("string"),
				"blocks", Map.of("type", "array", "items", block));
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

	private static Map<String, Object> nullable(String type) {
		return Map.of("type", List.of(type, "null"));
	}

}
