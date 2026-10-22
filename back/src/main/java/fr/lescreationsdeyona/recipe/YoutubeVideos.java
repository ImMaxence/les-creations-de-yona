package fr.lescreationsdeyona.recipe;

import java.util.Optional;
import java.util.regex.Pattern;

/** Reads the video id of the YouTube links an admin is likely to paste. */
final class YoutubeVideos {

	/**
	 * youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, /embed/ID or /live/ID, with or
	 * without www or m., and any trailing parameters (?si=…, &t=42s).
	 */
	private static final Pattern VIDEO_URL = Pattern.compile(
			"^https://(?:(?:www|m)\\.)?(?:youtube\\.com/(?:watch\\?(?:[^#]*&)?v=|shorts/|embed/|live/)|youtu\\.be/)"
					+ "([A-Za-z0-9_-]{11})(?:[?&#/].*)?$");

	private YoutubeVideos() {
	}

	static Optional<String> videoId(String url) {
		var matcher = VIDEO_URL.matcher(url.strip());
		return matcher.matches() ? Optional.of(matcher.group(1)) : Optional.empty();
	}

}