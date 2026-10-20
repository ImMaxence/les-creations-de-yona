package fr.lescreationsdeyona.image;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.io.InputStream;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Object;

/** The private image bucket. Only the backend reads and writes it. */
@Component
@RequiredArgsConstructor
public class ImageStorage {

	private static final String WEBP = "image/webp";

	private final S3Client s3;

	private final S3Properties properties;

	/** A file being read: the caller must close {@code content}. */
	public record StoredFile(String key, long size, InputStream content) {
	}

	void putWebp(String key, byte[] content) {
		s3.putObject(request -> request.bucket(properties.bucket()).key(key).contentType(WEBP),
				RequestBody.fromBytes(content));
	}

	public StoredFile open(String key) {
		try {
			ResponseInputStream<GetObjectResponse> content = s3
				.getObject(request -> request.bucket(properties.bucket()).key(key));
			return new StoredFile(key, content.response().contentLength(), content);
		}
		catch (NoSuchKeyException ex) {
			throw new ApiException(ErrorCode.IMAGE_NOT_FOUND, ex);
		}
	}

	/** Every key under the prefix (the whole bucket for an empty prefix), listed page by page. */
	public Stream<String> listKeys(String prefix) {
		return s3.listObjectsV2Paginator(request -> request.bucket(properties.bucket()).prefix(prefix))
			.contents()
			.stream()
			.map(S3Object::key);
	}

	void deleteFolder(String prefix) {
		// Listed before deleting, so that deletions cannot shift the pages being read.
		listKeys(prefix).toList()
			.forEach(key -> s3.deleteObject(request -> request.bucket(properties.bucket()).key(key)));
	}

}
