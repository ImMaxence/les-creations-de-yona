package fr.lescreationsdeyona.image;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class TrashedImageTest {

	private final JsonMapper json = JsonMapper.builder().build();

	@Test
	void readsBackWhatTheTrashKeeps() {
		TrashedImage image = new TrashedImage(UUID.randomUUID(), ImageKind.GALLERY, "gallery/abc/",
				Instant.parse("2026-10-01T10:00:00Z"));
		TrashedImage.Links links = new TrashedImage.Links(List.of(1L, 2L), List.of(), List.of(3L), true);

		assertThat(json.readValue(json.writeValueAsString(image), TrashedImage.class)).isEqualTo(image);
		assertThat(json.readValue(json.writeValueAsString(links), TrashedImage.Links.class)).isEqualTo(links);
	}

}
