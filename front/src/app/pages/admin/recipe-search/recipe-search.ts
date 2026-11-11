import { ChangeDetectionStrategy, Component, computed, inject, input, model, resource, viewChild } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { TitleSearch, TitledItem } from '../title-search/title-search';

export interface ChosenRecipe {
  id: number;
  title: string;
  /** For a link to its page: /recettes/{categorySlug}/{slug}. */
  slug?: string;
  categorySlug?: string;
  imageId?: string;
  published?: boolean;
}

interface RecipeItem extends TitledItem {
  recipe: RecipeAdminSummary;
}

/** Largest page of the API: every recipe is read, page after page, and searched here. */
const PAGE_SIZE = 50;

/**
 * A recipe of the blog, found by typing part of its title (accents ignored), drafts included. Once
 * picked, it is shown with a cross to take it off (see TitleSearch).
 */
@Component({
  selector: 'yona-recipe-search',
  imports: [TitleSearch],
  template: `
    <yona-title-search
      label="Rechercher une recette"
      removeLabel="Retirer la recette"
      noMatchText="Aucune recette ne correspond"
      icon="book-open"
      [hint]="hint()"
      [exclude]="exclude()"
      [items]="items()"
      [chosen]="chosenItem()"
      (chosenChange)="choose($event)"
    />
  `,
  styles: `
    :host {
      display: block;
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
  private readonly search = viewChild(TitleSearch);

  protected readonly items = computed<RecipeItem[]>(() =>
    (this.recipes.value() ?? []).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      note: recipe.status === 'PUBLISHED' ? undefined : 'Non publiée',
      recipe,
    })),
  );
  protected readonly chosenItem = computed<TitledItem | null>(() => {
    const chosen = this.chosen();
    return chosen && { id: chosen.id, title: chosen.title };
  });

  /** Something typed and no recipe picked: saved as it is, the form would lose it without a word. */
  readonly unfinished = computed(() => this.search()?.unfinished() ?? false);

  protected choose(item: TitledItem | null): void {
    const recipe = (item as RecipeItem | null)?.recipe;
    this.chosen.set(
      recipe
        ? {
            id: recipe.id,
            title: recipe.title,
            slug: recipe.slug,
            categorySlug: recipe.categories[0]?.slug,
            imageId: recipe.imageId,
            published: recipe.status === 'PUBLISHED',
          }
        : null,
    );
  }

  /** Nothing chosen, nothing typed. */
  reset(): void {
    this.chosen.set(null);
    this.search()?.reset();
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
