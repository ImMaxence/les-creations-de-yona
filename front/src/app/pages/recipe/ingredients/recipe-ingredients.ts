import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { Mold } from '../../../core/api/generated/models/mold';
import { formatQuantity } from '../../../shared/format/units';
import { Icon } from '../../../shared/ui/icon/icon';
import { IngredientList } from '../ingredient-list/ingredient-list';
import { ShownIngredient, describeMold, moldArea } from '../recipe-parts';

const MAX_SERVINGS = 50;
const SHAPES: { shape: Mold['shape']; label: string }[] = [
  { shape: 'ROUND', label: 'Rond' },
  { shape: 'SQUARE', label: 'Carré' },
  { shape: 'RECTANGLE', label: 'Rectangle' },
];
const MIN_CM = 4;
const MAX_CM = 80;

/**
 * Ingredients of the whole recipe, made for cooking with a phone: servings can be changed, or the
 * quantities adapted to the visitor's mold (quantities follow, here and in the parts), ingredients
 * can be ticked off, and the screen can be kept on.
 */
@Component({
  selector: 'yona-recipe-ingredients',
  imports: [Icon, IngredientList],
  templateUrl: './recipe-ingredients.html',
  styleUrl: './recipe-ingredients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeIngredients {
  /** Already adjusted to the chosen servings, or to the chosen mold. */
  readonly lines = input.required<ShownIngredient[]>();
  /** Servings chosen by the visitor; null when the recipe gives none. */
  readonly servings = model<number | null>(null);
  /** Several parts: the list is their total. */
  readonly partCount = input(1);
  /** The mold the recipe is written for; null when it gives none. */
  readonly mold = input<Mold | null>(null);
  /** The visitor's mold: quantities follow its area instead of the servings. */
  readonly chosenMold = model<Mold | null>(null);

  protected readonly maxServings = MAX_SERVINGS;
  protected readonly shapes = SHAPES;
  protected readonly minCm = MIN_CM;
  protected readonly maxCm = MAX_CM;
  protected readonly describeMold = describeMold;

  /** Quantities multiplied by this for the visitor's mold: "× 1,44". */
  protected readonly moldFactor = computed(() => {
    const base = this.mold();
    const chosen = this.chosenMold();
    return base && chosen ? formatQuantity(Math.round((moldArea(chosen) / moldArea(base)) * 100) / 100) : null;
  });
  /** With the visitor's mold: the servings it makes, roughly. */
  protected readonly moldServings = computed(() => {
    const base = this.mold();
    const chosen = this.chosenMold();
    const servings = this.servings();
    return base && chosen && servings ? Math.max(1, Math.round((servings * moldArea(chosen)) / moldArea(base))) : null;
  });

  /** The visitor's mold being typed. */
  protected readonly editingMold = signal(false);
  protected readonly draftShape = signal<Mold['shape']>('ROUND');
  protected readonly draftLength = signal<number | null>(null);
  protected readonly draftWidth = signal<number | null>(null);

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

  /** Starts from the recipe's mold, the visitor changes what differs. */
  protected editMold(): void {
    const base = this.mold();
    this.draftShape.set(base?.shape ?? 'ROUND');
    this.draftLength.set(base?.lengthCm ?? null);
    this.draftWidth.set(base?.widthCm ?? null);
    this.editingMold.set(true);
  }

  protected applyMold(event: Event): void {
    event.preventDefault();
    const shape = this.draftShape();
    const length = this.draftLength();
    const width = shape === 'RECTANGLE' ? this.draftWidth() : null;
    if (!validSize(length) || (shape === 'RECTANGLE' && !validSize(width))) {
      return;
    }
    this.chosenMold.set({ shape, lengthCm: length!, widthCm: width ?? undefined });
    this.editingMold.set(false);
  }

  protected resetMold(): void {
    this.chosenMold.set(null);
    this.editingMold.set(false);
  }

  /** Empty or out of range: null, and "Adapter" stays disabled. */
  protected readSize(event: Event): number | null {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    return Number.isFinite(value) ? value : null;
  }

  protected readonly canApplyMold = computed(
    () => validSize(this.draftLength()) && (this.draftShape() !== 'RECTANGLE' || validSize(this.draftWidth())),
  );

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

function validSize(cm: number | null): boolean {
  return cm !== null && cm >= MIN_CM && cm <= MAX_CM;
}
