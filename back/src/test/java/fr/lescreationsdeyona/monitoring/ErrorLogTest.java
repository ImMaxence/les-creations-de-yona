package fr.lescreationsdeyona.monitoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

class ErrorLogTest {

	private final ErrorLog errorLog = new ErrorLog(mock(JdbcClient.class), mock(AdminSeen.class));

	@AfterEach
	void detach() {
		errorLog.detach();
	}

	@Test
	void takesThirtyBrowserErrorsAMinuteAtMost() {
		for (int index = 0; index < 40; index++) {
			errorLog.addFromBrowser("TypeError: x is undefined " + index, null, "/recettes");
		}

		assertThat(errorLog.waiting()).hasSize(ErrorLog.BROWSER_ERRORS_PER_MINUTE);
	}

	@Test
	void keepsOnlyThePathOfThePage() {
		assertThat(ErrorLog.pathOf("/boutique/commande/abc123?merci=1#haut")).isEqualTo("/boutique/commande/abc123");
		assertThat(ErrorLog.pathOf("/recettes#top")).isEqualTo("/recettes");
		assertThat(ErrorLog.pathOf("/recettes")).isEqualTo("/recettes");
		assertThat(ErrorLog.pathOf(null)).isNull();
	}

	@Test
	void groupsTheSameBrowserErrorFromTheSamePlace() {
		String stack = "TypeError: x is undefined\n    at Recipe.ngOnInit (main.js:1:200)\n    at callHook (main.js:1:900)";
		errorLog.addFromBrowser("TypeError: x is undefined", stack, "/recettes/a");
		errorLog.addFromBrowser("TypeError: x is undefined", stack, "/recettes/b");
		errorLog.addFromBrowser("TypeError: x is undefined", "TypeError: x is undefined\n    at Shop.load (main.js:9:1)", "/boutique");

		assertThat(errorLog.waiting().get(0).fingerprint()).isEqualTo(errorLog.waiting().get(1).fingerprint());
		assertThat(errorLog.waiting().get(2).fingerprint()).isNotEqualTo(errorLog.waiting().get(0).fingerprint());
		assertThat(errorLog.waiting().get(0).source()).isEqualTo(LoggedProblem.Source.BROWSER);
	}

	@Test
	void cutsWhatIsTooLong() {
		errorLog.addFromBrowser("e".repeat(3000), null, null);

		assertThat(errorLog.waiting().getFirst().message()).hasSize(LoggedProblem.MAX_MESSAGE).endsWith("…");
	}

}
