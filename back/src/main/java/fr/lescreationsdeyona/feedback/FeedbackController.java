package fr.lescreationsdeyona.feedback;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Feedback")
@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
class FeedbackController {

	private final FeedbackService feedbackService;

	@Operation(summary = "\"Donner mon avis\": a visitor's message, read in the back-office",
			description = "No CSRF token: visitors have none. 5 messages an hour at most from an address.")
	@PostMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void sendFeedback(@Valid @RequestBody FeedbackForm form, HttpServletRequest request) {
		// The visitor's address, read from the proxies' headers (forward-headers-strategy), kept in memory only
		feedbackService.submit(form, request.getRemoteAddr());
	}

}
