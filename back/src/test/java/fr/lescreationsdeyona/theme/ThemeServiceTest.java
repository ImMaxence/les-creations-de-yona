package fr.lescreationsdeyona.theme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.error.ErrorCode;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ThemeServiceTest {

	private final JsonMapper json = JsonMapper.builder().build();

	private final ThemeService service = new ThemeService(mock(SiteThemeRepository.class), mock(AuditLog.class), json);

	@Test
	void asksForTheColorsOfACustomTheme() {
		ThemeForm form = new ThemeForm(ThemePreset.PERSONNALISE, DisplayFont.FRAUNCES, BodyFont.INTER, 16, null);

		assertThatThrownBy(() -> service.update(form)).extracting("code").isEqualTo(ErrorCode.THEME_CUSTOM_COLORS_REQUIRED);
	}

	@Test
	void readsTheColorsAsKept() {
		CustomColors colors = new CustomColors(new CustomColors.CustomPalette("#fcf9f5", "#f4e7e6", "#36221c", "#8c533e"),
				new CustomColors.CustomPalette("#1d1512", "#2b201c", "#f4ebe6", "#e4a58c"));

		assertThat(ThemeService.customColors(json, json.writeValueAsString(colors))).isEqualTo(colors);
		assertThat(ThemeService.customColors(json, null)).isNull();
		assertThat(ThemeService.customColors(json, "{broken")).isNull();
	}

}
