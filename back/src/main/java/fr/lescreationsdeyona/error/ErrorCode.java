package fr.lescreationsdeyona.error;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

/**
 * Stable error codes sent to the front in the {@code code} property of every ProblemDetail.
 * The message is the French text shown to the user.
 */
public enum ErrorCode {

	// Generic, also used for framework and security errors.
	BAD_REQUEST(HttpStatus.BAD_REQUEST, "La requête est invalide."),
	VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Certains champs sont invalides."),
	INVALID_SORT(HttpStatus.BAD_REQUEST, "Ce tri n'est pas autorisé."),
	UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Veuillez vous connecter."),
	ACCESS_DENIED(HttpStatus.FORBIDDEN, "Vous n'avez pas accès à cette ressource."),
	CSRF_TOKEN_INVALID(HttpStatus.FORBIDDEN, "Votre session a expiré, rechargez la page."),
	RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "Ressource introuvable."),
	METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "Cette opération n'est pas autorisée."),
	NOT_ACCEPTABLE(HttpStatus.NOT_ACCEPTABLE, "Ce format de réponse n'est pas disponible."),
	CONTENT_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "Le contenu envoyé est trop volumineux."),
	UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Ce format de contenu n'est pas pris en charge."),
	DATA_CONFLICT(HttpStatus.CONFLICT, "L'opération entre en conflit avec des données existantes."),
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Une erreur inattendue est survenue, réessayez plus tard."),

	// Recipes
	RECIPE_NOT_FOUND(HttpStatus.NOT_FOUND, "Recette introuvable."),
	FEATURED_RECIPE_MUST_BE_PUBLISHED(HttpStatus.BAD_REQUEST, "Seule une recette publiée peut être mise à la une."),
	DUPLICATE_RECIPE_INGREDIENT(HttpStatus.BAD_REQUEST, "Un même ingrédient apparaît plusieurs fois dans la recette."),

	// Categories
	CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, "Catégorie introuvable."),
	CATEGORY_IN_USE(HttpStatus.CONFLICT, "Cette catégorie contient encore des recettes."),

	// Ingredients
	INGREDIENT_NOT_FOUND(HttpStatus.NOT_FOUND, "Ingrédient introuvable."),
	INGREDIENT_ALREADY_EXISTS(HttpStatus.CONFLICT, "Cet ingrédient existe déjà."),
	INGREDIENT_IN_USE(HttpStatus.CONFLICT, "Cet ingrédient est utilisé dans au moins une recette."),

	// Social links
	DUPLICATE_SOCIAL_PLATFORM(HttpStatus.BAD_REQUEST, "Chaque réseau social ne peut apparaître qu'une seule fois.");

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
