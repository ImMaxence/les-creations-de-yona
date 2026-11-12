package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageProcessor;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.live.AdminLive;
import fr.lescreationsdeyona.live.LiveChange;
import fr.lescreationsdeyona.live.LiveTopic;
import fr.lescreationsdeyona.message.MessageResponses.AdminMessage;
import fr.lescreationsdeyona.message.MessageResponses.GroupMember;
import fr.lescreationsdeyona.message.MessageResponses.LinkPreview;
import fr.lescreationsdeyona.message.MessageResponses.MessageForm;
import fr.lescreationsdeyona.message.MessageResponses.MessagePage;
import fr.lescreationsdeyona.message.MessageResponses.MessagePhoto;
import fr.lescreationsdeyona.message.MessageResponses.PhotoForm;
import fr.lescreationsdeyona.message.MessageResponses.Typist;
import fr.lescreationsdeyona.monitoring.AdminSeen;
import fr.lescreationsdeyona.security.AdminProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * "Messages": what the admins write to each other, in groups (AdminGroups). Text, mentions of the
 * things of the site written in it, photos, and the preview of its first link, read on its page once
 * the message is sent (in the background: the message shows at once, its preview a moment later).
 * Kept 90 days, then erased every night with their photos; saved with the rest of the site by the
 * backups. Not in "Historique": it changes nothing of the site. Each change is told to the
 * back-offices open of the group's members (AdminLive).
 */
@Service
public class AdminMessages {

	static final Duration KEPT = Duration.ofDays(90);

	/** Characters of a message, its mentions written in: about 2,000 typed. */
	static final int MAX_BODY = 3000;

	static final int MAX_PHOTOS = 10;

	static final int MAX_PAGE = 100;

	/** Against a storm of messages (a key held down, a script): 8 in 10 seconds, 200 in an hour, the same text not twice in 30 seconds. */
	static final int BURST = 8;

	static final Duration BURST_WINDOW = Duration.ofSeconds(10);

	static final int PER_HOUR = 200;

	static final Duration REPEAT_WINDOW = Duration.ofSeconds(30);

	/** Photos sent for messages: 40 in 10 minutes. Pages read for previews: 60 in 10 minutes. */
	private final Pace photoPace = new Pace(40, Duration.ofMinutes(10), Clock.systemUTC());

	private final Pace previewPace = new Pace(60, Duration.ofMinutes(10), Clock.systemUTC());

	/** A photo sent and never put in a message (the message given up) is erased after this. */
	private static final Duration UNSENT_PHOTO_KEPT = Duration.ofDays(1);

	private static final Logger log = LoggerFactory.getLogger(AdminMessages.class);

	private final JdbcClient jdbc;

	private final AdminSeen adminSeen;

	private final AdminProperties admins;

	private final AdminGroups groups;

	private final ImageService imageService;

	private final LinkPreviews linkPreviews;

	private final TransactionTemplate transactions;

	private final ApplicationEventPublisher events;

	private final MessageTyping typing;

	private final AdminLive live;

	AdminMessages(JdbcClient jdbc, AdminSeen adminSeen, AdminProperties admins, AdminGroups groups, ImageService imageService,
			LinkPreviews linkPreviews, TransactionTemplate transactions, ApplicationEventPublisher events, MessageTyping typing,
			AdminLive live) {
		this.jdbc = jdbc;
		this.adminSeen = adminSeen;
		this.admins = admins;
		this.groups = groups;
		this.imageService = imageService;
		this.linkPreviews = linkPreviews;
		this.transactions = transactions;
		this.events = events;
		this.typing = typing;
		this.live = live;
	}

	/** The admin signed in writes in a group, said over HTTP by a page whose WebSocket is cut: the others are told as from a WebSocket. */
	public void typing(long groupId) {
		Author author = author();
		Set<String> members = typing.writing(groupId, author.email(), author.name());
		if (members.isEmpty()) {
			throw new ApiException(ErrorCode.ADMIN_GROUP_NOT_FOUND);
		}
		live.tellTyping(groupId, author.email(), author.name(), members);
	}

	/** Who writes in a group now, the admin asking left out. */
	public List<Typist> typists(long groupId) {
		String me = groups.me();
		groups.require(groupId, me);
		return typing.writers(groupId, me);
	}

