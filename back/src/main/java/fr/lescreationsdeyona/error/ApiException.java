package fr.lescreationsdeyona.error;

/** Business error turned into a ProblemDetail by {@link ApiExceptionHandler}. */
public class ApiException extends RuntimeException {

	private final ErrorCode code;

	public ApiException(ErrorCode code) {
		super(code.message());
		this.code = code;
	}

	public ErrorCode getCode() {
		return code;
	}

}
