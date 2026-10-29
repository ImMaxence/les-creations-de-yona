import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, from, map, of, switchMap } from 'rxjs';
import { Api } from '../../../core/api/generated/api';
import { suggest } from '../../../core/api/generated/fn/search/suggest';
import { SearchSuggestions } from '../../../core/api/generated/models/search-suggestions';
import { themeLabel } from '../../format/themes';
import { MAX_SERVINGS, SearchChoice, SearchPick, minutesIn, servingsIn, withServings } from '../../search/search-target';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icons';

const MIN_QUERY_LENGTH = 2;
const SUGGESTION_DELAY_MS = 200;

interface HighlightedSuggestion {
  pick: SearchPick;
  parts: { text: string; match: boolean }[];
  /** Place in the whole list, for the arrows of the keyboard. */
  index: number;
}

interface SuggestionGroup {
  label: string;
  icon: IconName;
  items: HighlightedSuggestion[];
}

const NO_SUGGESTIONS: SearchSuggestions = { recipes: [], themes: [], categories: [], tags: [], menus: [], ingredients: [] };

/** The suggestions, and the text they answer: "no result" is only said once they have come. */
interface Found {
  query: string;
  suggestions: SearchSuggestions;
}

let nextId = 0;

/**
 * Search of the site, following the ARIA combobox pattern: arrows move in the suggestions, Enter
 * opens the active one or searches the typed text, Escape closes. Suggestions by kind: the theme,
 * recipes mentioning each word, then the categories, tags, menus and ingredients of that name
 * ("Yaourt" for "gâteau au yaourt"; "Recettes salées" for "cake salé"). A number of people
 * understood ("gâteau 8", "tarte 6 personnes") shows on the right of the field, changed with − and
 * +: the recipes opened from it are shown for it. A time ("dessert en 30 min") is said above the
 * suggestions. Words are also looked for in the steps and the equipment of the recipes (API).
 * Nothing found is said, with an icon.
 * {@code inline}: the suggestions push the content down instead of floating over it (in a dialog).
 */
@Component({
  selector: 'yona-search-box',
  imports: [Icon],
  templateUrl: './search-box.html',
  styleUrl: './search-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBox {
  /** Search currently applied to the page. */
  readonly value = input('');
  readonly inline = input(false, { transform: booleanAttribute });
  readonly large = input(false, { transform: booleanAttribute });
  /** Focused as soon as shown (the search dialog). */
  readonly autofocus = input(false, { transform: booleanAttribute });
  // Not named "search": that is also a native DOM event of <input type="search">, which bubbles
  readonly searchSubmitted = output<string>();
  readonly picked = output<SearchChoice>();

  protected readonly listboxId = `search-suggestions-${nextId++}`;
  protected readonly query = linkedSignal(() => this.value());
  protected readonly focused = signal(false);
  protected readonly activeIndex = signal(-1);

  private readonly api = inject(Api);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  /** Only what the visitor types triggers suggestions: never the value read from the URL. */
  private readonly typed = signal('');

  private readonly found = toSignal(
    toObservable(this.typed).pipe(
      map((query) => query.trim()),
      debounceTime(SUGGESTION_DELAY_MS),
      distinctUntilChanged(),
      switchMap((query) =>
        query.length < MIN_QUERY_LENGTH
          ? of<Found>({ query, suggestions: NO_SUGGESTIONS })
          : from(this.api.invoke(suggest, { q: query })).pipe(
              map((suggestions): Found => ({ query, suggestions })),
              // Offline: no suggestion, and no "no result" either
              catchError(() => of<Found>({ query: '', suggestions: NO_SUGGESTIONS })),
            ),
      ),
    ),
    { initialValue: { query: '', suggestions: NO_SUGGESTIONS } },
  );
  private readonly suggestions = computed(() => this.found().suggestions);

  protected readonly maxServings = MAX_SERVINGS;
  /** "gâteau 8": 8, shown on the right of the field. */
  protected readonly servings = computed(() => servingsIn(this.query()));
  /** "dessert en 30 min": "30 min", said above the suggestions. */
  protected readonly duration = computed(() => {
    const minutes = minutesIn(this.query());
    if (minutes === null) {
      return null;
    }
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ' ' + String(minutes % 60).padStart(2, '0') : ''}`;
  });
  protected readonly typedQuery = computed(() => this.typed().trim());

  protected readonly groups = computed<SuggestionGroup[]>(() => {
    const found = this.suggestions();
    const query = this.typed().trim();
    let index = 0;
    const group = (label: string, icon: IconName, picks: SearchPick[]): SuggestionGroup => ({
      label,
      icon,
      items: picks.map((pick) => ({ pick, parts: highlight(pick.label, query), index: index++ })),
    });
    return [
      group(
        'Thèmes',
        'chef-hat',
        (found.themes ?? []).map((theme) => ({ kind: 'theme', label: `Recettes ${themeLabel(theme).toLowerCase()}es`, theme })),
      ),
      group(
        'Recettes',
        'book-open',
        found.recipes.map((recipe) => ({ kind: 'recipe', label: recipe.title, slug: recipe.slug, categorySlug: recipe.categorySlug })),
      ),
      group('Catégories', 'layout-grid', found.categories.map((category) => ({ kind: 'category', label: category.name, slug: category.slug }))),
      group('Tags', 'tag', found.tags.map((tag) => ({ kind: 'tag', label: tag.name, slug: tag.slug }))),
      group('Menus', 'utensils-crossed', found.menus.map((menu) => ({ kind: 'menu', label: menu.name, slug: menu.slug }))),
      group('Ingrédients', 'carrot', found.ingredients.map((name) => ({ kind: 'ingredient', label: name }))),
    ].filter((each) => each.items.length > 0);
  });
  private readonly highlighted = computed(() => this.groups().flatMap((each) => each.items));
  /** The suggestions of what is typed came back empty. */
  private readonly nothingFound = computed(() => {
    const query = this.typedQuery();
    return query.length >= MIN_QUERY_LENGTH && this.found().query === query && this.highlighted().length === 0;
  });
  protected readonly expanded = computed(
    () => this.focused() && (this.highlighted().length > 0 || this.nothingFound()),
  );
  protected readonly activeOptionId = computed(() =>
    this.expanded() && this.activeIndex() >= 0 ? `${this.listboxId}-${this.activeIndex()}` : null,
  );

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) {
        this.input().nativeElement.focus();
      }
    });
  }

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
      this.choose(this.highlighted()[active].pick);
      return;
    }
    this.focused.set(false);
    this.input().nativeElement.blur();
    this.searchSubmitted.emit(this.query().trim());
  }

  protected choose(pick: SearchPick): void {
    this.focused.set(false);
    this.picked.emit({ pick, servings: servingsIn(this.query()) });
  }

  /** − and + beside the number of people: the number changes in the search itself. */
  protected changeServings(step: number): void {
    const servings = this.servings();
    if (!servings) {
      return;
    }
    const next = Math.min(MAX_SERVINGS, Math.max(1, servings + step));
    this.query.set(withServings(this.query(), next));
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
