package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.cap.CapResponses.AdminCapEntry;
import fr.lescreationsdeyona.cap.CapResponses.AdminCapEntrySummary;
import fr.lescreationsdeyona.cap.CapResponses.CapArticle;
import fr.lescreationsdeyona.cap.CapResponses.CapArticleCard;
import fr.lescreationsdeyona.cap.CapResponses.CapHighlight;
import fr.lescreationsdeyona.cap.CapResponses.TrashedCapEntry;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import tools.jackson.databind.json.JsonMapper;

/** "Mon CAP": the articles of the road to the diploma, as a timeline and a page each. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CapService {

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	/** The old address of "Mes observations", sent to /mon-cap: never an article's. */
	static final String RESERVED_SLUG = "observations";

	private final CapEntryRepository entryRepository;

	private final ImageService imageService;

	private final TrashBin trashBin;

	private final AuditLog auditLog;

	private final JsonMapper jsonMapper;

	// Public site: what is published only.

	@Cacheable(PublicCache.CAP_ENTRIES)
	public List<CapArticleCard> publishedEntries() {
		return entryRepository.findByPublishedTrueOrderByHappenedOnDescIdDesc().stream().map(this::toCard).toList();
	}

	@Cacheable(PublicCache.CAP_ENTRY)
	public CapArticle publishedEntry(String slug) {
		CapEntry entry = entryRepository.findBySlugAndPublishedTrue(slug)
			.orElseThrow(() -> new ApiException(ErrorCode.CAP_ENTRY_NOT_FOUND));
		List<CapBlock> blocks = blocks(entry);
		List<CapBlock> shown = CapBlocks.shown(blocks, known(CapBlocks.imageIds(blocks)));
		return new CapArticle(entry.getId(), entry.getTitle(), entry.getSubtitle(), entry.getSlug(), entry.getHappenedOn(),
				imageId(entry), entry.getStyle(), shown, CapBlocks.excerpt(shown), entry.getUpdatedAt());
	}

	/** The article chosen with "Mettre en avant", otherwise the latest one; null before the first one. */
	@Cacheable(PublicCache.CAP_HIGHLIGHT)
	public @Nullable CapHighlight highlight() {
		return entryRepository.findFirstByPublishedTrueAndFeaturedTrue()
			.map(entry -> new CapHighlight(toCard(entry), true))
			.or(() -> entryRepository.findFirstByPublishedTrueOrderByHappenedOnDescIdDesc()
				.map(entry -> new CapHighlight(toCard(entry), false)))
			.orElse(null);
	}

	// Back-office

	public List<AdminCapEntrySummary> allEntries() {
		return entryRepository.findAllByOrderByHappenedOnDescIdDesc().stream()
			.map(entry -> new AdminCapEntrySummary(entry.getId(), entry.getTitle(), entry.getSubtitle(), entry.getSlug(),
					entry.getHappenedOn(), imageId(entry), entry.getStyle(), blocks(entry).size(), entry.isPublished(),
					entry.isFeatured(), entry.getUpdatedAt()))
			.toList();
	}

	public AdminCapEntry entry(long id) {
		return toAdmin(findEntry(id));
	}

	@Transactional
	public AdminCapEntry createEntry(CapEntryForm form) {
		CapEntry entry = new CapEntry();
		apply(form, entry);
		CapEntry saved = entryRepository.saveAndFlush(entry);
		auditLog.record(AuditAction.CREATED, AuditKind.CAP_ENTRY, saved.getTitle(), saved.getId());
		return toAdmin(saved);
	}

	@Transactional
	public AdminCapEntry updateEntry(long id, CapEntryForm form) {
		CapEntry entry = findEntry(id);
		String titleBefore = entry.getTitle();
		String subtitleBefore = entry.getSubtitle();
		LocalDate dateBefore = entry.getHappenedOn();
		CapStyle styleBefore = entry.getStyle();
		String blocksBefore = entry.getBlocks();
		boolean publishedBefore = entry.isPublished();
		boolean featuredBefore = entry.isFeatured();
		String blocksSummaryBefore = CapBlocks.summary(blocks(entry));
		apply(form, entry);
		CapEntry saved = entryRepository.saveAndFlush(entry);
		AuditChanges changes = new AuditChanges().add("Titre", titleBefore, saved.getTitle())
			.add("Sous-titre", subtitleBefore, saved.getSubtitle())
			.add("Date", date(dateBefore), date(saved.getHappenedOn()))
			.add("Style", style(styleBefore), style(saved.getStyle()))
			.add("Blocs", blocksSummaryBefore,
					blocksBefore.equals(saved.getBlocks()) ? blocksSummaryBefore : CapBlocks.summary(blocks(saved)) + " (modifiés)")
			.add("Publié", publishedBefore, saved.isPublished())
			.add("Mis en avant", featuredBefore, saved.isFeatured());
		auditLog.record(AuditAction.UPDATED, AuditKind.CAP_ENTRY, saved.getTitle(), id, changes);
		return toAdmin(saved);
	}

	/** To the trash for 30 days; its photos stay in the gallery. */
	@Transactional
	public void deleteEntry(long id) {
		CapEntry entry = findEntry(id);
		trashBin.put(TrashBin.Entry.of(TrashKind.CAP_ENTRY, entry.getTitle(), entry.getSlug(), entry.getImage(),
				new TrashedCapEntry(entry.getTitle(), entry.getSubtitle(), entry.getSlug(), null, entry.getHappenedOn(),
						entry.getStyle(), blocks(entry), entry.isPublished())));
		entryRepository.delete(entry);
	}

	/**
	 * Created again from the trash, with its photo if still in the gallery, at its address if still
	 * free. Never put forward again by surprise.
	 */
	@Transactional
	public AdminCapEntry restoreEntryFromTrash(TrashItem trashed) {
		TrashedCapEntry kept = trashBin.content(trashed, TrashedCapEntry.class);
		List<CapBlock> blocks = kept.blocks() != null ? kept.blocks() : CapBlocks.fromText(kept.body());
		CapEntry entry = new CapEntry();
		entry.setTitle(kept.title());
		entry.setSubtitle(kept.subtitle());
		entry.setSlug(kept.slug() != null && !slugTaken(kept.slug()) ? kept.slug() : newSlug(kept.title()));
		entry.setHappenedOn(kept.happenedOn());
		entry.setStyle(kept.style() == null ? CapStyle.CLASSIC : kept.style());
		entry.setBlocks(CapBlocks.write(jsonMapper, blocks));
		entry.setPublished(kept.published());
		entry.setImage(trashed.getImage());
		return toAdmin(entryRepository.saveAndFlush(entry));
	}

	/**
	 * The address follows the title while the article is a draft: nobody has its link yet. Once
	 * published, it stays, so that shared links keep working.
	 */
	private void apply(CapEntryForm form, CapEntry entry) {
		Image image = form.imageId() == null ? null : imageService.getLandscape(form.imageId());
		List<CapBlock> requested = form.blocks();
		Set<UUID> known = imageService.landscapeIdsAmong(CapBlocks.imageIds(requested));
		List<CapBlock> blocks = CapBlocks.tidy(requested, known::contains);
		String title = Texts.capitalizeFirstLetter(form.title().strip());
		if (entry.getSlug() == null || (!entry.isPublished() && !title.equals(entry.getTitle()))) {
			entry.setSlug(newSlug(title, entry.getSlug()));
		}
		if (form.featured()) {
			// Before this one is written: the database takes one featured article at most
			entryRepository.unfeatureAllExcept(entry.getId() == null ? -1 : entry.getId());
		}
		entry.setTitle(title);
		entry.setSubtitle(StringUtils.hasText(form.subtitle()) ? form.subtitle().strip() : null);
		entry.setHappenedOn(form.happenedOn());
		entry.setImage(image);
		entry.setStyle(form.style());
		entry.setBlocks(CapBlocks.write(jsonMapper, blocks));
		entry.setPublished(form.published());
		entry.setFeatured(form.featured());
	}

	private String newSlug(String title) {
		return newSlug(title, null);
	}

	/** {@code current}: the article's own address, free for it to keep. */
	private String newSlug(String title, @Nullable String current) {
		return Slugs.uniqueSlug(title, "article", slug -> !slug.equals(current) && slugTaken(slug));
	}

	private boolean slugTaken(String slug) {
		return RESERVED_SLUG.equals(slug) || entryRepository.existsBySlug(slug);
	}

	private List<CapBlock> blocks(CapEntry entry) {
		return CapBlocks.read(jsonMapper, entry.getBlocks());
	}

	/** Those of these photos still in the gallery. */
	private Predicate<UUID> known(Collection<UUID> imageIds) {
		Set<UUID> found = imageIds.isEmpty() ? Set.of() : new HashSet<>(imageService.landscapeIdsAmong(imageIds));
		return found::contains;
	}

	private CapEntry findEntry(long id) {
		return entryRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.CAP_ENTRY_NOT_FOUND));
	}

	private static @Nullable UUID imageId(CapEntry entry) {
		return entry.getImage() == null ? null : entry.getImage().getId();
	}

	private static String date(LocalDate date) {
		return DATE.format(date);
	}

	private static String style(CapStyle style) {
		return style == CapStyle.NOTEBOOK ? "Carnet" : "Classique";
	}

	private CapArticleCard toCard(CapEntry entry) {
		return new CapArticleCard(entry.getId(), entry.getTitle(), entry.getSubtitle(), entry.getSlug(), entry.getHappenedOn(),
				imageId(entry), entry.getStyle(), CapBlocks.excerpt(blocks(entry)));
	}

	private AdminCapEntry toAdmin(CapEntry entry) {
		List<CapBlock> blocks = blocks(entry);
		return new AdminCapEntry(entry.getId(), entry.getTitle(), entry.getSubtitle(), entry.getSlug(), entry.getHappenedOn(),
				imageId(entry), entry.getStyle(), CapBlocks.withKnownImages(blocks, known(CapBlocks.imageIds(blocks))),
				entry.isPublished(), entry.isFeatured(), entry.getUpdatedAt());
	}

}
