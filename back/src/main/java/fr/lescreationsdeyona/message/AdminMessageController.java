package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.message.MessageResponses.AdminMessage;
import fr.lescreationsdeyona.message.MessageResponses.GroupMember;
import fr.lescreationsdeyona.message.MessageResponses.Mention;
import fr.lescreationsdeyona.message.MessageResponses.MessageForm;
import fr.lescreationsdeyona.message.MessageResponses.MessagePage;
import fr.lescreationsdeyona.monitoring.AdminSeen;
import fr.lescreationsdeyona.monitoring.Unseen;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - Messages")
@RestController
@RequestMapping("/api/admin/messages")
@Validated
class AdminMessageController {

	private final AdminMessages messages;

	private final Mentions mentions;

	private final AdminSeen adminSeen;

	AdminMessageController(AdminMessages messages, Mentions mentions, AdminSeen adminSeen) {
		this.messages = messages;
		this.mentions = mentions;
		this.adminSeen = adminSeen;
	}

	@Operation(summary = "The messages between the admins, the latest first (90 days)")
	@GetMapping
	MessagePage listAdminMessages(@RequestParam(required = false) @Nullable Long before,
			@RequestParam(defaultValue = "50") @Min(1) @Max(AdminMessages.MAX_PAGE) int size) {
		return messages.page(before, size);
	}

	@Operation(summary = "Write to the other admins")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AdminMessage sendAdminMessage(@Valid @RequestBody MessageForm form) {
		return messages.send(form.body());
	}

	@Operation(summary = "Delete one of its own messages")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteAdminMessage(@PathVariable long id) {
		messages.delete(id);
	}

	@Operation(summary = "The messages of the others since this admin last opened the page: the badge of \"Messages\"")
	@GetMapping("/unseen")
	Unseen countUnseenMessages() {
		return messages.unseen();
	}

	@Operation(summary = "The messages are seen now: their badge goes")
	@PutMapping("/seen")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void markMessagesSeen() {
		adminSeen.mark(AdminSeen.Topic.MESSAGES, null);
	}

	@Operation(summary = "The admins of the group: every account allowed into the back-office")
	@GetMapping("/members")
	List<GroupMember> listMessageMembers() {
		return messages.members();
	}

	@Operation(summary = "What \"@\" offers: the recipes, articles, menus… whose name holds the text, 8 at most")
	@GetMapping("/mentions")
	List<Mention> searchMentions(@RequestParam(defaultValue = "") @Size(max = 60) String q) {
		return mentions.search(q);
	}

}
