import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { LucideCheck } from '@lucide/angular';
import { ShownIngredient } from '../recipe-parts';

/** Ingredients to tick off while cooking: the whole recipe, or a single part. */
@Component({
  selector: 'yona-ingredient-list',
  imports: [LucideCheck],
  templateUrl: './ingredient-list.html',
  styleUrl: './ingredient-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngredientList {
  readonly lines = input.required<ShownIngredient[]>();

  /** Unchanged when only the servings change: ticked ingredients stay ticked. */
  private readonly names = computed(() => this.lines().map((line) => line.name).join('\n'));
  protected readonly checked = linkedSignal<string, ReadonlySet<number>>({
    source: this.names,
    computation: () => new Set(),
  });

  protected toggle(index: number): void {
    this.checked.update((current) => {
      const next = new Set(current);
      if (!next.delete(index)) {
        next.add(index);
      }
      return next;
    });
  }
}
