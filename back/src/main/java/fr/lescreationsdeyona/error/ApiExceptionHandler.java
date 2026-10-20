package fr.lescreationsdeyona.error;

import java.util.List;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import software.amazon.awssdk.core.exception.SdkException;

/**
 * Turns every error into an RFC 9457 ProblemDetail carrying a stable {@code code} and a French
 * {@code detail}, so the front can show any error the same way.
 */
@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

	private static final String CODE = "code";

	private static final String ERRORS = "errors";

	@ExceptionHandler(ApiException.class)
	ResponseEntity<Object> handleApiException(ApiException ex, WebRequest request) {
		return respond(ex, ex.getCode(), request);
	}

	@ExceptionHandler(AuthenticationException.class)
	ResponseEntity<Object> handleAuthenticationException(AuthenticationException ex, WebRequest request) {
		return respond(ex, ErrorCode.UNAUTHENTICATED, request);
	}

	@ExceptionHandler(AccessDeniedException.class)
	ResponseEntity<Object> handleAccessDeniedException(AccessDeniedException ex, WebRequest request) {
		ErrorCode code = ex instanceof CsrfException ? ErrorCode.CSRF_TOKEN_INVALID : ErrorCode.ACCESS_DENIED;
		return respond(ex, code, request);
	}

	/** Safety net when a database constraint rejects a write the services did not anticipate. */
	@ExceptionHandler(DataIntegrityViolationException.class)
	ResponseEntity<Object> handleDataIntegrityViolation(DataIntegrityViolationException ex, WebRequest request) {
		log.warn("Database constraint violated: {}", ex.getMostSpecificCause().getMessage());
		return respond(ex, ErrorCode.DATA_CONFLICT, request);
	}

	@ExceptionHandler(SdkException.class)
	ResponseEntity<Object> handleStorageException(SdkException ex, WebRequest request) {
		log.error("S3 storage error", ex);
		return respond(ex, ErrorCode.STORAGE_UNAVAILABLE, request);
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<Object> handleUnexpectedException(Exception ex, WebRequest request) {
		log.error("Unexpected error", ex);
		return respond(ex, ErrorCode.INTERNAL_ERROR, request);
	}

	@Override
	protected @Nullable ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<FieldViolation> violations = ex.getBindingResult()
			.getAllErrors()
			.stream()
			.map(error -> new FieldViolation(
					error instanceof FieldError fieldError ? fieldError.getField() : error.getObjectName(),
					error.getDefaultMessage()))
			.toList();
		return handleExceptionInternal(ex, validationProblem(violations), headers, status, request);
	}

	@Override
	protected @Nullable ResponseEntity<Object> handleHandlerMethodValidationException(
			HandlerMethodValidationException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<FieldViolation> violations = ex.getParameterValidationResults()
			.stream()
			.flatMap(result -> result.getResolvableErrors()
				.stream()
				.map(MessageSourceResolvable::getDefaultMessage)
				.map(message -> new FieldViolation(result.getMethodParameter().getParameterName(), message)))
			.toList();
		return handleExceptionInternal(ex, validationProblem(violations), headers, status, request);
	}

	/** Image uploads are the only multipart requests. */
	@Override
	protected @Nullable ResponseEntity<Object> handleMaxUploadSizeExceededException(
			MaxUploadSizeExceededException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		return handleExceptionInternal(ex, problem(ErrorCode.IMAGE_TOO_LARGE), headers, status, request);
	}

	/** Every response goes through here: framework errors only get a generic code for their status. */
	@Override
	protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body, HttpHeaders headers,
			HttpStatusCode statusCode, WebRequest request) {
		boolean hasCode = body instanceof ProblemDetail problem && problem.getProperties() != null
				&& problem.getProperties().containsKey(CODE);
		Object problemBody = hasCode ? body : problem(ErrorCode.fromStatus(statusCode));
		return super.handleExceptionInternal(ex, problemBody, headers, statusCode, request);
	}

	private ResponseEntity<Object> respond(Exception ex, ErrorCode code, WebRequest request) {
		return handleExceptionInternal(ex, problem(code), new HttpHeaders(), code.status(), request);
	}

	private static ProblemDetail problem(ErrorCode code) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(code.status(), code.message());
		problem.setProperty(CODE, code.name());
		return problem;
	}

	private static ProblemDetail validationProblem(List<FieldViolation> violations) {
		ProblemDetail problem = problem(ErrorCode.VALIDATION_FAILED);
		problem.setProperty(ERRORS, violations);
		return problem;
	}

}
