package fr.lescreationsdeyona.image;

import fr.lescreationsdeyona.common.Pageables;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
 * them any more: the admin sorts them out there, and can show one again.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ImageService {

	private static final Logger log = LoggerFactory.getLogger(ImageService.class);

	private static final Set<String> SORTABLE_PROPERTIES = Set.of("createdAt");

	private final ImageRepository imageRepository;

	private final ImageStorage imageStorage;

	/** {@code used}: true for images shown somewhere, false for unused ones, null for all. */
	public Page<GalleryImage> gallery(@Nullable ImageKind kind, @Nullable Boolean used, Pageable pageable) {
		Page<Image> images = imageRepository.findGallery(kind, used,
				Pageables.requireSortedOn(pageable, SORTABLE_PROPERTIES));
		Map<UUID, List<String>> usages = usagesOf(images.map(Image::getId).getContent());
		return images.map(image -> new GalleryImage(image.getId(), image.getKind(), image.getCreatedAt(),
				usages.getOrDefault(image.getId(), List.of())));
	}

	/** Opens a variant for the public site. Ids are random UUIDs, so they cannot be guessed. */
	public ImageStorage.StoredFile open(UUID id, int width) {
		return imageStorage.open(get(id).key(width));
	}

	/** An image of the gallery, to show it on a recipe or a category. */
	public Image get(UUID id) {
		return imageRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.IMAGE_NOT_FOUND));
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

	/** The recipes and categories showing it fall back to the default visual ({@code ON DELETE SET NULL}). */
	@Transactional
	public void delete(UUID id) {
		Image image = get(id);
		String folder = image.getS3Prefix();
		imageRepository.delete(image);
		onCompletion(TransactionSynchronization.STATUS_COMMITTED, () -> imageStorage.deleteFolder(folder));
	}

	/** All or none, in a single transaction: files are removed once every deletion is committed. */
	@Transactional
	public void deleteAll(Collection<UUID> ids) {
		new HashSet<>(ids).forEach(this::delete);
	}

	private Map<UUID, List<String>> usagesOf(List<UUID> imageIds) {
		if (imageIds.isEmpty()) {
			return Map.of();
		}
		return Stream.concat(imageRepository.findRecipeUsages(imageIds).stream(),
				imageRepository.findCategoryUsages(imageIds).stream())
			.collect(Collectors.groupingBy(ImageUsage::imageId,
					Collectors.mapping(ImageUsage::label, Collectors.toList())));
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
