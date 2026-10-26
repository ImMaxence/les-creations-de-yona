import { Injectable, computed } from '@angular/core';
import { storedSignal } from './stored-signal';

const STORAGE_KEY = 'yona-shopping-list';
const MAX_RECIPES = 30;
const MAX_EXTRAS = 50;

/** An ingredient line of a recipe, its quantity already adjusted to the servings chosen. */
export interface ShoppingLine {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface ShoppingRecipe {
  slug: string;
  title: string;
  /** For the link back to the recipe: /recettes/{categorySlug}/{slug}. */
  categorySlug: string;
  /** Servings the quantities are for; null when the recipe gives none. */
  servings: number | null;
  lines: ShoppingLine[];
}

interface ShoppingState {
  recipes: ShoppingRecipe[];
  /** Ingredients already in the basket, by key (lower-cased name). */
  checked: string[];
  /** Anything else to buy, typed by the visitor. */
  extras: string[];
}

const EMPTY: ShoppingState = { recipes: [], checked: [], extras: [] };

function isState(value: unknown): value is ShoppingState {
  const state = value as ShoppingState | null;
  return (
    !!state &&
    Array.isArray(state.recipes) &&
    Array.isArray(state.checked) &&
    Array.isArray(state.extras) &&
    state.recipes.every((recipe) => typeof recipe?.slug === 'string' && Array.isArray(recipe?.lines))
  );
}

/** Same key as the totals of recipe-parts.ts: one line per ingredient, whatever its case. */
export function ingredientKey(name: string): string {
  return name.toLocaleLowerCase('fr');
}

/**
 * The shopping list: ingredients of one recipe or several, kept in this browser only. Each recipe
 * is added with the servings chosen on its page; the list page adds up the same ingredients.
 */
@Injectable({ providedIn: 'root' })
export class ShoppingList {
  private readonly state = storedSignal<ShoppingState>(STORAGE_KEY, EMPTY, isState);

  readonly recipes = computed(() => this.state().recipes);
  readonly extras = computed(() => this.state().extras);
  readonly checked = computed(() => new Set(this.state().checked));
  readonly count = computed(() => this.state().recipes.length + this.state().extras.length);

  has(slug: string): boolean {
    return this.state().recipes.some((recipe) => recipe.slug === slug);
  }

  /** Added at the end, or updated in place (other servings). */
  add(recipe: ShoppingRecipe): void {
    this.state.update((state) => {
      const index = state.recipes.findIndex((existing) => existing.slug === recipe.slug);
      const recipes =
        index === -1
          ? [...state.recipes, recipe].slice(-MAX_RECIPES)
          : state.recipes.map((existing, position) => (position === index ? recipe : existing));
      return { ...state, recipes };
    });
  }

  remove(slug: string): void {
    this.state.update((state) => ({ ...state, recipes: state.recipes.filter((recipe) => recipe.slug !== slug) }));
  }

  toggle(key: string): void {
    this.state.update((state) => ({
      ...state,
      checked: state.checked.includes(key) ? state.checked.filter((item) => item !== key) : [...state.checked, key],
    }));
  }

  addExtra(item: string): void {
    const text = item.trim().slice(0, 100);
    if (text) {
      this.state.update((state) => ({ ...state, extras: [...state.extras, text].slice(-MAX_EXTRAS) }));
    }
  }

  removeExtra(index: number): void {
    this.state.update((state) => ({ ...state, extras: state.extras.filter((_item, position) => position !== index) }));
  }

  clear(): void {
    this.state.set(EMPTY);
  }
}
