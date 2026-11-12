package fr.lescreationsdeyona.message;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.ImageProcessor;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.live.LiveChange;
import fr.lescreationsdeyona.live.LiveTopic;
import fr.lescreationsdeyona.message.MessageResponses.GroupForm;
import fr.lescreationsdeyona.message.MessageResponses.LastMessage;
import fr.lescreationsdeyona.message.MessageResponses.MessageGroup;
import fr.lescreationsdeyona.monitoring.AdminSeen;
import fr.lescreationsdeyona.monitoring.Unseen;
import fr.lescreationsdeyona.security.AdminProperties;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The groups of "Messages". The group of all the admins holds every account allowed into the
 * back-office ({@code APP_ADMIN_EMAILS}), and stays: renamed, given a photo, never left nor deleted.
 * The others have the members chosen when made, and each of them may rename the group, change its
 * photo, add or take out members, leave it or delete it. An admin sees only the groups they are in:
 * their messages, their photos, who writes in them. Not in "Historique": they change nothing of the site.
 */
@Service
public class AdminGroups {

	static final int MAX_NAME = 60;

	/** The last message of a group, as its list shows it. */
	private static final int EXCERPT = 140;

	private final JdbcClient jdbc;

	private final AdminProperties admins;

	private final AdminSeen adminSeen;

	private final ImageService imageService;

	private final ApplicationEventPublisher events;

	AdminGroups(JdbcClient jdbc, AdminProperties admins, AdminSeen adminSeen, ImageService imageService, ApplicationEventPublisher events) {
		this.jdbc = jdbc;
		this.admins = admins;
		this.adminSeen = adminSeen;
		this.imageService = imageService;
		this.events = events;
	}

	/** A group as the other services need it. */
	record Group(long id, String name, @Nullable UUID imageId, boolean everyone) {
	}

	/** The groups of the admin asking, the latest written in first. */
	public List<MessageGroup> list() {
		String me = me();
		Instant fallback = firstVisit();
		List<MessageGroup> groups = jdbc.sql("""
				select g.id, g.name, g.image_id, g.everyone, g.created_at, s.seen_at,
					last.author_email, last.author_name, last.body, last.sent_at, last.photos,
					(select count(*) from admin_message m where m.group_id = g.id and lower(m.author_email) <> :me
						and m.sent_at > coalesce(s.seen_at, :fallback)) as unseen
				from admin_group g
				left join admin_group_seen s on s.group_id = g.id and s.admin_email = :me
				left join lateral (
					select m.author_email, m.author_name, m.body, m.sent_at,
						(select count(*) from admin_message_image i where i.message_id = m.id) as photos
					from admin_message m where m.group_id = g.id order by m.id desc limit 1) last on true
				where """ + VISIBLE + """
				order by coalesce(last.sent_at, g.created_at) desc, g.id""")
			.param("me", me)
			.param("fallback", utc(fallback))
			.query((row, index) -> {
				OffsetDateTime seen = row.getObject("seen_at", OffsetDateTime.class);
				OffsetDateTime sent = row.getObject("sent_at", OffsetDateTime.class);
				LastMessage last = sent == null ? null
						: new LastMessage(row.getString("author_email"), row.getString("author_name"),
								MessageTexts.excerpt(row.getString("body"), EXCERPT), row.getInt("photos"), sent.toInstant());
				return new MessageGroup(row.getLong("id"), row.getString("name"), row.getObject("image_id", UUID.class),
						row.getBoolean("everyone"), List.of(), row.getLong("unseen"), seen == null ? fallback : seen.toInstant(), last,
						row.getObject("created_at", OffsetDateTime.class).toInstant());
			})
			.list();
		Map<Long, List<String>> members = membersOf(groups.stream().filter(group -> !group.everyone()).map(MessageGroup::id).toList());
		List<String> everyone = everyone();
		return groups.stream()
			.map(group -> new MessageGroup(group.id(), group.name(), group.imageId(), group.everyone(),
					group.everyone() ? everyone : members.getOrDefault(group.id(), List.of()), group.unseen(), group.since(), group.last(),
					group.createdAt()))
			.toList();
	}

	/** One group of the admin asking, as the list shows it. */
	public MessageGroup get(long id) {
		return list().stream().filter(group -> group.id() == id).findFirst().orElseThrow(() -> new ApiException(ErrorCode.ADMIN_GROUP_NOT_FOUND));
	}

