package fr.lescreationsdeyona.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class YoutubeVideosTest {

	@ParameterizedTest
	@ValueSource(strings = { "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=42s", "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtu.be/dQw4w9WgXcQ?si=abc", "https://www.youtube.com/shorts/dQw4w9WgXcQ",
			"https://www.youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/live/dQw4w9WgXcQ",
			"  https://youtu.be/dQw4w9WgXcQ  " })
	void readsTheIdOfTheLinksAnAdminPastes(String url) {
		assertThat(YoutubeVideos.videoId(url)).contains("dQw4w9WgXcQ");
	}

	@ParameterizedTest
	@ValueSource(strings = { "http://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=short",
			"https://vimeo.com/123456789", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
			"https://www.youtube.com/@yona" })
	void refusesAnythingElse(String url) {
		assertThat(YoutubeVideos.videoId(url)).isEmpty();
	}

}
