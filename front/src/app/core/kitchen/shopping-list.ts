import { Injectable, computed } from '@angular/core';
import { RecipeDetail } from '../api/generated/models/recipe-detail';
import { roundForKitchen } from '../../shared/format/units';
import { mainCategory } from '../../shared/routing/links';
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
  /** Servings the quantities of `lines` are for; null when the recipe gives none. */
  servings: number | null;
  /** Servings chosen on the list page afterwards, the quantities following; absent: `servings`. */
  chosenServings?: number;
  lines: ShoppingLine[];
}

/** Changed on the list page, one by one. */
export const MAX_LIST_SERVINGS = 50;

/** The servings the recipe is on the list for: those chosen on the list, else those added. */
export function shownServings(recipe: ShoppingRecipe): number | null {
  return recipe.servings ? (recipe.chosenServings ?? recipe.servings) : null;
}

/** Its lines for the servings chosen on the list, rounded to measurable values. */
export function linesFor(recipe: ShoppingRecipe): ShoppingLine[] {
  const servings = shownServings(recipe);
  const ratio = recipe.servings && servings ? servings / recipe.servings : 1;
  return ratio === 1
    ? recipe.lines
    : recipe.lines.map((line) => ({ ...line, quantity: line.quantity == null ? null : roundForKitchen(line.quantity * ratio) }));
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

/**
 * A recipe as the list keeps it: its lines with the quantities shown (multiplied by ratio, then
 * rounded to measurable values), for the servings given.
 */
export function shoppingRecipeOf(recipe: RecipeDetail, ratio = 1, servings = recipe.servings ?? null): ShoppingRecipe {
  return {
    slug: recipe.slug,
    title: recipe.title,
    categorySlug: mainCategory(recipe).slug,
    servings,
    lines: recipe.parts.flatMap((part) =>
      part.ingredients.map((line) => ({
        name: line.name,
        quantity: line.quantity == null ? null : ratio === 1 ? line.quantity : roundForKitchen(line.quantity * ratio),
        unit: line.unit ?? null,
      })),
    ),
  };
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

  /** For as many people, from the list page: the quantities of the recipe follow. */
  setServings(slug: string, servings: number): void {
    const count = Math.min(MAX_LIST_SERVINGS, Math.max(1, Math.round(servings)));
    this.state.update((state) => ({
      ...state,
      recipes: state.recipes.map((recipe) =>
        recipe.slug === slug && recipe.servings ? { ...recipe, chosenServings: count } : recipe,
      ),
    }));
  }

  /** Added at the end, or updated in place (other servings, those chosen on the list forgotten). */
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
