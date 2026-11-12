package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageProcessor;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.image.ImageStorage;
import fr.lescreationsdeyona.message.MessageResponses.AdminMessage;
import fr.lescreationsdeyona.message.MessageResponses.GroupForm;
import fr.lescreationsdeyona.message.MessageResponses.GroupMember;
import fr.lescreationsdeyona.message.MessageResponses.LinkPage;
import fr.lescreationsdeyona.message.MessageResponses.Mention;
import fr.lescreationsdeyona.message.MessageResponses.MessageForm;
import fr.lescreationsdeyona.message.MessageResponses.MessageGroup;
import fr.lescreationsdeyona.message.MessageResponses.MessagePage;
import fr.lescreationsdeyona.message.MessageResponses.MessagePhoto;
import fr.lescreationsdeyona.message.MessageResponses.Typist;
import fr.lescreationsdeyona.monitoring.Unseen;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.io.ByteArrayInputStream;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin - Messages")
@RestController
@RequestMapping("/api/admin/messages")
@Validated
class AdminMessageController {

	private static final String WEBP = "image/webp";

	/**
	 * Kept an hour in the browser of the admin, never by a proxy: a photo deleted does not stay a year on a
	 * computer (shared, perhaps) because it was once seen there.
	 */
	private static final CacheControl PRIVATE_HOUR = CacheControl.maxAge(Duration.ofHours(1)).cachePrivate();

	private final AdminMessages messages;

	private final AdminGroups groups;

	private final Mentions mentions;

	private final LinkPreviews linkPreviews;

	private final ImageProcessor imageProcessor;

	private final ImageService imageService;

	AdminMessageController(AdminMessages messages, AdminGroups groups, Mentions mentions, LinkPreviews linkPreviews,
			ImageProcessor imageProcessor, ImageService imageService) {
		this.messages = messages;
		this.groups = groups;
		this.mentions = mentions;
		this.linkPreviews = linkPreviews;
		this.imageProcessor = imageProcessor;
		this.imageService = imageService;
	}

	// Messages

	@Operation(summary = "The messages of a group, the latest first (90 days)")
	@GetMapping
	MessagePage listAdminMessages(@RequestParam long group, @RequestParam(required = false) @Nullable Long before,
			@RequestParam(defaultValue = "50") @Min(1) @Max(AdminMessages.MAX_PAGE) int size) {
		return messages.page(group, before, size);
	}

	@Operation(summary = "Write to a group: text, photos sent before, or both")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	AdminMessage sendAdminMessage(@Valid @RequestBody MessageForm form) {
		return messages.send(form);
	}

	@Operation(summary = "Delete one of its own messages, with its photos")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteAdminMessage(@PathVariable long id) {
		messages.delete(id);
	}

	@Operation(summary = "A photo for a message being written (JPEG or PNG, any shape): sent with the message by its id")
	@PostMapping(path = "/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	MessagePhoto uploadMessagePhoto(@RequestPart("file") MultipartFile file) {
		messages.checkPhotoPace();
		return messages.upload(imageProcessor.processMessage(file));
	}

