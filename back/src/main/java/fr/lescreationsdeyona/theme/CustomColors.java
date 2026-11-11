package fr.lescreationsdeyona.theme;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Colors chosen by hand, for the theme "Personnalisé": four for the light version, four for the
 * dark one. The other shades (muted text, accent pressed, decoration, text on the accent) are
 * derived from them in the front.
 */
public record CustomColors(@Valid @NotNull CustomPalette light, @Valid @NotNull CustomPalette dark) {

	static final String HEX = "^#[0-9a-fA-F]{6}$";

	/** "#fcf9f5": the background of the pages, of the cards and panels, the text, the buttons and links. */
	public record CustomPalette(
			@Schema(description = "Background of the pages") @NotNull @Pattern(regexp = HEX) String bg,
			@Schema(description = "Cards, panels, footer") @NotNull @Pattern(regexp = HEX) String surface,
			@NotNull @Pattern(regexp = HEX) String text,
			@Schema(description = "Buttons, links, active states") @NotNull @Pattern(regexp = HEX) String accent) {
	}

}
