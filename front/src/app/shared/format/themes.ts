import { RecipeCard } from '../../core/api/generated/models/recipe-card';

/** "Sucré" or "Salé": every recipe is one or the other. */
export type Theme = NonNullable<RecipeCard['theme']>;

/** In the order of the site: sweet first, the site being mostly pastry. `slug`: in the URLs (?theme=sucre). */
export const THEMES: readonly { value: Theme; label: string; slug: string }[] = [
  { value: 'SWEET', label: 'Sucré', slug: 'sucre' },
  { value: 'SAVORY', label: 'Salé', slug: 'sale' },
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

