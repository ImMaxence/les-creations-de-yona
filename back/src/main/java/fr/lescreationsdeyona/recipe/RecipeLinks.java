package fr.lescreationsdeyona.recipe;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * Where a recipe was linked when put in the trash, to put it back there on restore: its menus. The
 * observations of the recipes trashed before 2.4 ({@code observationIds}) are left: they are articles now.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RecipeLinks(List<MenuPlace> menus) {

	public static final RecipeLinks NONE = new RecipeLinks(List.of());

	/** {@code position}: its place in the menu, from 0. */
	public record MenuPlace(Long menuId, Integer position) {
	}

}
