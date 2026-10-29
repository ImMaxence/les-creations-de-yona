import { CategoryResponse } from '../../core/api/generated/models/category-response';
import { RecipeCard } from '../../core/api/generated/models/recipe-card';

/** "Sucré" or "Salé": every recipe is one or the other. */
export type Theme = NonNullable<RecipeCard['theme']>;

/** In the order of a meal, as the site shows them: savory, then sweet. `slug`: in the URLs (?theme=sucre). */
export const THEMES: readonly { value: Theme; label: string; slug: string }[] = [
  { value: 'SAVORY', label: 'Salé', slug: 'sale' },
  { value: 'SWEET', label: 'Sucré', slug: 'sucre' },
];

export function themeLabel(theme: Theme | null | undefined): string {
  return THEMES.find((known) => known.value === theme)?.label ?? '';
}

/** "?theme=sale" → SAVORY; anything else → null. */
export function themeOfSlug(slug: string | null | undefined): Theme | null {
  return THEMES.find((known) => known.slug === slug)?.value ?? null;
}

export function themeSlug(theme: Theme): string {
  return THEMES.find((known) => known.value === theme)!.slug;
}


/**
 * The categories of a theme, for the menus of the site: those of that theme, and those holding
 * both ("Apéritifs") with a published recipe of it.
 */
export function categoriesOf<T extends Pick<CategoryResponse, 'theme' | 'publishedThemes'>>(categories: T[], theme: Theme): T[] {
  return categories.filter((category) => (category.theme ? category.theme === theme : category.publishedThemes.includes(theme)));
}

/** The recipes of a category, within a theme: a category holding both shows only those of the theme. */
export function categoryOfThemeQueryParams(category: Pick<CategoryResponse, 'slug' | 'theme'>, theme: Theme): Record<string, string> {
  return category.theme ? { categorie: category.slug } : { categorie: category.slug, theme: themeSlug(theme) };
}
