import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

export interface Suggestion {
  readonly value: string;
  /** Short muted text on the right ("3 recettes"). */
  readonly hint?: string;
}

const MAX_SHOWN = 8;

let nextId = 0;

/**
 * Text field with a list of suggestions styled like the site (a native <datalist> shows the
 * browser's own list). Free text stays allowed. Suggestions keep the order given (most relevant
 * first); while typing, those starting with the text come first, case and accents ignored.
 * Follows the ARIA combobox pattern: arrows, Enter to pick, Escape to close.
 * Works with signal forms: <yona-suggest-input [formField]="form.name" [suggestions]="names" />
 */
@Component({
  selector: 'yona-suggest-input',
  templateUrl: './suggest-input.html',
  styleUrl: './suggest-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestInput implements FormValueControl<string> {
  readonly value = model('');
  readonly suggestions = input<readonly Suggestion[]>([]);
  /** Values never suggested (e.g. ingredients already in the recipe), unless already typed here. */
  readonly exclude = input<ReadonlySet<string>>(new Set());
  readonly placeholder = input('');
  /** Accessible name, read by screen readers. */
  readonly label = input.required<string>();
  // Bound by the signal forms' FormField directive
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly touch = output<void>();

  protected readonly listId = `suggest-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly shown = computed(() => {
    const typed = normalize(this.value());
    const exclude = new Set([...this.exclude()].map(normalize));
    const candidates = this.suggestions().filter((suggestion) => {
      const name = normalize(suggestion.value);
      return name !== typed && !exclude.has(name) && name.includes(typed);
    });
    // Stable sort: within each group, the given order (most used first) is kept
    return [...candidates]
      .sort((a, b) => Number(!normalize(a.value).startsWith(typed)) - Number(!normalize(b.value).startsWith(typed)))
      .slice(0, MAX_SHOWN);
  });
  protected readonly expanded = computed(() => this.open() && this.shown().length > 0);

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
    this.open.set(true);
    this.activeIndex.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.shown().length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.expanded()) {
        this.open.set(true);
        this.activeIndex.set(0);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.update((index) => Math.min(last, Math.max(0, index + step)));
    } else if (event.key === 'Enter' && this.expanded() && this.activeIndex() >= 0) {
      // Picks the suggestion instead of submitting the form
      event.preventDefault();
      this.choose(this.shown()[this.activeIndex()]);
    } else if (event.key === 'Escape' && this.expanded()) {
      event.preventDefault();
      this.open.set(false);
    }
  }

  protected onBlur(): void {
    this.open.set(false);
    this.touch.emit();
  }

  protected choose(suggestion: Suggestion): void {
    this.value.set(suggestion.value);
    this.open.set(false);
    this.activeIndex.set(-1);
  }
}

/** "Crème fraîche" → "creme fraiche": comparisons ignore case and accents, like the API. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').trim();
}
