import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icons';
import { SuggestInput, Suggestion } from '../../../shared/ui/suggest-input/suggest-input';

/** Something of the back-office found by its title: a recipe, an article. */
export interface TitledItem {
  id: number;
  title: string;
  /** Muted, on the right of its suggestion: "Non publiée". */
  note?: string;
}

/**
 * One item of a list, found by typing part of its title (accents ignored). Once picked, it is shown
 * with a cross to take it off. RecipeSearch and ArticleSearch give it their list.
 */
@Component({
  selector: 'yona-title-search',
  imports: [Icon, SuggestInput],
  template: `
    @if (chosen(); as item) {
      <div class="chosen">
        <svg [yonaIcon]="icon()" [size]="18"></svg>
        <span class="chosen__title">{{ item.title }}</span>
        <button type="button" class="icon-button" [attr.aria-label]="removeLabel() + ' ' + item.title" (click)="reset()">
          <svg yonaIcon="x" [size]="16"></svg>
        </button>
      </div>
    } @else {
      <yona-suggest-input [label]="label()" [placeholder]="label() + '…'" [suggestions]="suggestions()" [(value)]="search" (picked)="choose($event)" />
      @if (noMatch()) {
        <span class="field__hint">{{ noMatchText() }}</span>
      } @else if (hint()) {
        <span class="field__hint">{{ hint() }}</span>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-1);
    }

    .chosen {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 2.75rem;
      padding-left: var(--space-4);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background-color: var(--color-bg);
    }

    .chosen__title {
      flex: 1;
      min-width: 0;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TitleSearch<T extends TitledItem> {
  readonly items = input<readonly T[]>([]);
  /** "Rechercher une recette": the name of the field, and its placeholder. */
  readonly label = input.required<string>();
  readonly icon = input<IconName>('book-open');
  /** Read before the title on the cross: "Retirer la recette". */
  readonly removeLabel = input('Retirer');
  readonly noMatchText = input('Aucun résultat');
  /** Under the field, while nothing is typed that finds nothing. */
  readonly hint = input('');
  /** Items not to offer: those already chosen elsewhere, the article itself. */
  readonly exclude = input<ReadonlySet<number>>(new Set());
  readonly chosen = model<T | null>(null);

  protected readonly search = signal('');

  /** By the text of its suggestion: two items may share a title, the id then tells them apart. */
  private readonly byLabel = computed(() => {
    const byLabel = new Map<string, T>();
    for (const item of this.items()) {
      if (!this.exclude().has(item.id)) {
        byLabel.set(byLabel.has(item.title) ? `${item.title} (${item.id})` : item.title, item);
      }
    }
    return byLabel;
  });
  protected readonly suggestions = computed<Suggestion[]>(() => [...this.byLabel()].map(([value, item]) => ({ value, hint: item.note })));
  protected readonly noMatch = computed(() => {
    const typed = fold(this.search());
    return !!typed && !this.suggestions().some((suggestion) => fold(suggestion.value).includes(typed));
  });

  /** Something typed and nothing picked: saved as it is, the form would lose it without a word. */
  readonly unfinished = computed(() => !this.chosen() && !!this.search().trim());

  protected choose(label: string): void {
    const item = this.byLabel().get(label);
    if (item) {
      this.chosen.set(item);
      this.search.set('');
    }
  }

  /** Nothing chosen, nothing typed. */
  reset(): void {
    this.chosen.set(null);
    this.search.set('');
  }
}

/** Same comparison as the suggestions: "creme" finds "Crème". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').trim();
}
