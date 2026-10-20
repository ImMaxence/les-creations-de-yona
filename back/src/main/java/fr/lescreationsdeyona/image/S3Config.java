package fr.lescreationsdeyona.image;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration(proxyBeanMethods = false)
class S3Config {

	@Bean
	S3Client s3Client(S3Properties properties) {
		return S3Client.builder()
			.endpointOverride(properties.endpoint())
			.region(Region.of(properties.region()))
			.credentialsProvider(StaticCredentialsProvider
				.create(AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())))
			// SeaweedFS serves buckets under the path (host/bucket/key), not as subdomains.
			.forcePathStyle(true)
			.build();
	}

}
