import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MAX_NOTE_LENGTH, RecipeNotes } from '../../../core/kitchen/recipe-notes';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * "Mes notes": what the visitor wants to remember about the recipe, written straight in the
 * field and kept at each key press, in this browser only. Also shown in the cooking mode.
 */
@Component({
  selector: 'yona-recipe-notes',
  imports: [Icon],
  template: `
    <h2 class="notes__title">
      <svg yonaIcon="pencil" [size]="20" [strokeWidth]="1.75"></svg><label for="recipe-notes">Mes notes</label>
    </h2>
    <textarea
      id="recipe-notes"
      class="notes__field"
      aria-describedby="notes-hint"
      rows="3"
      placeholder="Par exemple : 10 min de plus dans mon four, un peu moins de sucre…"
      [attr.maxlength]="maxLength"
      [value]="text()"
      (input)="write($event)"
    ></textarea>
    <p class="notes__hint" id="notes-hint">Gardées seulement dans ce navigateur, sans compte. Retrouvées aussi dans le mode cuisine.</p>
  `,
  styleUrl: './recipe-notes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeNotesEditor {
  readonly slug = input.required<string>();

  private readonly notes = inject(RecipeNotes);
  protected readonly maxLength = MAX_NOTE_LENGTH;
  protected readonly text = computed(() => this.notes.of(this.slug()));

  protected write(event: Event): void {
    this.notes.write(this.slug(), (event.target as HTMLTextAreaElement).value);
  }
}
