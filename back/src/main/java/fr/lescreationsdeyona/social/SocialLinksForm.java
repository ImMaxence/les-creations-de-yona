package fr.lescreationsdeyona.social;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.hibernate.validator.constraints.URL;

/** The full list of social links, in display order: it replaces the previous one. */
public record SocialLinksForm(@NotNull @Size(max = 10) List<@Valid @NotNull Link> links) {

	public record Link(@NotNull SocialPlatform platform,
			@NotBlank @Size(max = 500) @URL(protocol = "https") String url) {
	}

}
