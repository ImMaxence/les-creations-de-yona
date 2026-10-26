package fr.lescreationsdeyona.recipe;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** "Publier samedi à 10 h": drafts are published within a minute of their scheduled time. */
@Component
@RequiredArgsConstructor
class ScheduledPublication {

	private static final Logger log = LoggerFactory.getLogger(ScheduledPublication.class);

	private final RecipeService recipeService;

	@Scheduled(initialDelay = 20_000, fixedDelay = 60_000)
	void publishDueRecipes() {
		Instant now = Instant.now();
		for (long id : recipeService.dueForPublication(now)) {
			try {
				recipeService.publishScheduled(id, now);
				log.info("Recipe {} published at its scheduled time", id);
			}
			catch (RuntimeException ex) {
				// Retried at the next run; the others are still published
				log.warn("Scheduled publication of recipe {} failed", id, ex);
			}
		}
	}

}
