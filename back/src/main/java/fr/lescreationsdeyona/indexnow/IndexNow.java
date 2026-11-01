package fr.lescreationsdeyona.indexnow;

import fr.lescreationsdeyona.recipe.RecipePagesChanged;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import tools.jackson.databind.json.JsonMapper;

/**
 * Tells search engines at once that recipe pages changed (https://www.indexnow.org): Bing, which
 * ChatGPT Search and Copilot rely on, crawls them within hours instead of weeks. The key proves the
 * site is ours: the front serves it at {@code /{key}.txt}. Production only (app.indexnow.enabled):
 * a local publication must not send the production addresses.
 */
@Service
public class IndexNow {

	private static final Logger log = LoggerFactory.getLogger(IndexNow.class);

	/** Shared with every engine taking part (Bing, Yandex, Naver, Seznam…). */
	private static final URI ENDPOINT = URI.create("https://api.indexnow.org/indexnow");

	private static final Duration TIMEOUT = Duration.ofSeconds(15);

	private final boolean enabled;

	private final String key;

	private final URI site;

	private final JsonMapper jsonMapper;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

	/** In the background: saving a recipe does not wait for the search engines. */
	private final ExecutorService sender = Executors.newSingleThreadExecutor(Thread.ofVirtual().name("indexnow").factory());

	IndexNow(@Value("${app.indexnow.enabled}") boolean enabled, @Value("${app.indexnow.key}") String key,
			@Value("${app.site-url}") URI site, JsonMapper jsonMapper) {
		this.enabled = enabled;
		this.key = key;
		this.site = site;
		this.jsonMapper = jsonMapper;
	}

	/** Once the change is committed: a rolled back save tells nobody. */
	@TransactionalEventListener
	void onRecipePagesChanged(RecipePagesChanged changed) {
		if (enabled) {
			sender.execute(() -> submit(changed.paths()));
		}
	}

	@PreDestroy
	void stop() {
		sender.shutdownNow();
	}

	private void submit(List<String> paths) {
		HttpRequest request = HttpRequest.newBuilder(ENDPOINT)
			.timeout(TIMEOUT)
			.header("Content-Type", "application/json; charset=utf-8")
			.POST(HttpRequest.BodyPublishers.ofByteArray(jsonMapper.writeValueAsBytes(body(paths))))
			.build();
		try {
			int status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
			// 200: received; 202: received, the key still being checked
			if (status / 100 == 2) {
				log.info("IndexNow told of {}", paths);
			}
			else {
				log.warn("IndexNow answered {} for {}", status, paths);
			}
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
		}
		catch (IOException ex) {
			log.warn("IndexNow unreachable, {} not told", paths, ex);
		}
	}

	/** The pages as absolute addresses, with where the engines check the key. */
	Map<String, Object> body(List<String> paths) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("host", site.getHost());
		body.put("key", key);
		body.put("keyLocation", site.resolve("/" + key + ".txt").toString());
		body.put("urlList", paths.stream().map(path -> site.resolve(path).toString()).toList());
		return body;
	}

}