	/** The latest first; {@code before}: the id of the oldest one shown, for those written before it. */
	public MessagePage page(long groupId, @Nullable Long before, int size) {
		groups.require(groupId, groups.me());
		int limit = Math.clamp(size, 1, MAX_PAGE);
		List<Row> found = jdbc.sql("""
				select * from admin_message where group_id = :group and (cast(:before as bigint) is null or id < :before)
				order by id desc limit :limit""")
			.param("group", groupId)
			.param("before", before)
			.param("limit", limit + 1)
			.query((row, index) -> {
				UUID linkImage = row.getObject("link_image_id", UUID.class);
				String url = row.getString("link_url");
				LinkPreview link = url == null ? null
						: new LinkPreview(url, row.getString("link_title"), row.getString("link_description"), row.getString("link_site"),
								linkImage, linkImage == null ? null : row.getObject("link_image_width", Integer.class),
								linkImage == null ? null : row.getObject("link_image_height", Integer.class));
				return new Row(row.getLong("id"), row.getLong("group_id"), row.getString("author_email"), row.getString("author_name"),
						row.getString("author_picture"), row.getString("body"), row.getObject("sent_at", OffsetDateTime.class).toInstant(), link);
			})
			.list();
		List<Row> shown = found.size() > limit ? found.subList(0, limit) : found;
		Map<Long, List<MessagePhoto>> photos = photosOf(shown.stream().map(Row::id).toList());
		return new MessagePage(shown.stream().map(row -> row.message(photos.getOrDefault(row.id(), List.of()))).toList(), found.size() > limit);
	}

	private record Row(long id, long groupId, String authorEmail, @Nullable String authorName, @Nullable String authorPicture, String body,
			Instant sentAt, @Nullable LinkPreview link) {

		AdminMessage message(List<MessagePhoto> photos) {
			return new AdminMessage(id, groupId, authorEmail, authorName, authorPicture, body, sentAt, photos, link);
		}

	}

	private Map<Long, List<MessagePhoto>> photosOf(List<Long> messageIds) {
		Map<Long, List<MessagePhoto>> photos = new HashMap<>();
		if (messageIds.isEmpty()) {
			return photos;
		}
		jdbc.sql("select message_id, image_id, width, height from admin_message_image where message_id in (:ids) order by message_id, position")
			.param("ids", messageIds)
			.query((row, index) -> Map.entry(row.getLong("message_id"),
					new MessagePhoto(row.getObject("image_id", UUID.class), row.getInt("width"), row.getInt("height"))))
			.list()
			.forEach(photo -> photos.computeIfAbsent(photo.getKey(), id -> new ArrayList<>()).add(photo.getValue()));
		return photos;
	}

