package fr.lescreationsdeyona.error;

/** Business error turned into a ProblemDetail by {@link ApiExceptionHandler}. */
public class ApiException extends RuntimeException {

	private final ErrorCode code;

	public ApiException(ErrorCode code) {
		super(code.message());
		this.code = code;
	}

	/** With a detail more precise than the code's message, e.g. naming the items concerned. */
	public ApiException(ErrorCode code, String detail) {
		super(detail);
		this.code = code;
	}

	public ApiException(ErrorCode code, Throwable cause) {
		super(code.message(), cause);
		this.code = code;
	}

	public ErrorCode getCode() {
		return code;
	}

}
