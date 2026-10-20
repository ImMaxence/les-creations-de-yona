package fr.lescreationsdeyona.error;

/** One invalid field of a request, listed in the {@code errors} property of a validation ProblemDetail. */
public record FieldViolation(String field, String message) {
}
