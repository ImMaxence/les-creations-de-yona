package fr.lescreationsdeyona.cap;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.cap.CapResponses.CapEntryResponse;
import fr.lescreationsdeyona.cap.CapResponses.ObservationRecipe;
import fr.lescreationsdeyona.cap.CapResponses.ObservationResponse;
import fr.lescreationsdeyona.cap.CapResponses.TrashedCapEntry;
import fr.lescreationsdeyona.cap.CapResponses.TrashedObservation;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.image.Image;
import fr.lescreationsdeyona.image.ImageService;
import fr.lescreationsdeyona.recipe.Recipe;
import fr.lescreationsdeyona.recipe.RecipeRepository;
import fr.lescreationsdeyona.recipe.RecipeStatus;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** "Mon CAP" (the timeline of the diploma) and "Mes observations" (notes about a recipe, or about none). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CapService {

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	private final CapEntryRepository entryRepository;

	private final ObservationRepository observationRepository;

	private final RecipeRepository recipeRepository;

	private final ImageService imageService;

	private final TrashBin trashBin;

	private final AuditLog auditLog;

	// Public site: what is published only.

	@Cacheable(PublicCache.CAP_ENTRIES)
	public List<CapEntryResponse> publishedEntries() {
		return entryRepository.findByPublishedTrueOrderByHappenedOnDescIdDesc().stream().map(CapService::toResponse).toList();
	}

	@Cacheable(PublicCache.OBSERVATIONS)
	public Page<ObservationResponse> publishedObservations(Pageable pageable) {
		return observationRepository
			.findByPublishedTrueOrderByObservedOnDescIdDesc(PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
			.map(observation -> toResponse(observation, true));
	}

	@Cacheable(PublicCache.RECIPE_OBSERVATIONS)
	public List<ObservationResponse> observationsOfRecipe(String slug) {
		return observationRepository.findPublishedOfRecipe(slug).stream().map(observation -> toResponse(observation, true)).toList();
	}

	// Back-office

	public List<CapEntryResponse> allEntries() {
		return entryRepository.findAllByOrderByHappenedOnDescIdDesc().stream().map(CapService::toResponse).toList();
	}

	@Transactional
	public CapEntryResponse createEntry(CapEntryForm form) {
		CapEntry entry = new CapEntry();
		applyEntry(form, entry);
		CapEntry saved = entryRepository.saveAndFlush(entry);
		auditLog.record(AuditAction.CREATED, AuditKind.CAP_ENTRY, saved.getTitle(), saved.getId());
		return toResponse(saved);
	}

	@Transactional
	public CapEntryResponse updateEntry(long id, CapEntryForm form) {
		CapEntry entry = findEntry(id);
		AuditChanges changes = new AuditChanges().add("Titre", entry.getTitle(), form.title())
			.add("Texte", entry.getBody(), form.body())
			.add("Date", date(entry.getHappenedOn()), date(form.happenedOn()))
			.add("Publiée", entry.isPublished(), form.published());
		applyEntry(form, entry);
		CapEntry saved = entryRepository.saveAndFlush(entry);
		auditLog.record(AuditAction.UPDATED, AuditKind.CAP_ENTRY, saved.getTitle(), id, changes);
		return toResponse(saved);
	}

	/** To the trash for 30 days; its photo stays in the gallery. */
	@Transactional
	public void deleteEntry(long id) {
		CapEntry entry = findEntry(id);
		trashBin.put(TrashBin.Entry.of(TrashKind.CAP_ENTRY, entry.getTitle(), null, entry.getImage(),
				new TrashedCapEntry(entry.getTitle(), entry.getBody(), entry.getHappenedOn(), entry.isPublished())));
		entryRepository.delete(entry);
	}

	/** Created again from the trash, with its photo if still in the gallery. */
	@Transactional
	public CapEntryResponse restoreEntryFromTrash(TrashItem trashed) {
		TrashedCapEntry kept = trashBin.content(trashed, TrashedCapEntry.class);
		CapEntry entry = new CapEntry();
		entry.setTitle(kept.title());
		entry.setBody(kept.body());
		entry.setHappenedOn(kept.happenedOn());
		entry.setPublished(kept.published());
		entry.setImage(trashed.getImage());
		return toResponse(entryRepository.saveAndFlush(entry));
	}

	public Page<ObservationResponse> allObservations(Pageable pageable) {
		return observationRepository
			.findAllByOrderByObservedOnDescIdDesc(PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()))
			.map(observation -> toResponse(observation, false));
	}

	@Transactional
	public ObservationResponse createObservation(ObservationForm form) {
		Observation observation = new Observation();
		applyObservation(form, observation);
		Observation saved = observationRepository.saveAndFlush(observation);
		auditLog.record(AuditAction.CREATED, AuditKind.OBSERVATION, saved.getTitle(), saved.getId());
		return toResponse(saved, false);
	}

	@Transactional
	public ObservationResponse updateObservation(long id, ObservationForm form) {
		Observation observation = findObservation(id);
		String recipeBefore = observation.getRecipe() == null ? null : observation.getRecipe().getTitle();
		String titleBefore = observation.getTitle();
		String bodyBefore = observation.getBody();
		LocalDate dateBefore = observation.getObservedOn();
		boolean publishedBefore = observation.isPublished();
		applyObservation(form, observation);
		Observation saved = observationRepository.saveAndFlush(observation);
		AuditChanges changes = new AuditChanges().add("Titre", titleBefore, saved.getTitle())
			.add("Texte", bodyBefore, saved.getBody())
			.add("Date", date(dateBefore), date(saved.getObservedOn()))
			.add("Recette", recipeBefore, saved.getRecipe() == null ? null : saved.getRecipe().getTitle())
			.add("Publiée", publishedBefore, saved.isPublished());
		auditLog.record(AuditAction.UPDATED, AuditKind.OBSERVATION, saved.getTitle(), id, changes);
		return toResponse(saved, false);
	}

	/** To the trash for 30 days; its photo stays in the gallery. */
	@Transactional
	public void deleteObservation(long id) {
		Observation observation = findObservation(id);
		trashBin.put(TrashBin.Entry.of(TrashKind.OBSERVATION, observation.getTitle(), null, observation.getImage(),
				new TrashedObservation(observation.getTitle(), observation.getBody(), observation.getObservedOn(),
						observation.getRecipe() == null ? null : observation.getRecipe().getId(), observation.isPublished())));
		observationRepository.delete(observation);
	}

	/** Created again from the trash; "Pas de recette" if its recipe has gone meanwhile. */
	@Transactional
	public ObservationResponse restoreObservationFromTrash(TrashItem trashed) {
		TrashedObservation kept = trashBin.content(trashed, TrashedObservation.class);
		Observation observation = new Observation();
		observation.setTitle(kept.title());
		observation.setBody(kept.body());
		observation.setObservedOn(kept.observedOn());
		observation.setPublished(kept.published());
		observation.setImage(trashed.getImage());
		observation.setRecipe(kept.recipeId() == null ? null : recipeRepository.findById(kept.recipeId()).orElse(null));
		return toResponse(observationRepository.saveAndFlush(observation), false);
	}

	/** A recipe out of the trash has a new id: the observations about it find it again. */
	@Transactional
	public int giveBackObservations(long recipeId, List<Long> observationIds) {
		return observationIds.isEmpty() ? 0 : observationRepository.linkToRecipe(recipeId, observationIds);
	}

	private void applyEntry(CapEntryForm form, CapEntry entry) {
		Image image = image(form.imageId());
		entry.setTitle(Texts.capitalizeFirstLetter(form.title().strip()));
		entry.setBody(StringUtils.hasText(form.body()) ? form.body().strip() : null);
		entry.setHappenedOn(form.happenedOn());
		entry.setImage(image);
		entry.setPublished(form.published());
	}

	private void applyObservation(ObservationForm form, Observation observation) {
		Image image = image(form.imageId());
		Recipe recipe = form.recipeId() == null ? null
				: recipeRepository.findById(form.recipeId()).orElseThrow(() -> new ApiException(ErrorCode.RECIPE_NOT_FOUND));
		observation.setTitle(Texts.capitalizeFirstLetter(form.title().strip()));
		observation.setBody(form.body().strip());
		observation.setObservedOn(form.observedOn());
		observation.setImage(image);
		observation.setRecipe(recipe);
		observation.setPublished(form.published());
	}

	private @Nullable Image image(@Nullable UUID imageId) {
		return imageId == null ? null : imageService.getLandscape(imageId);
	}

	private CapEntry findEntry(long id) {
		return entryRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.CAP_ENTRY_NOT_FOUND));
	}

	private Observation findObservation(long id) {
		return observationRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.OBSERVATION_NOT_FOUND));
	}

	private static String date(LocalDate date) {
		return DATE.format(date);
	}

	private static CapEntryResponse toResponse(CapEntry entry) {
		return new CapEntryResponse(entry.getId(), entry.getTitle(), entry.getBody(), entry.getHappenedOn(),
				entry.getImage() == null ? null : entry.getImage().getId(), entry.isPublished(), entry.getUpdatedAt());
	}

	/** {@code forVisitors}: a recipe still in draft is not named on the site. */
	static ObservationResponse toResponse(Observation observation, boolean forVisitors) {
		Recipe recipe = observation.getRecipe();
		boolean shown = recipe != null && (!forVisitors || recipe.getStatus() == RecipeStatus.PUBLISHED);
		return new ObservationResponse(observation.getId(), observation.getTitle(), observation.getBody(),
				observation.getObservedOn(), observation.getImage() == null ? null : observation.getImage().getId(),
				observation.isPublished(),
				shown ? new ObservationRecipe(recipe.getId(), recipe.getTitle(), recipe.getSlug(),
						recipe.getMainCategory().getSlug(), recipe.getStatus()) : null,
				observation.getUpdatedAt());
	}

}
