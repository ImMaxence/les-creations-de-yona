import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { LucideSearch, LucideX } from '@lucide/angular';
import { catchError, debounceTime, distinctUntilChanged, from, map, of, switchMap } from 'rxjs';
import { Api } from '../../../core/api/generated/api';
import { suggestRecipeTitles } from '../../../core/api/generated/fn/recipes/suggest-recipe-titles';
import { RecipeSuggestion } from '../../../core/api/generated/models/recipe-suggestion';

const MIN_QUERY_LENGTH = 2;
const SUGGESTION_DELAY_MS = 200;

interface HighlightedSuggestion {
  suggestion: RecipeSuggestion;
  parts: { text: string; match: boolean }[];
}

let nextId = 0;

/**
 * Recipe search with title autocompletion, following the ARIA combobox pattern: arrows move in
 * the suggestions, Enter opens the active one or searches the typed text, Escape closes.
 */
@Component({
  selector: 'yona-search-box',
  imports: [LucideSearch, LucideX],
  templateUrl: './search-box.html',
  styleUrl: './search-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBox {
  /** Search currently applied to the page. */
  readonly value = input('');
  // Not named "search": that is also a native DOM event of <input type="search">, which bubbles
  readonly searchSubmitted = output<string>();
  readonly suggestionPicked = output<RecipeSuggestion>();

  protected readonly listboxId = `search-suggestions-${nextId++}`;
  protected readonly query = linkedSignal(() => this.value());
  protected readonly focused = signal(false);
  protected readonly activeIndex = signal(-1);

  private readonly api = inject(Api);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  /** Only what the visitor types triggers suggestions: never the value read from the URL. */
  private readonly typed = signal('');

  private readonly suggestions = toSignal(
    toObservable(this.typed).pipe(
      map((query) => query.trim()),
      debounceTime(SUGGESTION_DELAY_MS),
      distinctUntilChanged(),
      switchMap((query) =>
        query.length < MIN_QUERY_LENGTH
          ? of([])
          : from(this.api.invoke(suggestRecipeTitles, { q: query })).pipe(catchError(() => of([]))),
      ),
    ),
    { initialValue: [] },
  );

  protected readonly highlighted = computed<HighlightedSuggestion[]>(() =>
    this.suggestions().map((suggestion) => ({
      suggestion,
      parts: highlight(suggestion.title, this.typed().trim()),
    })),
  );
  protected readonly expanded = computed(() => this.focused() && this.highlighted().length > 0);
  protected readonly activeOptionId = computed(() =>
    this.expanded() && this.activeIndex() >= 0 ? `${this.listboxId}-${this.activeIndex()}` : null,
  );

  protected onInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.query.set(query);
    this.typed.set(query);
    this.activeIndex.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.highlighted().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (count === 0) {
          return;
        }
        event.preventDefault();
        this.focused.set(true);
        this.activeIndex.update((index) =>
          event.key === 'ArrowDown' ? (index + 1) % count : (index - 1 + count) % count,
        );
        break;
      case 'Escape':
        if (this.expanded()) {
          event.preventDefault();
          this.focused.set(false);
        }
        break;
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const active = this.activeIndex();
    if (this.expanded() && active >= 0) {
      this.choose(this.highlighted()[active].suggestion);
      return;
    }
    this.focused.set(false);
    this.input().nativeElement.blur();
    this.searchSubmitted.emit(this.query().trim());
  }

  protected choose(suggestion: RecipeSuggestion): void {
    this.focused.set(false);
    this.suggestionPicked.emit(suggestion);
  }

  protected clear(): void {
    this.query.set('');
    this.typed.set('');
    this.input().nativeElement.focus();
    if (this.value()) {
      this.searchSubmitted.emit('');
    }
  }
}

/** Splits a title around the typed text, ignoring case and accents ("creme" matches "Crème"). */
function highlight(title: string, query: string): { text: string; match: boolean }[] {
  const foldedTitle = fold(title);
  const start = query ? foldedTitle.indexOf(fold(query)) : -1;
  // Folding keeps one character per accented letter in French titles; if not, no highlight
  if (start < 0 || foldedTitle.length !== title.length) {
    return [{ text: title, match: false }];
  }
  const end = start + fold(query).length;
  return [
    { text: title.slice(0, start), match: false },
    { text: title.slice(start, end), match: true },
    { text: title.slice(end), match: false },
  ].filter((part) => part.text);
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
