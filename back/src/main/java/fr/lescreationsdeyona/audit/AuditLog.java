package fr.lescreationsdeyona.audit;

import fr.lescreationsdeyona.common.PageResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * History of the back-office: who did what, and when. Written in the transaction of the change, so
 * that a change that fails leaves no line. Kept 6 months, then erased every night.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditLog {

	/** Actor of what the site does on its own (a scheduled publication). */
	public static final String SITE = "site";

	static final Duration KEPT = Duration.ofDays(183);

	private static final Logger log = LoggerFactory.getLogger(AuditLog.class);

	private static final TypeReference<List<AuditChange>> CHANGES = new TypeReference<>() {
	};

	private final AuditEventRepository repository;

	private final AuditorAware<String> auditor;

	private final JsonMapper jsonMapper;

	@Transactional
	public void record(AuditAction action, AuditKind kind, String label, @Nullable Long targetId) {
		save(action, kind, label, targetId, null);
	}

	/** An update, with what it changed: an empty list says it was saved as it was. */
	@Transactional
	public void record(AuditAction action, AuditKind kind, String label, @Nullable Long targetId, AuditChanges changes) {
		save(action, kind, label, targetId, jsonMapper.writeValueAsString(changes.list()));
	}

	private void save(AuditAction action, AuditKind kind, String label, @Nullable Long targetId, @Nullable String changes) {
		repository.save(new AuditEvent(Instant.now(), auditor.getCurrentAuditor().orElse(SITE), action, kind, label,
				targetId, changes));
	}

	/** Always the latest first: a sort asked for is ignored. */
	public PageResponse<AuditEventResponse> latest(@Nullable AuditKind kind, Pageable pageable) {
		return PageResponse.of(repository.findLatest(kind, PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
			.map(event -> new AuditEventResponse(event.getId(), event.getHappenedAt(), event.getActor(), event.getAction(),
					event.getKind(), event.getLabel(), event.getTargetId(),
					event.getChanges() == null ? null : jsonMapper.readValue(event.getChanges(), CHANGES))));
	}

	/** Every night, what is older than 6 months. */
	@Scheduled(cron = "0 45 4 * * *", zone = "Europe/Paris")
	@Transactional
	public void eraseExpired() {
		int erased = repository.deleteHappenedBefore(Instant.now().minus(KEPT));
		if (erased > 0) {
			log.info("{} line(s) of the history erased after 6 months", erased);
		}
	}

}
