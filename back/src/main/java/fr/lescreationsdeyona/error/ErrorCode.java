package fr.lescreationsdeyona.error;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

/**
 * Stable error codes sent to the front in the {@code code} property of every ProblemDetail.
 * The message is the French text shown to the user.
 */
public enum ErrorCode {

	// Generic, also used for framework and security errors.
	BAD_REQUEST(HttpStatus.BAD_REQUEST, "La requête est invalide"),
	VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Certains champs sont invalides"),
	INVALID_SORT(HttpStatus.BAD_REQUEST, "Ce tri n'est pas autorisé"),
	UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Veuillez vous connecter"),
	ACCESS_DENIED(HttpStatus.FORBIDDEN, "Vous n'avez pas accès à cette ressource"),
	CSRF_TOKEN_INVALID(HttpStatus.FORBIDDEN, "Votre session a expiré, rechargez la page"),
	RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "Ressource introuvable"),
	METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "Cette opération n'est pas autorisée"),
	NOT_ACCEPTABLE(HttpStatus.NOT_ACCEPTABLE, "Ce format de réponse n'est pas disponible"),
	CONTENT_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "Le contenu envoyé est trop volumineux"),
	UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Ce format de contenu n'est pas pris en charge"),
	DATA_CONFLICT(HttpStatus.CONFLICT, "L'opération entre en conflit avec des données existantes"),
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Une erreur inattendue est survenue, réessayez plus tard"),

	// Recipes
	RECIPE_NOT_FOUND(HttpStatus.NOT_FOUND, "Recette introuvable"),
	FEATURED_RECIPE_MUST_BE_PUBLISHED(HttpStatus.BAD_REQUEST, "Seule une recette publiée peut être mise à la une"),
	DUPLICATE_RECIPE_INGREDIENT(HttpStatus.BAD_REQUEST, "Un même ingrédient apparaît plusieurs fois dans une même partie de la recette"),
	DUPLICATE_RECIPE_CATEGORY(HttpStatus.BAD_REQUEST, "Une même catégorie est choisie plusieurs fois"),
	RECIPE_INGREDIENT_REQUIRED(HttpStatus.BAD_REQUEST, "La recette doit avoir au moins un ingrédient"),
	RECIPE_STEP_REQUIRED(HttpStatus.BAD_REQUEST, "La recette doit avoir au moins une étape"),
	RECIPE_PART_TITLE_REQUIRED(HttpStatus.BAD_REQUEST, "Quand la recette a plusieurs parties, chacune doit avoir un titre"),
	RECIPE_PART_EMPTY(HttpStatus.BAD_REQUEST, "Chaque partie doit avoir au moins un ingrédient ou une étape"),
	DIFFICULTY_NOT_HALF_POINT(HttpStatus.BAD_REQUEST, "La difficulté va de 1 à 5, par demi-points (2,5 par exemple)"),
	STEP_INGREDIENT_INVALID(HttpStatus.BAD_REQUEST, "Une étape indique un ingrédient absent de sa partie : enregistrez de nouveau la recette"),
	MOLD_INVALID(HttpStatus.BAD_REQUEST, "Indiquez le diamètre d'un moule rond, le côté d'un moule carré, ou la longueur et la largeur d'un moule rectangulaire"),
	SCHEDULED_RECIPE_MUST_BE_DRAFT(HttpStatus.BAD_REQUEST, "Seul un brouillon peut être programmé : la recette est déjà publiée"),
	SCHEDULED_AT_PAST(HttpStatus.BAD_REQUEST, "La date de publication programmée est déjà passée"),
	TRASHED_RECIPE_CATEGORIES_GONE(HttpStatus.CONFLICT, "Les catégories de cette recette ont toutes été supprimées : recréez-en une avant de la restaurer"),
	VIDEO_URL_INVALID(HttpStatus.BAD_REQUEST, "Ce lien n'est pas une vidéo YouTube (youtube.com/watch?v=…, youtu.be/… ou youtube.com/shorts/…)"),

	// Trash
	TRASH_ITEM_NOT_FOUND(HttpStatus.NOT_FOUND, "Ce n'est plus dans la corbeille"),

	// Categories
	CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, "Catégorie introuvable"),
	CATEGORY_IN_USE(HttpStatus.CONFLICT, "Cette catégorie contient encore des recettes"),

	// Tags
	TAG_NOT_FOUND(HttpStatus.NOT_FOUND, "Tag introuvable"),
	TAG_ALREADY_EXISTS(HttpStatus.CONFLICT, "Ce tag existe déjà"),

	// Menus
	MENU_NOT_FOUND(HttpStatus.NOT_FOUND, "Menu introuvable"),
	MENU_ALREADY_EXISTS(HttpStatus.CONFLICT, "Un menu porte déjà ce titre"),
	MENU_RECIPE_NOT_FOUND(HttpStatus.BAD_REQUEST, "Une des recettes du menu n'existe plus"),

	// Glossary
	GLOSSARY_TERM_NOT_FOUND(HttpStatus.NOT_FOUND, "Mot du glossaire introuvable"),
	GLOSSARY_TERM_ALREADY_EXISTS(HttpStatus.CONFLICT, "Ce mot est déjà dans le glossaire"),

	// Notifications of new recipes
	PUSH_SUBSCRIPTION_INVALID(HttpStatus.BAD_REQUEST, "Cet abonnement aux notifications n'est pas valide"),
	PUSH_SUBSCRIPTIONS_FULL(HttpStatus.SERVICE_UNAVAILABLE, "Les abonnements aux notifications sont complets pour le moment"),

	// Visitors' messages
	FEEDBACK_TOO_MANY(HttpStatus.TOO_MANY_REQUESTS, "Vous avez envoyé plusieurs messages en peu de temps : réessayez dans une heure"),
	FEEDBACK_FULL(HttpStatus.SERVICE_UNAVAILABLE, "Les messages ne peuvent pas être reçus pour le moment : réessayez dans quelques jours"),
	FEEDBACK_NOT_FOUND(HttpStatus.NOT_FOUND, "Ce message n'existe plus"),

	// Ingredients
	INGREDIENT_NOT_FOUND(HttpStatus.NOT_FOUND, "Ingrédient introuvable"),
	INGREDIENT_ALREADY_EXISTS(HttpStatus.CONFLICT, "Cet ingrédient existe déjà"),
	INGREDIENT_IN_USE(HttpStatus.CONFLICT, "Cet ingrédient est utilisé dans au moins une recette"),
	INGREDIENT_MERGE_INVALID(HttpStatus.BAD_REQUEST, "Choisissez au moins deux ingrédients, et l'ingrédient à garder ou le nouveau nom"),
	INGREDIENT_MERGE_CONFLICT(HttpStatus.CONFLICT, "Ces ingrédients figurent ensemble dans une même partie d'une recette : corrigez-la avant de les fusionner"),

	// Social links
	DUPLICATE_SOCIAL_PLATFORM(HttpStatus.BAD_REQUEST, "Chaque réseau social ne peut apparaître qu'une seule fois"),

	// "Remplir avec l'IA" (Gemini)
	AI_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "Le remplissage par IA n'est pas configuré : il manque la clé Gemini (GEMINI_API_KEY)"),
	AI_KEY_REFUSED(HttpStatus.SERVICE_UNAVAILABLE, "Google refuse la clé Gemini : vérifiez-la dans Google AI Studio"),
	AI_DAILY_QUOTA(HttpStatus.TOO_MANY_REQUESTS, "Les demandes gratuites à Gemini sont épuisées pour aujourd'hui : réessayez demain matin"),
	AI_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Trop de demandes à Gemini en une minute : réessayez dans un instant"),
	AI_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Gemini est indisponible pour le moment (très demandé) : réessayez dans quelques minutes"),
	AI_BUSY(HttpStatus.CONFLICT, "Une recette est déjà en cours de lecture par l'IA : attendez la fin"),
	AI_INPUT_REQUIRED(HttpStatus.BAD_REQUEST, "Collez le texte d'une recette ou envoyez une photo"),
	AI_TEXT_TOO_LONG(HttpStatus.BAD_REQUEST, "Le texte dépasse 20 000 caractères"),
	AI_NOT_A_RECIPE(HttpStatus.BAD_REQUEST, "L'IA n'a pas trouvé de recette dans ce texte ou cette photo"),
	AI_BLOCKED(HttpStatus.BAD_REQUEST, "Gemini a refusé de lire ce contenu"),
	AI_BAD_RESPONSE(HttpStatus.BAD_GATEWAY, "La réponse de Gemini est illisible : réessayez"),

	// Images
	IMAGE_NOT_FOUND(HttpStatus.NOT_FOUND, "Image introuvable"),
	IMAGE_REQUIRED(HttpStatus.BAD_REQUEST, "Aucune image n'a été envoyée"),
	IMAGE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "L'image dépasse 10 Mo"),
	IMAGE_FORMAT_UNSUPPORTED(HttpStatus.BAD_REQUEST, "Seules les images JPEG et PNG sont acceptées"),
	IMAGE_UNREADABLE(HttpStatus.BAD_REQUEST, "L'image est illisible ou endommagée"),
	IMAGE_TOO_MANY_PIXELS(HttpStatus.BAD_REQUEST, "L'image dépasse 100 mégapixels"),
	IMAGE_TOO_SMALL(HttpStatus.BAD_REQUEST, "L'image doit mesurer au moins 1200 × 800 pixels"),
	IMAGE_NOT_LANDSCAPE(HttpStatus.BAD_REQUEST, "L'image doit être au format paysage (4:3 ou plus large)"),
	PORTRAIT_IMAGE_TOO_SMALL(HttpStatus.BAD_REQUEST, "L'image Pinterest doit mesurer au moins 1000 × 1333 pixels"),
	IMAGE_NOT_PORTRAIT(HttpStatus.BAD_REQUEST, "L'image Pinterest doit être verticale (3:4 ou plus haute, 2:3 conseillé)"),
	STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Le stockage des images est indisponible, réessayez plus tard"),

	// Backup
	BACKUP_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "La sauvegarde n'est pas disponible sur ce serveur"),
	DRIVE_NOT_CONNECTED(HttpStatus.CONFLICT, "Aucun compte Google Drive n'est connecté"),
	DRIVE_BACKUP_RUNNING(HttpStatus.CONFLICT, "Une sauvegarde vers Google Drive est déjà en cours"),

	// Restore
	RESTORE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "La restauration n'est pas disponible sur ce serveur"),
	RESTORE_NOT_FOUND(HttpStatus.NOT_FOUND, "Cet envoi de sauvegarde a expiré ou n'existe plus : recommencez"),
	RESTORE_BUSY(HttpStatus.CONFLICT, "Une restauration est déjà en cours : attendez qu'elle se termine ou annulez-la"),
	RESTORE_CHUNK_INVALID(HttpStatus.BAD_REQUEST, "Morceau de fichier inattendu : recommencez l'envoi"),
	RESTORE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "La sauvegarde dépasse 20 Go"),
	RESTORE_NOT_ENOUGH_SPACE(HttpStatus.INSUFFICIENT_STORAGE, "Pas assez d'espace libre sur le serveur pour traiter cette sauvegarde"),
	RESTORE_ARCHIVE_INVALID(HttpStatus.BAD_REQUEST, "Ce fichier n'est pas une sauvegarde du site (l'archive ZIP de « Sauvegarder mes données »)"),
	RESTORE_NEWER_VERSION(HttpStatus.CONFLICT, "Cette sauvegarde vient d'une version plus récente du site : mettez le site à jour avant de la restaurer"),
	RESTORE_NOT_READY(HttpStatus.CONFLICT, "La sauvegarde n'est pas prête : attendez la fin de l'envoi et de l'analyse"),
	RESTORE_CONFIRMATION_REQUIRED(HttpStatus.BAD_REQUEST, "Tapez REMPLACER pour confirmer le remplacement de toutes les données"),

	// Appearance presets
	APPEARANCE_PRESET_NOT_FOUND(HttpStatus.NOT_FOUND, "Préréglage introuvable"),
	APPEARANCE_PRESET_NAME_TAKEN(HttpStatus.CONFLICT, "Un préréglage porte déjà ce nom");

	private final HttpStatus status;

	private final String message;

	ErrorCode(HttpStatus status, String message) {
		this.status = status;
		this.message = message;
	}

	public HttpStatus status() {
		return status;
	}

	public String message() {
		return message;
	}

	/** Generic code for errors raised by Spring itself, which only carry an HTTP status. */
	static ErrorCode fromStatus(HttpStatusCode status) {
		return switch (status.value()) {
			case 401 -> UNAUTHENTICATED;
			case 403 -> ACCESS_DENIED;
			case 404 -> RESOURCE_NOT_FOUND;
			case 405 -> METHOD_NOT_ALLOWED;
			case 406 -> NOT_ACCEPTABLE;
			case 409 -> DATA_CONFLICT;
			case 413 -> CONTENT_TOO_LARGE;
			case 415 -> UNSUPPORTED_MEDIA_TYPE;
			default -> status.is5xxServerError() ? INTERNAL_ERROR : BAD_REQUEST;
		};
	}

}
