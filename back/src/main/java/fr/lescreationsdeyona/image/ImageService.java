package fr.lescreationsdeyona.image;

import fr.lescreationsdeyona.common.Pageables;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.Set;
import java.util.UUID;
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
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ImageService {

	private static final Logger log = LoggerFactory.getLogger(ImageService.class);

	private static final Set<String> SORTABLE_PROPERTIES = Set.of("createdAt");

	private final ImageRepository imageRepository;

	private final ImageStorage imageStorage;

	public Page<GalleryImage> gallery(@Nullable ImageKind kind, Pageable pageable) {
		return imageRepository.findGallery(kind, Pageables.requireSortedOn(pageable, SORTABLE_PROPERTIES));
	}

	/** Opens a variant for the public site. Ids are random UUIDs, so they cannot be guessed. */
	public ImageStorage.StoredFile open(UUID id, int width) {
		return imageStorage.open(find(id).key(width));
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

	/** The recipe or category showing it falls back to the default visual ({@code ON DELETE SET NULL}). */
	@Transactional(propagation = Propagation.MANDATORY)
	public void delete(Image image) {
		String folder = image.getS3Prefix();
		imageRepository.delete(image);
		onCompletion(TransactionSynchronization.STATUS_COMMITTED, () -> imageStorage.deleteFolder(folder));
	}

	@Transactional
	public void delete(UUID id) {
		delete(find(id));
	}

	private Image find(UUID id) {
		return imageRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.IMAGE_NOT_FOUND));
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
