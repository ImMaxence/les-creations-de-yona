package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The trash of the back-office: deleted recipes are kept 30 days (see {@link RecipeService#delete}),
 * then erased every night. Restoring one is done by {@link RecipeService#restoreFromTrash}.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecipeTrashService {

	static final Duration KEPT = Duration.ofDays(30);

	private static final Logger log = LoggerFactory.getLogger(RecipeTrashService.class);

	private final RecipeTrashRepository trashRepository;

	/** The last deleted first. */
	public List<TrashedRecipe> list() {
		return trashRepository.findAllByOrderByDeletedAtDesc()
			.stream()
			.map(trashed -> new TrashedRecipe(trashed.getId(), trashed.getTitle(), trashed.getStatus(),
					trashed.getImage() == null ? null : trashed.getImage().getId(), trashed.getDeletedAt(),
					trashed.getDeletedBy(), trashed.getDeletedAt().plus(KEPT)))
			.toList();
	}

	public long count() {
		return trashRepository.count();
	}

	/** For good, before its 30 days; its photo stays in the gallery. */
	@Transactional
	public void erase(long id) {
		trashRepository.delete(trashRepository.findById(id)
			.orElseThrow(() -> new ApiException(ErrorCode.TRASHED_RECIPE_NOT_FOUND)));
	}

	/** "Vider la corbeille". */
	@Transactional
	public void eraseAll() {
		trashRepository.deleteAllInBatch();
	}

	/** Every night, those deleted more than 30 days ago. */
	@Scheduled(cron = "0 30 4 * * *", zone = "Europe/Paris")
	@Transactional
	public void eraseExpired() {
		int erased = trashRepository.deleteDeletedBefore(Instant.now().minus(KEPT));
		if (erased > 0) {
			log.info("{} recipe(s) erased from the trash after {} days", erased, KEPT.toDays());
		}
	}

}
