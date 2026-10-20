package fr.lescreationsdeyona.image;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** S3-compatible storage of the images (SeaweedFS): only the endpoint differs between local and production. */
@Validated
@ConfigurationProperties("app.s3")
public record S3Properties(@NotNull URI endpoint, @NotBlank String region, @NotBlank String bucket,
		@NotBlank String accessKey, @NotBlank String secretKey) {

	@Override
	public String toString() {
		return "S3Properties[endpoint=%s, region=%s, bucket=%s]".formatted(endpoint, region, bucket);
	}

}
