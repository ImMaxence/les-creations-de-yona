package fr.lescreationsdeyona.monitoring;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Error log")
@RestController
class BrowserErrorController {

	/** What the browser says of an error: nothing of the visitor, only the page and the code. */
	record BrowserError(@NotBlank @Size(max = 2000) String message,
			@Schema(description = "Stack trace") @Size(max = 20_000) @Nullable String detail,
			@Schema(description = "The path of the page, without its query") @Size(max = 500) @Nullable String page) {
	}

	private final ErrorLog errorLog;

	BrowserErrorController(ErrorLog errorLog) {
		this.errorLog = errorLog;
	}

	@Operation(summary = "An error of a visitor's browser, for the error log of the back-office",
			description = "30 a minute at most for the whole site; beyond, they are left out. Always 204.")
	@PostMapping("/api/browser-errors")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void reportBrowserError(@Valid @RequestBody BrowserError error) {
		errorLog.addFromBrowser(error.message(), error.detail(), error.page());
	}

}
