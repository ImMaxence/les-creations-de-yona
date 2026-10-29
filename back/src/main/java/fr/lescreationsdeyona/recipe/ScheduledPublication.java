package fr.lescreationsdeyona.recipe;

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
 * "Publier samedi à 10 h": every minute, the backend publishes the drafts whose time has come. Not
 * a cron of the server: a task of the backend itself, which looks for them again after a restart.
 * A recipe found more than 30 minutes late (the site was down) or failing 3 times in a row is put
 * in "Échec" instead, with the reason (see RecipeService).
 */
@Component
@RequiredArgsConstructor
class ScheduledPublication {

	static final int MAX_ATTEMPTS = 3;

	static final String ERROR_FAILURE = "La publication a échoué 3 fois de suite : réessayez, ou prévenez l'administrateur du site";

	private static final Logger log = LoggerFactory.getLogger(ScheduledPublication.class);

	private final RecipeService recipeService;

	private final PublicCache publicCache;

	/** Failed attempts by recipe, forgotten once it is published or failed. */
	private final Map<Long, Integer> attempts = new ConcurrentHashMap<>();

	@Scheduled(initialDelay = 20_000, fixedDelay = 60_000)
	void publishDueRecipes() {
		Instant now = Instant.now();
		List<Long> due = recipeService.dueForPublication(now);
		for (long id : due) {
			try {
				recipeService.publishScheduled(id, now);
				attempts.remove(id);
				log.info("Recipe {} published at its scheduled time, or failed for being too late", id);
			}
			catch (RuntimeException ex) {
				// Retried at the next run; the others are still published
				log.warn("Scheduled publication of recipe {} failed", id, ex);
				if (attempts.merge(id, 1, Integer::sum) >= MAX_ATTEMPTS) {
					attempts.remove(id);
					failQuietly(id);
				}
			}
		}
		forgetPublicAnswers(due);
	}

	/** Published or failed: the site shows them at once, not after the public cache expires. */
	private void forgetPublicAnswers(List<Long> due) {
		if (!due.isEmpty()) {
			publicCache.clear();
		}
	}

	private void failQuietly(long id) {
		try {
			recipeService.failScheduled(id, ERROR_FAILURE);
		}
		catch (RuntimeException ex) {
			log.error("Recipe {} could not be marked as failed", id, ex);
		}
	}

}
