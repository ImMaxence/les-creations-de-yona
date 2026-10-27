package fr.lescreationsdeyona.error;

import static org.assertj.core.api.Assertions.assertThat;

import org.apache.tomcat.util.http.InvalidParameterException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

class ApiExceptionHandlerTest {

	private final ApiExceptionHandler handler = new ApiExceptionHandler();

	@Test
	void answersAnUndecodableParameterWithA400() {
		ResponseEntity<Object> response = handler.handleInvalidParameter(
				new InvalidParameterException("Character decoding failed"),
				new ServletWebRequest(new MockHttpServletRequest("GET", "/api/recipes")));

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		ProblemDetail problem = (ProblemDetail) response.getBody();
		assertThat(problem).isNotNull();
		assertThat(problem.getProperties()).containsEntry("code", "BAD_REQUEST");
		assertThat(problem.getDetail()).isEqualTo("La requête est invalide.");
	}

}
