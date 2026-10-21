import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { LucideCheck, LucideMinus, LucidePlus, LucideSun } from '@lucide/angular';
import { IngredientLine } from '../../../core/api/generated/models/ingredient-line';
import { formatQuantity, roundForKitchen } from '../../../shared/format/units';

const MAX_SERVINGS = 50;

/**
 * Ingredients of a recipe, made for cooking with a phone: servings can be changed (quantities
 * follow), ingredients can be ticked off, and the screen can be kept on.
 */
@Component({
  selector: 'yona-recipe-ingredients',
  imports: [LucideCheck, LucideMinus, LucidePlus, LucideSun],
  templateUrl: './recipe-ingredients.html',
  styleUrl: './recipe-ingredients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeIngredients {
  readonly ingredients = input.required<IngredientLine[]>();
  /** Servings of the recipe as written, if given. */
  readonly servings = input<number>();

  protected readonly maxServings = MAX_SERVINGS;
  /** Servings chosen by the visitor; back to the recipe's own when the recipe changes. */
  protected readonly chosenServings = linkedSignal(() => this.servings() ?? null);
  protected readonly lines = computed(() => {
    const base = this.servings();
    const chosen = this.chosenServings();
    const ratio = base && chosen ? chosen / base : 1;
    return this.ingredients().map((ingredient) => ({
      ...ingredient,
      quantity:
        ingredient.quantity == null
          ? null
          : formatQuantity(ratio === 1 ? ingredient.quantity : roundForKitchen(ingredient.quantity * ratio)),
    }));
  });
  protected readonly checked = linkedSignal<IngredientLine[], ReadonlySet<number>>({
    source: this.ingredients,
    computation: () => new Set(),
  });

  /** Screen Wake Lock: offered only where the browser has it. */
  protected readonly wakeLockSupported = signal(false);
  protected readonly screenKeptOn = signal(false);
  private wakeLock: WakeLockSentinel | null = null;

  constructor() {
    afterNextRender(() => this.wakeLockSupported.set('wakeLock' in navigator));
    inject(DestroyRef).onDestroy(() => void this.wakeLock?.release());
  }

  protected changeServings(delta: number): void {
    this.chosenServings.update((servings) =>
      servings === null ? null : Math.min(MAX_SERVINGS, Math.max(1, servings + delta)),
    );
  }

  protected toggle(index: number): void {
    this.checked.update((current) => {
      const next = new Set(current);
      if (!next.delete(index)) {
        next.add(index);
      }
      return next;
    });
  }

  protected async toggleScreenOn(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release();
      return;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.screenKeptOn.set(true);
      // Also released by the browser itself, e.g. when the tab is hidden
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
        this.screenKeptOn.set(false);
      });
    } catch {
      this.screenKeptOn.set(false);
    }
  }
}
