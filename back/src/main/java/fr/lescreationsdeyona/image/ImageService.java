package fr.lescreationsdeyona.image;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.Pageables;
import fr.lescreationsdeyona.content.SiteContentRepository;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Keeps the {@code image} table and the S3 bucket in step. S3 has no transactions, so its files
 * follow the outcome of the database transaction: an upload is removed if the transaction rolls
 * back, and a deleted image loses its files only once the deletion is committed. A failure there
 * leaves orphan files at worst, never a record without files.
 * <p>
 * Uploaded images are kept until deleted from the gallery, even when no recipe or category shows
 * them any more: the admin sorts them out there, and can show one again. A deleted image goes to
 * the trash for 30 days: its record leaves the image table, its files stay until it is erased.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ImageService {

	private static final Logger log = LoggerFactory.getLogger(ImageService.class);

	private static final Set<String> SORTABLE_PROPERTIES = Set.of("createdAt");

	private final ImageRepository imageRepository;

	private final ImageStorage imageStorage;

	private final SiteContentRepository siteContentRepository;

	private final TrashBin trashBin;

	private final AuditLog auditLog;

	/**
	 * {@code used}: true for images shown somewhere, false for unused ones, null for all.
	 * {@code portrait}: true for the vertical Pinterest photos, false for the landscape ones.
	 */
	public Page<GalleryImage> gallery(@Nullable ImageKind kind, @Nullable Boolean portrait, @Nullable Boolean used,
			Pageable pageable) {
		Page<Image> images = imageRepository.findGallery(kind, portrait, used,
				Pageables.requireSortedOn(pageable, SORTABLE_PROPERTIES));
		List<UUID> ids = images.map(Image::getId).getContent();
		Map<UUID, List<GalleryImage.UsingRecipe>> recipes = ids.isEmpty() ? Map.of()
				: Stream.concat(imageRepository.findRecipeUsages(ids).stream(),
						imageRepository.findPinterestUsages(ids).stream())
					.collect(Collectors.groupingBy(GalleryImage.RecipeUsage::imageId, Collectors.mapping(
							usage -> new GalleryImage.UsingRecipe(usage.id(), usage.title()), Collectors.toList())));
		Map<UUID, List<GalleryImage.UsingCategory>> categories = ids.isEmpty() ? Map.of()
				: imageRepository.findCategoryUsages(ids)
					.stream()
					.collect(Collectors.groupingBy(GalleryImage.CategoryUsage::imageId, Collectors.mapping(
							usage -> new GalleryImage.UsingCategory(usage.id(), usage.name(), usage.slug()),
							Collectors.toList())));
		Map<UUID, List<GalleryImage.UsingMenu>> menus = ids.isEmpty() ? Map.of()
				: imageRepository.findMenuUsages(ids)
					.stream()
					.collect(Collectors.groupingBy(GalleryImage.MenuUsage::imageId, Collectors.mapping(
							usage -> new GalleryImage.UsingMenu(usage.id(), usage.title()), Collectors.toList())));
		Map<UUID, List<String>> capItems = ids.isEmpty() ? Map.of()
				: Stream.concat(imageRepository.findCapEntryUsages(ids).stream(), imageRepository.findCapBlockUsages(ids).stream())
					.distinct()
					.collect(Collectors.groupingBy(GalleryImage.CapUsage::imageId,
							Collectors.mapping(GalleryImage.CapUsage::title, Collectors.toList())));
		Map<UUID, List<String>> products = ids.isEmpty() ? Map.of()
				: imageRepository.findShopProductUsages(ids)
					.stream()
					.collect(Collectors.groupingBy(GalleryImage.ProductUsage::imageId,
							Collectors.mapping(GalleryImage.ProductUsage::name, Collectors.toList())));
		UUID aboutImageId = siteContentRepository.findAboutImageId().orElse(null);
		return images.map(image -> new GalleryImage(image.getId(), image.getKind(), image.getCreatedAt(),
				recipes.getOrDefault(image.getId(), List.of()), categories.getOrDefault(image.getId(), List.of()),
				menus.getOrDefault(image.getId(), List.of()), image.getId().equals(aboutImageId),
				capItems.getOrDefault(image.getId(), List.of()), products.getOrDefault(image.getId(), List.of())));
	}

	/**
	 * Opens a variant for the public site. Ids are random UUIDs, so they cannot be guessed. The
	 * receipts of the accounts are not served here: only to the admins ({@link #openReceipt}).
	 */
	public ImageStorage.StoredFile open(UUID id, int width) {
		Image image = get(id);
		if (image.getKind().isPrivate()) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND);
		}
		return imageStorage.open(image.key(width));
	}

	/** The receipt of an expense, for the back-office. */
	public ImageStorage.StoredFile openReceipt(UUID id) {
		Image image = get(id);
		if (image.getKind() != ImageKind.RECEIPT) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND);
		}
		return imageStorage.open(image.key(ImageProcessor.WIDTHS.getLast()));
	}

	/** A new receipt, kept apart from the gallery; called by the accounts, inside their transaction. */
	@Transactional(propagation = Propagation.MANDATORY)
	public Image createReceipt(ProcessedImage processed) {
		return create(ImageKind.RECEIPT, processed);
	}

	/** A receipt replaced or gone with its expense: its files go once that is committed. Never in the trash. */
	@Transactional(propagation = Propagation.MANDATORY)
	public void deleteReceipt(Image receipt) {
		if (receipt.getKind() != ImageKind.RECEIPT) {
			return;
		}
		String folder = receipt.getS3Prefix();
		imageRepository.delete(receipt);
		onCompletion(TransactionSynchronization.STATUS_COMMITTED, () -> imageStorage.deleteFolder(folder));
	}

	/** A photo of the messages (sent, of a group, of a link's preview), kept apart from the gallery; inside the caller's transaction. */
	@Transactional(propagation = Propagation.MANDATORY)
	public Image createMessageImage(ProcessedImage processed) {
		return create(ImageKind.MESSAGE, processed);
	}

	/** Photos of the messages gone with their message or their group: never in the trash, their files go once that is committed. */
	@Transactional(propagation = Propagation.MANDATORY)
	public void deleteMessageImages(Collection<UUID> ids) {
		for (Image image : imageRepository.findAllById(ids)) {
			if (image.getKind() != ImageKind.MESSAGE) {
				continue;
			}
			String folder = image.getS3Prefix();
			imageRepository.delete(image);
			onCompletion(TransactionSynchronization.STATUS_COMMITTED, () -> imageStorage.deleteFolder(folder));
		}
	}

	/** A photo of the messages, for the admins; the caller checks the admin may see it. */
	public ImageStorage.StoredFile openMessageImage(UUID id, int width) {
		Image image = get(id);
		if (image.getKind() != ImageKind.MESSAGE) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND);
		}
		return imageStorage.open(image.key(width));
	}

	/** Those of these ids that are photos of the gallery that the site may show (landscape). */
	public Set<UUID> landscapeIdsAmong(Collection<UUID> ids) {
		return ids.isEmpty() ? Set.of() : new HashSet<>(imageRepository.findLandscapeIds(ids));
	}

	/** An image of the gallery, to show it on a recipe or a category. */
	public Image get(UUID id) {
		return imageRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.IMAGE_NOT_FOUND));
	}

	/** Still in the gallery, e.g. the photo of a recipe taken out of the trash. */
	public Optional<Image> find(UUID id) {
		return imageRepository.findById(id);
	}

	/** A landscape image of the gallery, to show it on a recipe, a category or the home page. */
	public Image getLandscape(UUID id) {
		Image image = get(id);
		if (image.getKind().isPrivate()) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND);
		}
		if (image.getKind() == ImageKind.PINTEREST) {
			throw new ApiException(ErrorCode.IMAGE_NOT_LANDSCAPE);
		}
		return image;
	}

	/** A vertical image of the gallery, uploaded for Pinterest: the other photos are landscape. */
	public Image getPortrait(UUID id) {
		Image image = get(id);
		if (image.getKind() != ImageKind.PINTEREST) {
			throw new ApiException(ErrorCode.IMAGE_NOT_PORTRAIT);
		}
		return image;
	}

	/** Called by the recipe and category services, inside their transaction. */
	@Transactional(propagation = Propagation.MANDATORY)
	public Image create(ImageKind kind, ProcessedImage processed) {
		Image image = Image.create(kind);
		String folder = image.getS3Prefix();
		// Registered first: also cleans up a half-finished upload.
		onCompletion(TransactionSynchronization.STATUS_ROLLED_BACK, () -> imageStorage.deleteFolder(folder));
		processed.variants().forEach(variant -> imageStorage.putWebp(image.key(variant.width()), variant.webp()));
		return imageRepository.save(image);
	}

	/** "Ajouter une photo" of the gallery: kept there until a recipe or a category shows it. */
	@Transactional
	public GalleryImage upload(ProcessedImage processed) {
		Image image = create(ImageKind.GALLERY, processed);
		auditLog.record(AuditAction.CREATED, AuditKind.IMAGE, "Photo ajoutée à la galerie", null);
		return new GalleryImage(image.getId(), image.getKind(), image.getCreatedAt(), List.of(), List.of(), List.of(),
				false, List.of(), List.of());
	}

	/**
	 * "Retoucher": the retouched photo, a new image (new URL, as images never change), takes the place
	 * of the original wherever it was shown. The original goes to the trash for 30 days, shown nowhere.
	 */
	@Transactional
	public GalleryImage replace(UUID id, ProcessedImage retouched) {
		Image original = inGallery(id);
		String title = "Avant retouche : " + trashedTitle(shownOn(galleryImage(original)));
		Image replacement = create(original.getKind(), retouched);
		imageRepository.replaceOnRecipes(id, replacement.getId());
		imageRepository.replaceOnCategories(id, replacement.getId());
		imageRepository.replaceOnMenus(id, replacement.getId());
		imageRepository.replaceOnCapEntries(id, replacement.getId());
		imageRepository.replaceOnShopProducts(id, replacement.getId());
		imageRepository.replaceOnAboutPage(id, replacement.getId());
		trash(id, title);
		GalleryImage replaced = galleryImage(replacement);
		auditLog.record(AuditAction.UPDATED, AuditKind.IMAGE, "Photo retouchée", null,
				new AuditChanges().add("Montrée sur", null, shownOn(replaced)));
		return replaced;
	}

	/** An image of the gallery: a receipt or a photo of the messages is not one, whatever its id. */
	private Image inGallery(UUID id) {
		Image image = get(id);
		if (image.getKind().isPrivate()) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND);
		}
		return image;
	}

	/** Its kind, before a retouched version is decoded: Pinterest photos are vertical. */
	public ImageKind kindOf(UUID id) {
		return get(id).getKind();
	}

	private GalleryImage galleryImage(Image image) {
		List<UUID> ids = List.of(image.getId());
		return new GalleryImage(image.getId(), image.getKind(), image.getCreatedAt(),
				Stream.concat(imageRepository.findRecipeUsages(ids).stream(), imageRepository.findPinterestUsages(ids).stream())
					.map(usage -> new GalleryImage.UsingRecipe(usage.id(), usage.title()))
					.distinct()
					.toList(),
				imageRepository.findCategoryUsages(ids).stream()
					.map(usage -> new GalleryImage.UsingCategory(usage.id(), usage.name(), usage.slug()))
					.toList(),
				imageRepository.findMenuUsages(ids).stream().map(usage -> new GalleryImage.UsingMenu(usage.id(), usage.title())).toList(),
				image.getId().equals(siteContentRepository.findAboutImageId().orElse(null)),
				Stream.concat(imageRepository.findCapEntryUsages(ids).stream(), imageRepository.findCapBlockUsages(ids).stream())
					.distinct()
					.map(GalleryImage.CapUsage::title)
					.toList(),
				imageRepository.findShopProductUsages(ids).stream().map(GalleryImage.ProductUsage::name).toList());
	}

	private static List<String> shownOn(GalleryImage image) {
		List<String> names = new ArrayList<>();
		image.recipes().forEach(recipe -> names.add(recipe.title()));
		image.categories().forEach(category -> names.add(category.name()));
		image.menus().forEach(menu -> names.add(menu.title()));
		names.addAll(image.capItems());
		names.addAll(image.shopProducts());
		if (image.aboutPage()) {
			names.add("À propos");
		}
		return names;
	}

	/**
	 * Moved to the trash, kept 30 days: the recipes, categories and menus showing it fall back to
	 * the default visual ({@code ON DELETE SET NULL}) and get it back on restore.
	 */
	@Transactional
	public void delete(UUID id) {
		trash(id, null);
	}

	/** {@code title}: null for the usual one, saying where it was shown. */
	private void trash(UUID id, @Nullable String title) {
		Image image = inGallery(id);
		List<GalleryImage.RecipeUsage> recipes = imageRepository.findRecipeUsages(List.of(id));
		List<GalleryImage.RecipeUsage> pinterest = imageRepository.findPinterestUsages(List.of(id));
		List<GalleryImage.CategoryUsage> categories = imageRepository.findCategoryUsages(List.of(id));
		List<GalleryImage.MenuUsage> menus = imageRepository.findMenuUsages(List.of(id));
		List<GalleryImage.CapUsage> capEntries = imageRepository.findCapEntryUsages(List.of(id));
		List<GalleryImage.CapUsage> capBlocks = imageRepository.findCapBlockUsages(List.of(id));
		List<GalleryImage.ProductUsage> products = imageRepository.findShopProductUsages(List.of(id));
		boolean aboutPage = id.equals(siteContentRepository.findAboutImageId().orElse(null));
		List<String> shownOn = new ArrayList<>();
		Stream.concat(recipes.stream(), pinterest.stream()).map(GalleryImage.RecipeUsage::title).distinct().forEach(shownOn::add);
		categories.forEach(category -> shownOn.add(category.name()));
		menus.forEach(menu -> shownOn.add(menu.title()));
		Stream.concat(capEntries.stream(), capBlocks.stream()).map(GalleryImage.CapUsage::title).distinct().forEach(shownOn::add);
		products.forEach(product -> shownOn.add(product.name()));
		if (aboutPage) {
			shownOn.add("À propos");
		}
		TrashedImage.Links links = new TrashedImage.Links(recipes.stream().map(GalleryImage.RecipeUsage::id).toList(),
				pinterest.stream().map(GalleryImage.RecipeUsage::id).toList(),
				categories.stream().map(GalleryImage.CategoryUsage::id).toList(), aboutPage,
				menus.stream().map(GalleryImage.MenuUsage::id).toList(),
				capEntries.stream().map(GalleryImage.CapUsage::id).toList(),
				products.stream().map(GalleryImage.ProductUsage::id).toList());
		trashBin.put(new TrashBin.Entry(TrashKind.IMAGE, title != null ? title : trashedTitle(shownOn), null, null, null, null,
				new TrashedImage(image.getId(), image.getKind(), image.getS3Prefix(), image.getCreatedAt()), links, null));
		imageRepository.delete(image);
	}

	/** All or none, in a single transaction. */
	@Transactional
	public void deleteAll(Collection<UUID> ids) {
		new HashSet<>(ids).forEach(this::delete);
	}

	/**
	 * Back in the gallery from the trash, with the same URL, and on the recipes, categories, menus and
	 * "À propos" that showed it and have no other photo since. Returns the number of places it is
	 * back on.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public int restoreFromTrash(TrashItem trashed) {
		TrashedImage kept = trashBin.content(trashed, TrashedImage.class);
		// A backup restored meanwhile ("Ajouter ce qui manque") may have put it back already
		if (!imageRepository.existsById(kept.id())) {
			imageRepository.insertRestored(kept.id(), kept.kind().name(), kept.s3Prefix(), kept.createdAt());
		}
		TrashedImage.Links links = trashBin.links(trashed, TrashedImage.Links.class, TrashedImage.Links.NONE);
		int shown = 0;
		if (!links.recipeIds().isEmpty()) {
			shown += imageRepository.showOnRecipes(kept.id(), links.recipeIds());
		}
		if (!links.pinterestRecipeIds().isEmpty()) {
			shown += imageRepository.showOnPinterest(kept.id(), links.pinterestRecipeIds());
		}
		if (!links.categoryIds().isEmpty()) {
			shown += imageRepository.showOnCategories(kept.id(), links.categoryIds());
		}
		if (!links.menuIds().isEmpty()) {
			shown += imageRepository.showOnMenus(kept.id(), links.menuIds());
		}
		if (!links.capEntryIds().isEmpty()) {
			shown += imageRepository.showOnCapEntries(kept.id(), links.capEntryIds());
		}
		if (!links.shopProductIds().isEmpty()) {
			shown += imageRepository.showOnShopProducts(kept.id(), links.shopProductIds());
		}
		if (links.aboutPage()) {
			shown += imageRepository.showOnAboutPage(kept.id());
		}
		return shown;
	}

	/** Erased from the trash: its files go once the erasure is committed, unless it is back in the gallery. */
	@Transactional(propagation = Propagation.MANDATORY)
	public void eraseFromTrash(TrashItem trashed) {
		TrashedImage kept = trashBin.content(trashed, TrashedImage.class);
		if (!imageRepository.existsById(kept.id())) {
			onCompletion(TransactionSynchronization.STATUS_COMMITTED, () -> imageStorage.deleteFolder(kept.s3Prefix()));
		}
	}

	/** Its 800 px file, for the trash of the back-office. */
	public ImageStorage.StoredFile openFromTrash(TrashItem trashed) {
		return imageStorage.open(trashBin.content(trashed, TrashedImage.class).s3Prefix() + "800.webp");
	}

	/** "Photo de « Tarte fine »", "Photo de « Tarte fine » et 2 autres", "Photo non utilisée". */
	private static String trashedTitle(List<String> shownOn) {
		if (shownOn.isEmpty()) {
			return "Photo non utilisée";
		}
		String first = "Photo de « " + shownOn.getFirst() + " »";
		return switch (shownOn.size()) {
			case 1 -> first;
			case 2 -> first + " et 1 autre";
			default -> first + " et " + (shownOn.size() - 1) + " autres";
		};
	}

	private static void onCompletion(int expectedStatus, Runnable cleanup) {
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {

			@Override
			public void afterCompletion(int status) {
				if (status != expectedStatus) {
					return;
				}
				try {
					cleanup.run();
				}
				catch (RuntimeException ex) {
					log.warn("S3 cleanup failed, orphan files may remain", ex);
				}
			}

		});
	}

}
