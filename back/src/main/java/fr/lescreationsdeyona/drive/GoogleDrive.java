package fr.lescreationsdeyona.drive;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Google's OAuth and Drive APIs, called directly over HTTPS. The site only asks for
 * {@code drive.file}: it sees and changes the files it created itself, nothing else of the Drive.
 */
@Component
class GoogleDrive {

	static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

	private static final String AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

	private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";

	private static final String REVOKE_URL = "https://oauth2.googleapis.com/revoke";

	private static final String FILES_URL = "https://www.googleapis.com/drive/v3/files";

	private static final String UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

	private static final String FOLDER_TYPE = "application/vnd.google-apps.folder";

	/** Resumable uploads go by multiples of 256 KiB. */
	private static final int CHUNK_BYTES = 64 * 256 * 1024;

	private static final int MAX_RETRIES = 5;

	private static final Duration TIMEOUT = Duration.ofMinutes(2);

	private static final Pattern RANGE_END = Pattern.compile("bytes=0-(\\d+)");

	private final String clientId;

	private final String clientSecret;

	private final JsonMapper jsonMapper;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();

	GoogleDrive(@Value("${spring.security.oauth2.client.registration.google.client-id}") String clientId,
			@Value("${spring.security.oauth2.client.registration.google.client-secret}") String clientSecret,
			JsonMapper jsonMapper) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.jsonMapper = jsonMapper;
	}

	/** A failure explained in French, for the back-office. */
	static class DriveException extends Exception {

		/** The access was withdrawn (or expired): only connecting the account again helps. */
		final boolean revoked;

		DriveException(String message) {
			this(message, false, null);
		}

		DriveException(String message, boolean revoked, @Nullable Throwable cause) {
			super(message, cause);
			this.revoked = revoked;
		}

	}

	record Tokens(String accessToken, String refreshToken, String email) {
	}

	record DriveFile(String id, String name) {
	}

	private record TokenResponse(@JsonProperty("access_token") String accessToken,
			@JsonProperty("refresh_token") @Nullable String refreshToken, @JsonProperty("id_token") @Nullable String idToken,
			@Nullable String scope) {
	}

	private record IdTokenClaims(@Nullable String email) {
	}

	private record Created(String id) {
	}

	private record FileState(String id, boolean trashed) {
	}

	private record FileList(List<DriveFile> files) {
	}

	/**
	 * Google's consent page: Drive access for files created by the site, kept while the admin is
	 * away ({@code offline}), asked again each time so that a refresh token always comes back.
	 */
	String authorizationUrl(String redirectUri, String state, String loginHint) {
		return AUTHORIZE_URL + "?" + form(Map.of("client_id", clientId, "redirect_uri", redirectUri, "response_type", "code",
				"scope", "openid email " + DRIVE_SCOPE, "access_type", "offline", "prompt", "consent", "state", state,
				"login_hint", loginHint));
	}

	Tokens exchange(String code, String redirectUri) throws DriveException {
		TokenResponse tokens = token(Map.of("code", code, "client_id", clientId, "client_secret", clientSecret,
				"redirect_uri", redirectUri, "grant_type", "authorization_code"));
		if (tokens.scope() == null || !tokens.scope().contains(DRIVE_SCOPE)) {
			throw new DriveException("L'accès à Google Drive n'a pas été autorisé : recommencez en cochant la case Google Drive.");
		}
		if (tokens.refreshToken() == null || tokens.idToken() == null) {
			throw new DriveException("Google n'a pas donné d'accès durable : recommencez la connexion.");
		}
		// Received from Google itself over HTTPS: its claims can be read without checking the signature
		String[] parts = tokens.idToken().split("\\.");
		String email = parts.length < 2 ? null
				: jsonMapper.readValue(Base64.getUrlDecoder().decode(parts[1]), IdTokenClaims.class).email();
		if (email == null) {
			throw new DriveException("Google n'a pas indiqué l'adresse du compte : recommencez la connexion.");
		}
		return new Tokens(tokens.accessToken(), tokens.refreshToken(), email);
	}

	String accessToken(String refreshToken) throws DriveException {
		return token(Map.of("refresh_token", refreshToken, "client_id", clientId, "client_secret", clientSecret,
				"grant_type", "refresh_token")).accessToken();
	}

	/** Best effort: the account can also remove the site from its Google settings. */
	void revoke(String refreshToken) {
		try {
			http.send(HttpRequest.newBuilder(URI.create(REVOKE_URL))
				.timeout(TIMEOUT)
				.header("Content-Type", "application/x-www-form-urlencoded")
				.POST(HttpRequest.BodyPublishers.ofString(form(Map.of("token", refreshToken))))
				.build(), HttpResponse.BodyHandlers.discarding());
		}
		catch (IOException ex) {
			// The token stays valid on Google's side until the account removes the site
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
		}
	}

	String createFolder(String accessToken, String name) throws DriveException {
		HttpResponse<String> response = send(authorized(URI.create(FILES_URL + "?fields=id"), accessToken)
			.header("Content-Type", "application/json; charset=UTF-8")
			.POST(json(Map.of("name", name, "mimeType", FOLDER_TYPE)))
			.build(), "créer le dossier des sauvegardes");
		return jsonMapper.readValue(response.body(), Created.class).id();
	}

	/** False when the admin deleted the folder or put it in the bin. */
	boolean folderUsable(String accessToken, String folderId) throws DriveException {
		HttpResponse<String> response = send(authorized(
				URI.create(FILES_URL + "/" + encode(folderId) + "?fields=id,trashed"), accessToken).GET().build(), null);
		if (response.statusCode() == 404) {
			return false;
		}
		requireSuccess(response, "retrouver le dossier des sauvegardes");
		return !jsonMapper.readValue(response.body(), FileState.class).trashed();
	}

	/**
	 * Resumable upload by chunks of 16 MiB: a chunk that fails is sent again from where Google says
	 * it stopped, a few times. Returns the id of the file created.
	 */
	String upload(String accessToken, String folderId, Path file, String name) throws DriveException, IOException {
		long size = Files.size(file);
		HttpResponse<String> started = send(authorized(URI.create(UPLOAD_URL + "?uploadType=resumable&fields=id"), accessToken)
			.header("Content-Type", "application/json; charset=UTF-8")
			.header("X-Upload-Content-Type", "application/zip")
			.header("X-Upload-Content-Length", String.valueOf(size))
			.POST(json(Map.of("name", name, "parents", List.of(folderId), "mimeType", "application/zip")))
			.build(), "commencer l'envoi");
		URI session = URI.create(started.headers().firstValue("Location")
			.orElseThrow(() -> new DriveException("Google Drive n'a pas ouvert l'envoi du fichier.")));
		long offset = 0;
		int failures = 0;
		boolean askWhereItStopped = false;
		try (FileChannel channel = FileChannel.open(file)) {
			while (true) {
				HttpResponse<String> response;
				try {
					HttpRequest.Builder request = HttpRequest.newBuilder(session).timeout(TIMEOUT);
					if (askWhereItStopped) {
						request.header("Content-Range", "bytes */" + size).PUT(HttpRequest.BodyPublishers.noBody());
					}
					else {
						byte[] chunk = read(channel, offset, (int) Math.min(CHUNK_BYTES, size - offset));
						request.header("Content-Range", "bytes " + offset + "-" + (offset + chunk.length - 1) + "/" + size)
							.PUT(HttpRequest.BodyPublishers.ofByteArray(chunk));
					}
					response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
				}
				catch (IOException ex) {
					response = null;
				}
				catch (InterruptedException ex) {
					Thread.currentThread().interrupt();
					throw new DriveException("Sauvegarde interrompue.", false, ex);
				}
				if (response != null && response.statusCode() / 100 == 2) {
					return jsonMapper.readValue(response.body(), Created.class).id();
				}
				if (response != null && response.statusCode() == 308) {
					offset = response.headers().firstValue("Range").map(GoogleDrive::nextOffset).orElse(0L);
					askWhereItStopped = false;
					continue;
				}
				if (response != null && response.statusCode() / 100 == 4) {
					throw new DriveException("Google Drive a refusé le fichier (erreur " + response.statusCode() + ").");
				}
				if (++failures > MAX_RETRIES) {
					throw new DriveException("L'envoi vers Google Drive a échoué plusieurs fois de suite.");
				}
				askWhereItStopped = true;
				pause(failures);
			}
		}
	}

	/** The backups of the folder, the newest first. */
	List<DriveFile> backups(String accessToken, String folderId) throws DriveException {
		String query = "'" + folderId.replace("'", "\\'") + "' in parents and trashed = false and mimeType = 'application/zip'";
		HttpResponse<String> response = send(authorized(URI.create(FILES_URL + "?" + form(Map.of("q", query,
				"orderBy", "createdTime desc", "fields", "files(id,name)", "pageSize", "100", "spaces", "drive"))),
				accessToken).GET().build(), "lister les sauvegardes");
		return jsonMapper.readValue(response.body(), FileList.class).files();
	}

	/** For good, not to the bin: the space is freed at once. */
	void delete(String accessToken, String fileId) throws DriveException {
		send(authorized(URI.create(FILES_URL + "/" + encode(fileId)), accessToken).DELETE().build(),
				"supprimer une ancienne sauvegarde");
	}

	private TokenResponse token(Map<String, String> parameters) throws DriveException {
		HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(TOKEN_URL))
			.timeout(TIMEOUT)
			.header("Content-Type", "application/x-www-form-urlencoded")
			.POST(HttpRequest.BodyPublishers.ofString(form(parameters)))
			.build(), null);
		if (response.statusCode() == 400 && response.body().contains("invalid_grant")) {
			throw new DriveException("L'accès à Google Drive a été retiré ou a expiré : reconnectez le compte.", true, null);
		}
		requireSuccess(response, "obtenir l'accès à Google Drive");
		return jsonMapper.readValue(response.body(), TokenResponse.class);
	}

	/** {@code action} null: the caller checks the status itself. */
	private HttpResponse<String> send(HttpRequest request, @Nullable String action) throws DriveException {
		try {
			HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
			if (action != null) {
				requireSuccess(response, action);
			}
			return response;
		}
		catch (IOException ex) {
			throw new DriveException("Google Drive est injoignable pour le moment.", false, ex);
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			throw new DriveException("Sauvegarde interrompue.", false, ex);
		}
	}

	private static void requireSuccess(HttpResponse<String> response, String action) throws DriveException {
		if (response.statusCode() / 100 != 2) {
			throw new DriveException("Impossible de " + action + " sur Google Drive (erreur " + response.statusCode() + ").",
					response.statusCode() == 401, null);
		}
	}

	private static HttpRequest.Builder authorized(URI uri, String accessToken) {
		return HttpRequest.newBuilder(uri).timeout(TIMEOUT).header("Authorization", "Bearer " + accessToken);
	}

	private HttpRequest.BodyPublisher json(Map<String, Object> body) {
		return HttpRequest.BodyPublishers.ofByteArray(jsonMapper.writeValueAsBytes(body));
	}

	private static byte[] read(FileChannel channel, long offset, int length) throws IOException {
		ByteBuffer buffer = ByteBuffer.allocate(length);
		while (buffer.hasRemaining()) {
			if (channel.read(buffer, offset + buffer.position()) < 0) {
				throw new IOException("Backup file shorter than expected");
			}
		}
		return buffer.array();
	}

	/** "Range: bytes=0-1048575": the next byte to send is 1048576. */
	private static long nextOffset(String range) {
		Matcher matcher = RANGE_END.matcher(range);
		return matcher.find() ? Long.parseLong(matcher.group(1)) + 1 : 0;
	}

	private static void pause(int failures) throws DriveException {
		try {
			Thread.sleep(Duration.ofSeconds(5L * failures));
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			throw new DriveException("Sauvegarde interrompue.", false, ex);
		}
	}

	private static String form(Map<String, String> parameters) {
		return parameters.entrySet().stream()
			.map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
			.collect(Collectors.joining("&"));
	}

	private static String encode(String value) {
		return URLEncoder.encode(value, StandardCharsets.UTF_8);
	}

}
