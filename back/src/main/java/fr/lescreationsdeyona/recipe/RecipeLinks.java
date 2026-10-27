package fr.lescreationsdeyona.recipe;

import java.util.List;

/** The menus a recipe was in when put in the trash, to put it back there on restore. */
public record RecipeLinks(List<MenuPlace> menus) {

	public static final RecipeLinks NONE = new RecipeLinks(List.of());

	/** {@code position}: its place in the menu, from 0. */
	public record MenuPlace(Long menuId, Integer position) {
	}

}
