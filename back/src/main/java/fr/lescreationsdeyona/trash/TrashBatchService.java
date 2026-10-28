package fr.lescreationsdeyona.trash;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Several things restored at once. Each one is restored in its own transaction, by
 * {@link TrashService#restore}: one that cannot come back (its categories gone, its title taken)
 * is reported and leaves the others restored.
 */
@Service
@RequiredArgsConstructor
public class TrashBatchService {

	/**
	 * What others need first: a photo before what showed it, a category, a tag or an ingredient
	 * before its recipes, a recipe before its menus and tags. Restored together, they find each other
	 * again.
	 */
	private static final List<TrashKind> RESTORE_ORDER = List.of(TrashKind.IMAGE, TrashKind.CATEGORY, TrashKind.INGREDIENT,
			TrashKind.GLOSSARY_TERM, TrashKind.RECIPE, TrashKind.TAG, TrashKind.MENU);

	private static final Logger log = LoggerFactory.getLogger(TrashBatchService.class);

	private final TrashService trashService;

	private final TrashItemRepository trashRepository;

	/** Not transactional itself: each restore commits on its own. Refused at once if an id is no longer in the trash. */
	public TrashBatchRestored restore(Collection<Long> ids) {
		Set<Long> distinct = new HashSet<>(ids);
		List<TrashItem> items = new ArrayList<>(trashRepository.findAllById(distinct));
		if (items.size() != distinct.size()) {
			throw new ApiException(ErrorCode.TRASH_ITEM_NOT_FOUND);
		}
		items.sort(Comparator.comparing((TrashItem item) -> RESTORE_ORDER.indexOf(item.getKind()))
			.thenComparing(TrashItem::getDeletedAt));
		List<TrashRestored> restored = new ArrayList<>();
		List<TrashBatchRestored.Failure> failed = new ArrayList<>();
		for (TrashItem item : items) {
			try {
				restored.add(trashService.restore(item.getId()));
			}
			catch (ApiException ex) {
				failed.add(new TrashBatchRestored.Failure(item.getId(), item.getTitle(), ex.getMessage()));
			}
			catch (RuntimeException ex) {
				log.warn("Restore of trash item {} failed", item.getId(), ex);
				failed.add(new TrashBatchRestored.Failure(item.getId(), item.getTitle(), ErrorCode.INTERNAL_ERROR.message()));
			}
		}
		return new TrashBatchRestored(restored, failed);
	}

}