	/** A new group: its name, the admins chosen and the one making it. */
	@Transactional
	public MessageGroup create(GroupForm form) {
		String me = me();
		Set<String> members = chosen(form.members(), me);
		Instant now = Instant.now();
		long id = jdbc.sql("""
				insert into admin_group (name, everyone, created_by, created_at, updated_by, updated_at)
				values (:name, false, :me, :at, :me, :at) returning id""")
			.param("name", name(form.name()))
			.param("me", me)
			.param("at", utc(now))
			.query(Long.class)
			.single();
		writeMembers(id, members);
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES, members));
		return get(id);
	}

	/** Its name, and its members (the admin changing it stays one: "Quitter le groupe" for that). */
	@Transactional
	public MessageGroup update(long id, GroupForm form) {
		String me = me();
		Group group = require(id, me);
		Set<String> told = new HashSet<>(members(group));
		jdbc.sql("update admin_group set name = :name, updated_by = :me, updated_at = :at where id = :id")
			.param("name", name(form.name()))
			.param("me", me)
			.param("at", utc(Instant.now()))
			.param("id", id)
			.update();
		if (!group.everyone()) {
			Set<String> members = chosen(form.members(), me);
			jdbc.sql("delete from admin_group_member where group_id = :id").param("id", id).update();
			writeMembers(id, members);
			told.addAll(members);
		}
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES, told));
		return get(id);
	}

	/** Its photo, in place of the one before (gone for good). */
	@Transactional
	public MessageGroup setPhoto(long id, ImageProcessor.Sized photo) {
		String me = me();
		Group group = require(id, me);
		UUID imageId = imageService.createMessageImage(photo.processed()).getId();
		changePhoto(group, imageId, me);
		return get(id);
	}

	@Transactional
	public MessageGroup removePhoto(long id) {
		String me = me();
		changePhoto(require(id, me), null, me);
		return get(id);
	}

	private void changePhoto(Group group, @Nullable UUID imageId, String me) {
		jdbc.sql("update admin_group set image_id = :image, updated_by = :me, updated_at = :at where id = :id")
			.param("image", imageId)
			.param("me", me)
			.param("at", utc(Instant.now()))
			.param("id", group.id())
			.update();
		if (group.imageId() != null) {
			imageService.deleteMessageImages(List.of(group.imageId()));
		}
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES, members(group)));
	}

	/** For every member: its messages and their photos go with it. */
	@Transactional
	public void delete(long id) {
		Group group = require(id, me());
		if (group.everyone()) {
			throw new ApiException(ErrorCode.ADMIN_GROUP_EVERYONE);
		}
		Set<String> told = members(group);
		erase(group);
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES, told));
	}

	/** Out of the group; the last one out deletes it. */
	@Transactional
	public void leave(long id) {
		String me = me();
		Group group = require(id, me);
		if (group.everyone()) {
			throw new ApiException(ErrorCode.ADMIN_GROUP_EVERYONE);
		}
		Set<String> told = members(group);
		jdbc.sql("delete from admin_group_member where group_id = :id and email = :me").param("id", id).param("me", me).update();
		jdbc.sql("delete from admin_group_seen where group_id = :id and admin_email = :me").param("id", id).param("me", me).update();
		if (jdbc.sql("select count(*) from admin_group_member where group_id = :id").param("id", id).query(Long.class).single() == 0) {
			erase(group);
		}
		events.publishEvent(new LiveChange(LiveTopic.MESSAGES, told));
	}

	private void erase(Group group) {
		List<UUID> photos = new ArrayList<>(jdbc.sql("""
				select i.image_id from admin_message_image i join admin_message m on m.id = i.message_id where m.group_id = :id
				union select m.link_image_id from admin_message m where m.group_id = :id and m.link_image_id is not null""")
			.param("id", group.id())
			.query(UUID.class)
			.list());
		if (group.imageId() != null) {
			photos.add(group.imageId());
		}
		jdbc.sql("delete from admin_group where id = :id").param("id", group.id()).update();
		jdbc.sql("delete from admin_group_seen where group_id = :id").param("id", group.id()).update();
		imageService.deleteMessageImages(photos);
	}

	/** Read now by the admin asking: its badge goes. */
	public void markSeen(long id) {
		String me = me();
		require(id, me);
		jdbc.sql("""
				insert into admin_group_seen (group_id, admin_email, seen_at) values (:id, :me, :at)
				on conflict (group_id, admin_email) do update set seen_at = excluded.seen_at""")
			.param("id", id)
			.param("me", me)
			.param("at", utc(Instant.now()))
			.update();
	}

	/** The badge of "Messages": what the others wrote in the groups of the admin asking since they last read each. */
	public Unseen unseen() {
		Instant fallback = firstVisit();
		long count = adminSeen.admin().map(admin -> jdbc.sql("""
				select count(*) from admin_message m join admin_group g on g.id = m.group_id
				left join admin_group_seen s on s.group_id = g.id and s.admin_email = :me
				where""" + " " + VISIBLE + """
				and lower(m.author_email) <> :me and m.sent_at > coalesce(s.seen_at, :fallback)""")
			.param("me", admin.toLowerCase(Locale.ROOT))
			.param("fallback", utc(fallback))
			.query(Long.class)
			.single()).orElse(0L);
		return new Unseen(count, fallback);
	}

	/** The group, if {@code email} is in it. */
	Group require(long id, String email) {
		return find(id, email).orElseThrow(() -> new ApiException(ErrorCode.ADMIN_GROUP_NOT_FOUND));
	}

	private Optional<Group> find(long id, String email) {
		return jdbc.sql("select g.id, g.name, g.image_id, g.everyone from admin_group g where g.id = :id and " + VISIBLE)
			.param("id", id)
			.param("me", email.toLowerCase(Locale.ROOT))
			.query((row, index) -> new Group(row.getLong("id"), row.getString("name"), row.getObject("image_id", UUID.class),
					row.getBoolean("everyone")))
			.optional();
	}

	/** Its members: every admin for the group of all. */
	Set<String> members(Group group) {
		return group.everyone() ? new TreeSet<>(admins.emails()) : new TreeSet<>(membersOf(List.of(group.id())).getOrDefault(group.id(), List.of()));
	}

	/** The members of the group, if {@code writer} is one of them: told "est en train d'écrire…". */
	Set<String> audience(long groupId, String writer) {
		return find(groupId, writer).map(this::members).orElse(Set.of());
	}

	/** A photo of the messages {@code email} may see: of a group they are in, or of a message there. */
	boolean canSeePhoto(UUID imageId, String email) {
		return jdbc.sql("""
				select exists (select 1 from admin_group g where""" + " " + VISIBLE + """
					and (g.image_id = :image
						or exists (select 1 from admin_message m where m.group_id = g.id and m.link_image_id = :image)
						or exists (select 1 from admin_message_image i join admin_message m on m.id = i.message_id
							where m.group_id = g.id and i.image_id = :image)))""")
			.param("me", email.toLowerCase(Locale.ROOT))
			.param("image", imageId)
			.query(Boolean.class)
			.single();
	}

	/** {@code g} is a group {@code :me} is in. */
	private static final String VISIBLE = "(g.everyone or exists (select 1 from admin_group_member gm where gm.group_id = g.id and gm.email = :me))\n";

	private Map<Long, List<String>> membersOf(Collection<Long> ids) {
		Map<Long, List<String>> members = new HashMap<>();
		if (ids.isEmpty()) {
			return members;
		}
		jdbc.sql("select group_id, email from admin_group_member where group_id in (:ids) order by email")
			.param("ids", ids)
			.query((row, index) -> Map.entry(row.getLong("group_id"), row.getString("email")))
			.list()
			.forEach(member -> members.computeIfAbsent(member.getKey(), id -> new ArrayList<>()).add(member.getValue()));
		return members;
	}

	private List<String> everyone() {
		return admins.emails().stream().sorted().toList();
	}

	private void writeMembers(long id, Set<String> members) {
		for (String email : members) {
			jdbc.sql("insert into admin_group_member (group_id, email) values (:id, :email)").param("id", id).param("email", email).update();
		}
	}

	/** The admins chosen and the one choosing, in lower case: two at least, admins only. */
	private Set<String> chosen(@Nullable List<String> emails, String me) {
		Set<String> members = new TreeSet<>();
		members.add(me);
		for (String email : emails == null ? List.<String>of() : emails) {
			String member = email.strip().toLowerCase(Locale.ROOT);
			if (!admins.isAdmin(member)) {
				throw new ApiException(ErrorCode.ADMIN_GROUP_NOT_ADMIN);
			}
			members.add(member);
		}
		if (members.size() < 2) {
			throw new ApiException(ErrorCode.ADMIN_GROUP_TOO_SMALL);
		}
		return members;
	}

	/** The name as typed, on one line, without the spaces around it. */
	static String name(String typed) {
		String name = typed.replaceAll("\\s+", " ").strip();
		if (name.isEmpty()) {
			throw new ApiException(ErrorCode.VALIDATION_FAILED);
		}
		return name.length() > MAX_NAME ? name.substring(0, MAX_NAME).strip() : name;
	}

	/** The admin asking, in lower case. */
	String me() {
		return adminSeen.admin().map(email -> email.toLowerCase(Locale.ROOT)).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED));
	}

	/**
	 * Since when a group never opened counts its messages as new: the last visit of "Messages" before
	 * the groups (2.9), or the last 7 days the first time.
	 */
	private Instant firstVisit() {
		return adminSeen.of(AdminSeen.Topic.MESSAGES).map(AdminSeen.Mark::at).orElseGet(() -> Instant.now().minus(Unseen.FIRST_TIME));
	}

	private static OffsetDateTime utc(Instant instant) {
		return instant.atOffset(ZoneOffset.UTC);
	}

}
