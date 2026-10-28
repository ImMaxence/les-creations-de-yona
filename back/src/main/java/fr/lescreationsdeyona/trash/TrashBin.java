package fr.lescreationsdeyona.trash;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Puts what the back-office deletes into the trash, inside the deleting transaction, and reads it
 * back on restore. Kept apart from {@link TrashService}, which calls the services putting things
 * here to restore them.
 */
@Component
@RequiredArgsConstructor
public class TrashBin {

	private final TrashItemRepository trashRepository;

	private final AuditorAware<String> auditor;

	private final JsonMapper jsonMapper;

	private final AuditLog auditLog;

	/** What a trashed thing is, beside its content. */
	public record Entry(TrashKind kind, String title, @Nullable String slug, @Nullable RecipeStatus status,
			@Nullable Image image, @Nullable Image pinterestImage, Object content, @Nullable Object links,
			@Nullable Long viewCount) {

		public static Entry of(TrashKind kind, String title, @Nullable String slug, @Nullable Image image, Object content) {
			return new Entry(kind, title, slug, null, image, null, content, null, null);
		}

	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void put(Entry entry) {
		TrashItem item = new TrashItem();
		item.setKind(entry.kind());
		item.setTitle(entry.title());
		item.setSlug(entry.slug());
		item.setStatus(entry.status());
		item.setImage(entry.image());
		item.setPinterestImage(entry.pinterestImage());
		item.setContent(jsonMapper.writeValueAsString(entry.content()));
		item.setLinks(entry.links() == null ? null : jsonMapper.writeValueAsString(entry.links()));
		item.setViewCount(entry.viewCount());
		item.setDeletedAt(Instant.now());
		item.setDeletedBy(auditor.getCurrentAuditor().orElse(""));
		trashRepository.save(item);
		auditLog.record(AuditAction.TRASHED, auditKind(entry.kind()), entry.title(), null);
	}

	/** Same names on both sides. */
	static AuditKind auditKind(TrashKind kind) {
		return AuditKind.valueOf(kind.name());
	}

	public <T> T content(TrashItem item, Class<T> type) {
		return jsonMapper.readValue(item.getContent(), type);
	}

	/** {@code empty} when it was shown nowhere. */
	public <T> T links(TrashItem item, Class<T> type, T empty) {
		return item.getLinks() == null ? empty : jsonMapper.readValue(item.getLinks(), type);
	}

}
