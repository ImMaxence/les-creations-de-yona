package fr.lescreationsdeyona.indexnow;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class IndexNowTest {

	private final IndexNow indexNow = new IndexNow(true, "f5d890788ccc4557ecd282dea7299d26",
			URI.create("https://les-creations-de-yona.fr"), JsonMapper.builder().build());

	@Test
	void sendsAbsoluteAddressesWithWhereTheKeyIs() {
		Map<String, Object> body = indexNow.body(List.of("/recettes/desserts/tarte", "/recettes/plats/gratin"));

		assertThat(body).containsExactly(Map.entry("host", "les-creations-de-yona.fr"),
				Map.entry("key", "f5d890788ccc4557ecd282dea7299d26"),
				Map.entry("keyLocation", "https://les-creations-de-yona.fr/f5d890788ccc4557ecd282dea7299d26.txt"),
				Map.entry("urlList", List.of("https://les-creations-de-yona.fr/recettes/desserts/tarte",
						"https://les-creations-de-yona.fr/recettes/plats/gratin")));
	}

}