	@Operation(summary = "A photo of the messages (sent, of a group, of a link's preview), 800 or 1600 px wide",
			description = "Only of a group the admin is in.",
			responses = @ApiResponse(responseCode = "200", content = @Content(mediaType = WEBP, schema = @Schema(type = "string", format = "binary"))))
	@GetMapping("/images/{id}/{width:800|1600}.webp")
	ResponseEntity<InputStreamResource> getMessageImage(@PathVariable UUID id, @PathVariable int width) {
		if (!groups.canSeePhoto(id, groups.me())) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND);
		}
		ImageStorage.StoredFile file = imageService.openMessageImage(id, width);
		return ResponseEntity.ok()
			.cacheControl(PRIVATE_HOUR)
			.contentType(MediaType.parseMediaType(WEBP))
			.contentLength(file.size())
			.body(new InputStreamResource(file.content()));
	}

	@Operation(summary = "The preview of a link being written: the title, the text and the image of its page",
			description = "Read by the server on public addresses only; 204 when the page has nothing to show.")
	@GetMapping("/link-preview")
	ResponseEntity<LinkPage> previewMessageLink(@RequestParam @Size(max = 2000) String url) {
		if (linkPreviews.cached(url).isEmpty() && !messages.allowPreview()) {
			return ResponseEntity.noContent().build();
		}
		return linkPreviews.preview(url)
			.map(page -> ResponseEntity.ok()
				.cacheControl(CacheControl.maxAge(Duration.ofMinutes(30)).cachePrivate())
				.body(new LinkPage(page.url(), page.title(), page.description(), page.siteName(), page.image() != null,
						page.image() == null ? null : page.image().width(), page.image() == null ? null : page.image().height())))
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

	@Operation(summary = "The image of a link's preview, before sending",
			responses = @ApiResponse(responseCode = "200", content = @Content(mediaType = WEBP, schema = @Schema(type = "string", format = "binary"))))
	@GetMapping("/link-preview/image")
	ResponseEntity<InputStreamResource> getMessageLinkImage(@RequestParam @Size(max = 2000) String url) {
		ImageProcessor.Sized image = linkPreviews.preview(url).map(LinkPreviews.Page::image).orElseThrow(() -> new ApiException(ErrorCode.IMAGE_NOT_FOUND));
		byte[] webp = image.processed().variants().getFirst().webp();
		return ResponseEntity.ok()
			.cacheControl(CacheControl.maxAge(Duration.ofMinutes(30)).cachePrivate())
			.contentType(MediaType.parseMediaType(WEBP))
			.contentLength(webp.length)
			.body(new InputStreamResource(new ByteArrayInputStream(webp)));
	}

	@Operation(summary = "This admin writes in a group: \"est en train d'écrire\" told to the other members",
			description = "For a page whose WebSocket is cut; the others are told through theirs.")
	@PostMapping("/typing")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void sayMessageTyping(@RequestParam long group) {
		messages.typing(group);
	}

	@Operation(summary = "Who writes in a group now, this admin left out", description = "Asked every few seconds by a page whose WebSocket is cut.")
	@GetMapping("/typing")
	List<Typist> listMessageTypists(@RequestParam long group) {
		return messages.typists(group);
	}

	@Operation(summary = "The messages of the others in the groups of this admin since they last read each: the badge of \"Messages\"")
	@GetMapping("/unseen")
	Unseen countUnseenMessages() {
		return groups.unseen();
	}

	@Operation(summary = "The messages of a group are read now: its badge goes")
	@PutMapping("/seen")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void markMessagesSeen(@RequestParam long group) {
		groups.markSeen(group);
	}

	@Operation(summary = "The admins: every account allowed into the back-office, to choose the members of a group")
	@GetMapping("/members")
	List<GroupMember> listMessageMembers() {
		return messages.members();
	}

	@Operation(summary = "What \"@\" offers: the recipes, articles, menus… whose name holds the text, 8 at most")
	@GetMapping("/mentions")
	List<Mention> searchMentions(@RequestParam(defaultValue = "") @Size(max = 60) String q) {
		return mentions.search(q);
	}

	// Groups

	@Operation(summary = "The groups of this admin, the latest written in first; the group of all the admins among them")
	@GetMapping("/groups")
	List<MessageGroup> listMessageGroups() {
		return groups.list();
	}

	@Operation(summary = "A new group: its name and the admins chosen, the one making it among them")
	@PostMapping("/groups")
	@ResponseStatus(HttpStatus.CREATED)
	MessageGroup createMessageGroup(@Valid @RequestBody GroupForm form) {
		return groups.create(form);
	}

	@Operation(summary = "Rename a group, or change its members (any member may); the members of the group of all do not change")
	@PutMapping("/groups/{id}")
	MessageGroup updateMessageGroup(@PathVariable long id, @Valid @RequestBody GroupForm form) {
		return groups.update(id, form);
	}

	@Operation(summary = "Delete a group for every member, with its messages and photos; not the group of all")
	@DeleteMapping("/groups/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void deleteMessageGroup(@PathVariable long id) {
		groups.delete(id);
	}

	@Operation(summary = "Leave a group; the last member out deletes it")
	@PostMapping("/groups/{id}/leave")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void leaveMessageGroup(@PathVariable long id) {
		groups.leave(id);
	}

	@Operation(summary = "The photo of a group (JPEG or PNG), in place of the one before")
	@PutMapping(path = "/groups/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	MessageGroup setMessageGroupPhoto(@PathVariable long id, @RequestPart("file") MultipartFile file) {
		messages.checkPhotoPace();
		return groups.setPhoto(id, imageProcessor.processMessage(file));
	}

	@Operation(summary = "Take the photo off a group")
	@DeleteMapping("/groups/{id}/photo")
	MessageGroup removeMessageGroupPhoto(@PathVariable long id) {
		return groups.removePhoto(id);
	}

}
