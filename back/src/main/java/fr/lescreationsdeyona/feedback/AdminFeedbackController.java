package fr.lescreationsdeyona.feedback;

import fr.lescreationsdeyona.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Feedback")
@RestController
@RequestMapping("/api/admin/feedback")
@RequiredArgsConstructor
class AdminFeedbackController {

	private final FeedbackService feedbackService;

	/** The number of unread messages, beside "Retours" in the back-office menu. */
	record UnreadCount(long count) {
	}

	@Operation(summary = "The visitors' messages, the latest first")
	@GetMapping
	PageResponse<FeedbackResponse> listFeedback(@ParameterObject @PageableDefault(size = 20) Pageable pageable) {
		return feedbackService.list(pageable);
	}

	@Operation(summary = "The number of unread messages")
	@GetMapping("/unread")
	UnreadCount countUnreadFeedback() {
		return new UnreadCount(feedbackService.unreadCount());
	}

	@Operation(summary = "Mark messages as read, or unread again (read=false)")
	@PutMapping("/read")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void markFeedbackRead(@RequestParam @NotEmpty @Size(max = 100) List<Long> ids,
			@RequestParam(defaultValue = "true") boolean read) {
		feedbackService.markRead(ids, read);
	}

	@Operation(summary = "Delete messages for good, all or none")
	@DeleteMapping
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteFeedback(@RequestParam @NotEmpty @Size(max = 100) List<Long> ids) {
		feedbackService.deleteAll(ids);
	}

}
