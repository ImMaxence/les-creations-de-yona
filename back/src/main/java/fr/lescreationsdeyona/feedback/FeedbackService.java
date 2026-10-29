package fr.lescreationsdeyona.feedback;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.PageResponse;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Messages of the visitors ("Donner mon avis"), read in the back-office. Without a captcha (and
 * its third-party service): a field hidden from people catches robots; an address sends one
 * message a minute and 5 an hour at most (remembered in memory only, never written); the same
 * message sent again within the hour is kept once; the whole site takes 30 messages an hour at
 * most, whatever the addresses; and the unread ones stop at 500. Kept 12 months at most.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedbackService {

	static final int PER_HOUR = 5;

	/** Between two messages of an address: a double tap, or a script, is stopped at once. */
	static final Duration MIN_INTERVAL = Duration.ofMinutes(1);

	/** For the whole site: many addresses (a botnet) cannot flood the back-office either. */
	static final int SITE_PER_HOUR = 30;

	static final int MAX_UNREAD = 500;

	static final Duration KEPT = Duration.ofDays(365);

	private static final Logger log = LoggerFactory.getLogger(FeedbackService.class);

	private final FeedbackRepository repository;

	private final AuditLog auditLog;

	/** Times of the last messages, by address of the sender: forgotten after an hour. */
	private final Map<String, Deque<Instant>> sentBy = new ConcurrentHashMap<>();

	/** Times of the last messages, all senders together. */
	private final Deque<Instant> sentBySite = new ArrayDeque<>();

	/** Folded messages of the last hour, with their time: a message sent twice is kept once. */
	private final Map<String, Instant> recentMessages = new ConcurrentHashMap<>();

	@Transactional
	public void submit(FeedbackForm form, String sender) {
		// A robot fills every field: answered as a success, so that it learns nothing
		if (StringUtils.hasText(form.website())) {
			return;
		}
		Instant now = Instant.now();
		Instant hourAgo = now.minus(Duration.ofHours(1));
		String folded = Texts.foldCaseAndAccents(form.message()).replaceAll("\\s+", " ").strip();
		recentMessages.values().removeIf(time -> time.isBefore(hourAgo));
		// Sent again (a second tap, a copy): already received, answered as a success
		if (recentMessages.putIfAbsent(folded, now) != null) {
			return;
		}
		ErrorCode refused = refusal(sender, now);
		if (refused == null && repository.countByReadAtIsNull() >= MAX_UNREAD) {
			refused = ErrorCode.FEEDBACK_FULL;
		}
		if (refused != null) {
			recentMessages.remove(folded);
			throw new ApiException(refused);
		}
		repository.save(new Feedback(now, form.message().strip(), blankToNull(form.email()), blankToNull(form.page())));
	}

	public PageResponse<FeedbackResponse> list(Pageable pageable) {
		return PageResponse.of(repository
			.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
			.map(FeedbackService::toResponse));
	}

	public long unreadCount() {
		return repository.countByReadAtIsNull();
	}

	/** Read (or unread again, {@code read} false). */
	@Transactional
	public void markRead(Collection<Long> ids, boolean read) {
		List<Feedback> messages = find(ids);
		messages.forEach(message -> message.setReadAt(read ? (message.getReadAt() == null ? Instant.now() : message.getReadAt())
				: null));
	}

	/** All or none, for good. */
	@Transactional
	public void deleteAll(Collection<Long> ids) {
		List<Feedback> messages = find(ids);
		repository.deleteAll(messages);
		auditLog.record(AuditAction.DELETED, AuditKind.FEEDBACK,
				messages.size() > 1 ? messages.size() + " messages de visiteurs" : "Message d'un visiteur", null);
	}

	/** Every night, the messages older than 12 months; and the senders not heard from for an hour. */
	@Scheduled(cron = "0 50 4 * * *", zone = "Europe/Paris")
	@Transactional
	public void eraseExpired() {
		int erased = repository.deleteCreatedBefore(Instant.now().minus(KEPT));
		if (erased > 0) {
			log.info("{} visitor message(s) erased after 12 months", erased);
		}
		Instant hourAgo = Instant.now().minus(Duration.ofHours(1));
		sentBy.values().removeIf(times -> {
			synchronized (times) {
				return times.isEmpty() || times.peekLast().isBefore(hourAgo);
			}
		});
	}

	/**
	 * Why a message of this sender is refused now, or null: one a minute and {@link #PER_HOUR} an
	 * hour from an address, {@link #SITE_PER_HOUR} an hour for the whole site. An accepted message is
	 * counted.
	 */
	@Nullable ErrorCode refusal(String sender, Instant now) {
		Instant hourAgo = now.minus(Duration.ofHours(1));
		Deque<Instant> times = sentBy.computeIfAbsent(sender, key -> new ArrayDeque<>());
		synchronized (times) {
			dropBefore(times, hourAgo);
			if (!times.isEmpty() && times.peekLast().isAfter(now.minus(MIN_INTERVAL))) {
				return ErrorCode.FEEDBACK_TOO_FAST;
			}
			if (times.size() >= PER_HOUR) {
				return ErrorCode.FEEDBACK_TOO_MANY;
			}
			synchronized (sentBySite) {
				dropBefore(sentBySite, hourAgo);
				if (sentBySite.size() >= SITE_PER_HOUR) {
					return ErrorCode.FEEDBACK_BUSY;
				}
				sentBySite.addLast(now);
			}
			times.addLast(now);
			return null;
		}
	}

	private static void dropBefore(Deque<Instant> times, Instant limit) {
		while (!times.isEmpty() && times.peekFirst().isBefore(limit)) {
			times.pollFirst();
		}
	}

	private List<Feedback> find(Collection<Long> ids) {
		List<Feedback> messages = repository.findAllById(ids);
		if (messages.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.FEEDBACK_NOT_FOUND);
		}
		return messages;
	}

	private static @Nullable String blankToNull(@Nullable String text) {
		return StringUtils.hasText(text) ? text.strip() : null;
	}

	private static FeedbackResponse toResponse(Feedback feedback) {
		return new FeedbackResponse(feedback.getId(), feedback.getCreatedAt(), feedback.getMessage(), feedback.getEmail(),
				feedback.getPage(), feedback.getReadAt());
	}

}
