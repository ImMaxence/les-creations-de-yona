package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.common.PublicCache;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * "Publier samedi à 10 h" for the articles of "Mon CAP", as for the recipes: every minute, the
 * backend publishes the drafts whose time has come, and looks for them again after a restart. An
 * article found more than 30 minutes late (the site was down) or failing 3 times in a row is put in
 * "Échec" instead, with the reason.
 */
@Component
@RequiredArgsConstructor
class ScheduledCapPublication {

	static final int MAX_ATTEMPTS = 3;

	static final String ERROR_FAILURE = "La publication a échoué 3 fois de suite : réessayez, ou prévenez l'administrateur du site";

	private static final Logger log = LoggerFactory.getLogger(ScheduledCapPublication.class);

	private final CapService capService;

	private final PublicCache publicCache;

	/** Failed attempts by article, forgotten once it is published or failed. */
	private final Map<Long, Integer> attempts = new ConcurrentHashMap<>();

	@Scheduled(initialDelay = 25_000, fixedDelay = 60_000)
	void publishDueEntries() {
		Instant now = Instant.now();
		List<Long> due = capService.dueForPublication(now);
		for (long id : due) {
			try {
				capService.publishScheduled(id, now);
				attempts.remove(id);
				log.info("Article {} of Mon CAP published at its scheduled time, or failed for being too late", id);
			}
			catch (RuntimeException ex) {
				// Retried at the next run; the others are still published
				log.warn("Scheduled publication of article {} failed", id, ex);
				if (attempts.merge(id, 1, Integer::sum) >= MAX_ATTEMPTS) {
					attempts.remove(id);
					failQuietly(id);
				}
			}
		}
		// Published or failed: the site shows them at once, not after the public cache expires
		if (!due.isEmpty()) {
			publicCache.clear();
		}
	}

	private void failQuietly(long id) {
		try {
			capService.failScheduled(id, ERROR_FAILURE);
		}
		catch (RuntimeException ex) {
			log.error("Article {} could not be marked as failed", id, ex);
		}
	}

}
