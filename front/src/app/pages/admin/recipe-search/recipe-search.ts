import { ChangeDetectionStrategy, Component, computed, inject, input, model, resource, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { Icon } from '../../../shared/ui/icon/icon';
import { SuggestInput, Suggestion } from '../../../shared/ui/suggest-input/suggest-input';

export interface ChosenRecipe {
  id: number;
  title: string;
  /** For a link to its page: /recettes/{categorySlug}/{slug}. */
  slug?: string;
  categorySlug?: string;
  imageId?: string;
  published?: boolean;
}

/** Largest page of the API: every recipe is read, page after page, and searched here. */
const PAGE_SIZE = 50;

/**
 * A recipe of the blog, found by typing part of its title (accents ignored), drafts included. Once
 * picked, it is shown with a cross to take it off.
 */
@Component({
  selector: 'yona-recipe-search',
  imports: [Icon, SuggestInput],
  template: `
    @if (chosen(); as recipe) {
      <div class="chosen">
        <svg yonaIcon="book-open" [size]="18"></svg>
        <span class="chosen__title">{{ recipe.title }}</span>
        <button type="button" class="icon-button" [attr.aria-label]="'Retirer la recette ' + recipe.title" (click)="reset()">
          <svg yonaIcon="x" [size]="16"></svg>
        </button>
      </div>
    } @else {
      <yona-suggest-input
        label="Rechercher une recette"
        placeholder="Rechercher une recette…"
        [suggestions]="suggestions()"
        [(value)]="search"
        (picked)="choose($event)"
      />
      @if (noMatch()) {
        <span class="field__hint">Aucune recette ne correspond</span>
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
export class RecipeSearch {
  /** Under the field, while nothing is typed that finds nothing. */
  readonly hint = input('');
  /** Recipes not to offer: those already in the shop, for instance. */
  readonly exclude = input<ReadonlySet<number>>(new Set());
  readonly chosen = model<ChosenRecipe | null>(null);

  private readonly api = inject(Api);
  private readonly recipes = resource({ loader: () => this.loadRecipes() });
  protected readonly search = signal('');

  /** By the text of its suggestion: two recipes may share a title, the id then tells them apart. */
  private readonly byLabel = computed(() => {
    const byLabel = new Map<string, RecipeAdminSummary>();
    for (const recipe of this.recipes.value() ?? []) {
      if (!this.exclude().has(recipe.id)) {
        byLabel.set(byLabel.has(recipe.title) ? `${recipe.title} (${recipe.id})` : recipe.title, recipe);
      }
    }
    return byLabel;
  });
  protected readonly suggestions = computed<Suggestion[]>(() =>
    [...this.byLabel()].map(([value, recipe]) => ({ value, hint: recipe.status === 'PUBLISHED' ? undefined : 'Non publiée' })),
  );
  protected readonly noMatch = computed(() => {
    const typed = fold(this.search());
    return !!typed && !this.suggestions().some((suggestion) => fold(suggestion.value).includes(typed));
  });

  /** Something typed and no recipe picked: saved as it is, the form would lose it without a word. */
  readonly unfinished = computed(() => !this.chosen() && !!this.search().trim());

  protected choose(label: string): void {
    const recipe = this.byLabel().get(label);
    if (recipe) {
      this.chosen.set({
        id: recipe.id,
        title: recipe.title,
        slug: recipe.slug,
        categorySlug: recipe.categories[0]?.slug,
        imageId: recipe.imageId,
        published: recipe.status === 'PUBLISHED',
      });
      this.search.set('');
    }
  }

  /** Nothing chosen, nothing typed. */
  reset(): void {
    this.chosen.set(null);
    this.search.set('');
  }

  private async loadRecipes(): Promise<RecipeAdminSummary[]> {
    const recipes: RecipeAdminSummary[] = [];
    for (let page = 0, totalPages = 1; page < totalPages; page++) {
      const result = await this.api.invoke(searchRecipes, { page, size: PAGE_SIZE, sort: ['title,asc'] });
      recipes.push(...result.content);
      totalPages = result.totalPages;
    }
    return recipes;
  }
}

/** Same comparison as the suggestions: "creme" finds "Crème". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').trim();
}
