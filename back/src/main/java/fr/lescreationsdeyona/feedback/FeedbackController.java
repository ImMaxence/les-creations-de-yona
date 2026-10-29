package fr.lescreationsdeyona.feedback;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
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
			description = "No CSRF token: visitors have none. From an address, one message a minute and 5 an hour at "
					+ "most; 30 an hour for the whole site; the same message sent twice is kept once.")
	@PostMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void sendFeedback(@Valid @RequestBody FeedbackForm form, HttpServletRequest request) {
		feedbackService.submit(form, senderOf(request));
	}

	/**
	 * The visitor's address, kept in memory only. Cloudflare gives it in CF-Connecting-IP, which it
	 * always overwrites; without it (locally), the address read from the proxies' headers
	 * (forward-headers-strategy).
	 */
	static String senderOf(HttpServletRequest request) {
		String cloudflare = request.getHeader("CF-Connecting-IP");
		return StringUtils.hasText(cloudflare) && cloudflare.length() <= 45 ? cloudflare.strip() : request.getRemoteAddr();
	}

}
