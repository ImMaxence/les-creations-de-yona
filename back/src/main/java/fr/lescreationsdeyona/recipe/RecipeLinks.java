package fr.lescreationsdeyona.recipe;

import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * Where a recipe was linked when put in the trash, to put it back there on restore: its menus, and the
 * observations about it ({@code observationIds}: absent from the recipes trashed before 2.0).
 */
public record RecipeLinks(List<MenuPlace> menus, @Nullable List<Long> observationIds) {

	public static final RecipeLinks NONE = new RecipeLinks(List.of());

	public RecipeLinks {
		observationIds = observationIds == null ? List.of() : observationIds;
	}

	public RecipeLinks(List<MenuPlace> menus) {
		this(menus, List.of());
	}

	/** {@code position}: its place in the menu, from 0. */
	public record MenuPlace(Long menuId, Integer position) {
	}

}
