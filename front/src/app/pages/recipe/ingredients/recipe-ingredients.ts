import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { LucideMinus, LucidePlus, LucideSun } from '@lucide/angular';
import { IngredientList } from '../ingredient-list/ingredient-list';
import { ShownIngredient } from '../recipe-parts';

const MAX_SERVINGS = 50;

/**
 * Ingredients of the whole recipe, made for cooking with a phone: servings can be changed
 * (quantities follow, here and in the parts), ingredients can be ticked off, and the screen can be
 * kept on.
 */
@Component({
  selector: 'yona-recipe-ingredients',
  imports: [IngredientList, LucideMinus, LucidePlus, LucideSun],
  templateUrl: './recipe-ingredients.html',
  styleUrl: './recipe-ingredients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeIngredients {
  /** Already adjusted to the chosen servings. */
  readonly lines = input.required<ShownIngredient[]>();
  /** Servings chosen by the visitor; null when the recipe gives none. */
  readonly servings = model<number | null>(null);
  /** Several parts: the list is their total. */
  readonly partCount = input(1);

  protected readonly maxServings = MAX_SERVINGS;

  /** Screen Wake Lock: offered only where the browser has it. */
  protected readonly wakeLockSupported = signal(false);
  protected readonly screenKeptOn = signal(false);
  private wakeLock: WakeLockSentinel | null = null;

  constructor() {
    afterNextRender(() => this.wakeLockSupported.set('wakeLock' in navigator));
    inject(DestroyRef).onDestroy(() => void this.wakeLock?.release());
  }

  protected changeServings(delta: number): void {
    this.servings.update((servings) =>
      servings === null ? null : Math.min(MAX_SERVINGS, Math.max(1, servings + delta)),
    );
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
