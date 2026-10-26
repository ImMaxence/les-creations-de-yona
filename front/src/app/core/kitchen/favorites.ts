import { Injectable, computed } from '@angular/core';
import { RecipeCard } from '../api/generated/models/recipe-card';
import { storedSignal } from './stored-signal';

const STORAGE_KEY = 'yona-favorites';
const MAX_FAVORITES = 200;

function isCardList(value: unknown): value is RecipeCard[] {
  return (
    Array.isArray(value) &&
    value.every(
      (card) =>
        typeof card?.slug === 'string' &&
        typeof card?.title === 'string' &&
        Array.isArray(card?.categories) &&
        card.categories.length > 0,
    )
  );
}

/**
 * Favorite recipes, without any account: kept in this browser only, the latest first. Each one is
 * kept as a card (title, photo, categories), so that the "Mes favoris" page shows them offline
 * too; the recipe pages already visited are cached by the installed app.
 */
@Injectable({ providedIn: 'root' })
export class Favorites {
  private readonly cards = storedSignal<RecipeCard[]>(STORAGE_KEY, [], isCardList);

  readonly list = this.cards.asReadonly();
  readonly count = computed(() => this.cards().length);

  has(slug: string): boolean {
    return this.cards().some((card) => card.slug === slug);
  }

  /** Added first, or removed; true when it is now a favorite. */
  toggle(recipe: RecipeCard): boolean {
    if (this.has(recipe.slug)) {
      this.remove(recipe.slug);
      return false;
    }
    const { title, slug, imageId, createdAt, categories } = recipe;
    this.cards.update((cards) => [{ title, slug, imageId, createdAt, categories }, ...cards].slice(0, MAX_FAVORITES));
    return true;
  }

  remove(slug: string): void {
    this.cards.update((cards) => cards.filter((card) => card.slug !== slug));
  }
}