	/** Before a photo is read: refused beyond 40 in 10 minutes for this admin. */
	public void checkPhotoPace() {
		if (!photoPace.allow(groups.me())) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_PHOTOS_TOO_MANY);
		}
	}

	/** A page read for the preview of a link: false beyond 60 in 10 minutes for this admin (no preview then). */
	public boolean allowPreview() {
		return previewPace.allow(groups.me());
	}

	/** A photo for a message being written, stored at once: the message, once sent, holds it. */
	@Transactional
	public MessagePhoto upload(ImageProcessor.Sized photo) {
		return new MessagePhoto(imageService.createMessageImage(photo.processed()).getId(), photo.width(), photo.height());
	}

	/** Written by the admin signed in, in a group they are in, with their name and photo as Google gives them. */
	@Transactional
	public AdminMessage send(MessageForm form) {
		Author author = author();
		AdminGroups.Group group = groups.require(form.groupId(), author.email());
		List<PhotoForm> photos = form.photos() == null ? List.of() : form.photos();
		String body = clean(form.body(), !photos.isEmpty());
		checkPace(author.email(), group.id(), body, !photos.isEmpty());
		checkUnsent(photos);
		Instant now = Instant.now();
		long id = jdbc.sql("""
				insert into admin_message (group_id, author_email, author_name, author_picture, body, sent_at)
				values (:group, :email, :name, :picture, :body, :at) returning id""")
			.param("group", group.id())
			.param("email", author.email())
			.param("name", author.name())
			.param("picture", author.picture())
			.param("body", body)
			.param("at", utc(now))
			.query(Long.class)
			.single();
		for (int position = 0; position < photos.size(); position++) {
			PhotoForm photo = photos.get(position);
			jdbc.sql("insert into admin_message_image (message_id, position, image_id, width, height) values (:id, :position, :image, :width, :height)")
				.param("id", id)
				.param("position", position)
				.param("image", photo.id())
				.param("width", photo.width())
				.param("height", photo.height())
				.update();
		}
		typing.sent(group.id(), author.email());
		Set<String> members = groups.members(group);
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES, members));
		String link = form.withoutPreview() ? null : MessageTexts.firstLink(body);
		LinkPreview preview = null;
		if (link != null) {
			// Read while it was written (shown under the field): kept with the message at once; otherwise read once sent
			Optional<Optional<LinkPreviews.Page>> read = linkPreviews.cached(link);
			if (read.isPresent()) {
				preview = writePreview(id, link, read.get().orElse(null));
			}
			else {
				afterCommit(() -> Thread.ofVirtual().name("link-preview-" + id).start(() -> attachPreview(id, link, members)));
			}
		}
		return new AdminMessage(id, group.id(), author.email(), author.name(), author.picture(), body, now,
				photos.stream().map(photo -> new MessagePhoto(photo.id(), photo.width(), photo.height())).toList(), preview);
	}

	/** Not too many at once, nor in an hour, nor the same text again at once (sent twice by a key held down). */
	private void checkPace(String email, long groupId, String body, boolean withPhotos) {
		Instant now = Instant.now();
		long burst = jdbc.sql("select count(*) from admin_message where lower(author_email) = :me and sent_at > :since")
			.param("me", email)
			.param("since", utc(now.minus(BURST_WINDOW)))
			.query(Long.class)
			.single();
		if (burst >= BURST) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_TOO_FAST);
		}
		long hour = jdbc.sql("select count(*) from admin_message where lower(author_email) = :me and sent_at > :since")
			.param("me", email)
			.param("since", utc(now.minus(Duration.ofHours(1))))
			.query(Long.class)
			.single();
		if (hour >= PER_HOUR) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_TOO_MANY);
		}
		if (!withPhotos && !body.isEmpty() && jdbc.sql("""
				select exists (select 1 from admin_message where lower(author_email) = :me and group_id = :group and body = :body
					and sent_at > :since and not exists (select 1 from admin_message_image i where i.message_id = admin_message.id))""")
			.param("me", email)
			.param("group", groupId)
			.param("body", body)
			.param("since", utc(now.minus(REPEAT_WINDOW)))
			.query(Boolean.class)
			.single()) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_REPEATED);
		}
	}

	/** Photos sent for a message, each once, held by no message nor group yet. */
	private void checkUnsent(List<PhotoForm> photos) {
		if (photos.isEmpty()) {
			return;
		}
		Set<UUID> ids = new HashSet<>(photos.stream().map(PhotoForm::id).toList());
		long unsent = jdbc.sql("""
				select count(*) from image i where i.id in (:ids) and i.kind = 'MESSAGE'
				and not exists (select 1 from admin_message_image m where m.image_id = i.id)
				and not exists (select 1 from admin_message m where m.link_image_id = i.id)
				and not exists (select 1 from admin_group g where g.image_id = i.id)""")
			.param("ids", ids)
			.query(Long.class)
			.single();
		if (ids.size() != photos.size() || unsent != ids.size()) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_PHOTO_GONE);
		}
	}

	/** In the background, once sent: the page of its link read, its preview kept with the message. */
	void attachPreview(long id, String url, Set<String> members) {
		try {
			LinkPreviews.Page page = linkPreviews.preview(url).orElse(null);
			if (transactions.execute(status -> writePreview(id, url, page)) != null) {
				events.publishEvent(new LiveChange(LiveTopic.MESSAGES, members));
			}
		}
		catch (RuntimeException ex) {
			log.warn("The preview of a link of message {} could not be kept", id, ex);
		}
	}

	/**
	 * The preview kept with the message, with its image; its address alone when the page could not be
	 * read (the card then names the site, as on a phone). Null when the message is gone meanwhile.
	 */
	private @Nullable LinkPreview writePreview(long id, String url, LinkPreviews.@Nullable Page page) {
		ImageProcessor.Sized image = page == null ? null : page.image();
		UUID imageId = image == null ? null : imageService.createMessageImage(image.processed()).getId();
		int updated = jdbc.sql("""
				update admin_message set link_url = :url, link_title = :title, link_description = :description, link_site = :site,
					link_image_id = :image, link_image_width = :width, link_image_height = :height
				where id = :id""")
			.param("url", page == null ? url : page.url())
			.param("title", page == null ? null : page.title())
			.param("description", page == null ? null : page.description())
			.param("site", page == null ? null : page.siteName())
			.param("image", imageId)
			.param("width", image == null ? null : image.width())
			.param("height", image == null ? null : image.height())
			.param("id", id)
			.update();
		if (updated == 0) {
			// Deleted meanwhile
			if (imageId != null) {
				imageService.deleteMessageImages(List.of(imageId));
			}
			return null;
		}
		return page == null ? new LinkPreview(url, null, null, null, null, null, null)
				: new LinkPreview(page.url(), page.title(), page.description(), page.siteName(), imageId,
						image == null ? null : image.width(), image == null ? null : image.height());
	}

	/** Its own message only, its photos with it. */
	@Transactional
	public void delete(long id) {
		String me = groups.me();
		Optional<Map<String, Object>> message = jdbc.sql("select group_id, author_email, link_image_id from admin_message where id = :id")
			.param("id", id)
			.query()
			.listOfRows()
			.stream()
			.findFirst();
		if (message.isEmpty()) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_NOT_FOUND);
		}
		if (!me.equalsIgnoreCase((String) message.get().get("author_email"))) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_NOT_YOURS);
		}
		List<UUID> photos = new ArrayList<>(jdbc.sql("select image_id from admin_message_image where message_id = :id")
			.param("id", id)
			.query(UUID.class)
			.list());
		if (message.get().get("link_image_id") instanceof UUID linkImage) {
			photos.add(linkImage);
		}
		long groupId = ((Number) message.get().get("group_id")).longValue();
		jdbc.sql("delete from admin_message where id = :id").param("id", id).update();
		imageService.deleteMessageImages(photos);
		Set<String> told = jdbc.sql("select g.id, g.name, g.image_id, g.everyone from admin_group g where g.id = :id")
			.param("id", groupId)
			.query((row, index) -> new AdminGroups.Group(row.getLong("id"), row.getString("name"), row.getObject("image_id", UUID.class),
					row.getBoolean("everyone")))
			.optional()
			.map(groups::members)
			.orElse(Set.of(me));
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES, told));
	}

	/** Every admin allowed into the back-office, named as in their last message. */
	public List<GroupMember> members() {
		Map<String, GroupMember> known = new HashMap<>();
		jdbc.sql("""
				select distinct on (lower(author_email)) lower(author_email) as email, author_name, author_picture
				from admin_message order by lower(author_email), id desc""")
			.query((row, index) -> new GroupMember(row.getString("email"), row.getString("author_name"), row.getString("author_picture")))
			.list()
			.forEach(member -> known.put(member.email(), member));
		// The admin asking is named by their Google account, even before their first message
		Author me = authorOrNull();
		if (me != null && me.name() != null) {
			known.put(me.email(), new GroupMember(me.email(), me.name(), me.picture()));
		}
		return admins.emails()
			.stream()
			.sorted()
			.map(email -> known.getOrDefault(email, new GroupMember(email, null, null)))
			.toList();
	}

	/**
	 * Every night: the messages older than 90 days, with their photos; and the photos sent for a
	 * message never sent (or left by a restore), a day after.
	 */
	@Scheduled(cron = "0 55 4 * * *", zone = "Europe/Paris")
	@Transactional
	public void eraseExpired() {
		OffsetDateTime before = utc(Instant.now().minus(KEPT));
		List<UUID> photos = new ArrayList<>(jdbc.sql("""
				select i.image_id from admin_message_image i join admin_message m on m.id = i.message_id where m.sent_at < :before
				union select m.link_image_id from admin_message m where m.sent_at < :before and m.link_image_id is not null""")
			.param("before", before)
			.query(UUID.class)
			.list());
		int erased = jdbc.sql("delete from admin_message where sent_at < :before").param("before", before).update();
		photos.addAll(jdbc.sql("""
				select i.id from image i where i.kind = 'MESSAGE' and i.created_at < :before
				and not exists (select 1 from admin_message_image m where m.image_id = i.id)
				and not exists (select 1 from admin_message m where m.link_image_id = i.id)
				and not exists (select 1 from admin_group g where g.image_id = i.id)""")
			.param("before", utc(Instant.now().minus(UNSENT_PHOTO_KEPT)))
			.query(UUID.class)
			.list());
		imageService.deleteMessageImages(photos);
		if (erased > 0 || !photos.isEmpty()) {
			log.info("{} message(s) between the admins erased after 90 days, {} photo(s) with them or never sent", erased, photos.size());
		}
	}

	/** The text as sent, without the blank lines and spaces around it; refused empty, unless photos go with it. */
	static String clean(@Nullable String text, boolean withPhotos) {
		String body = text == null ? "" : text.strip();
		if (body.isEmpty() && !withPhotos) {
			throw new ApiException(ErrorCode.ADMIN_MESSAGE_EMPTY);
		}
		if (body.length() > MAX_BODY) {
			throw new ApiException(ErrorCode.VALIDATION_FAILED);
		}
		return body;
	}

	private record Author(String email, @Nullable String name, @Nullable String picture) {
	}

	/** The admin signed in: their Google account, or only their email outside a Google login (tests). */
	private Author author() {
		Author author = authorOrNull();
		if (author == null) {
			throw new ApiException(ErrorCode.UNAUTHENTICATED);
		}
		return author;
	}

	private @Nullable Author authorOrNull() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.getPrincipal() instanceof OidcUser user && user.getEmail() != null) {
			return new Author(user.getEmail().toLowerCase(Locale.ROOT), user.getFullName(), user.getPicture());
		}
		return adminSeen.admin().map(email -> new Author(email.toLowerCase(Locale.ROOT), null, null)).orElse(null);
	}

	private static void afterCommit(Runnable action) {
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {

			@Override
			public void afterCommit() {
				action.run();
			}

		});
	}

	private static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}

}
