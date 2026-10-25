import { ChangeDetectionStrategy, Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideExternalLink, LucideEye, LucidePencil, LucidePlus, LucideStar, LucideTrash2 } from '@lucide/angular';
import { debounceTime } from 'rxjs';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { deleteRecipe } from '../../../core/api/generated/fn/admin-recipes/delete-recipe';
import { deleteRecipes } from '../../../core/api/generated/fn/admin-recipes/delete-recipes';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { categoryNames } from '../../../shared/format/categories';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { recipeLink } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { Selection } from '../selection';
import { ADMIN_RECIPES_QUERY } from './admin-recipes-query';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;
const ALL_CATEGORIES = '';

/**
 * Every recipe, drafts included, the last modified first (the API's default order). Filters and
 * page live in the URL: back from editing a recipe, the admin finds the same list, and the
 * categories and ingredients pages link to the recipes using one of them.
 */
@Component({
  selector: 'yona-admin-recipes',
  imports: [
    RouterLink,
    BulkBar,
    Button,
    CoverImage,
    Select,
    Pagination,
    ParisDatePipe,
    LucideExternalLink,
    LucideEye,
    LucidePencil,
    LucidePlus,
    LucideStar,
    LucideTrash2,
  ],
  templateUrl: './admin-recipes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminRecipes {
  // Query parameters, bound by the router
  readonly q = input<string>();
  readonly statut = input<string>();
  readonly categorie = input<string>();
  readonly idIngredient = input<string>();
  readonly page = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly categoryNames = categoryNames;
  protected readonly statusOptions: SelectOption<StatusFilter>[] = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'PUBLISHED', label: 'Publiées' },
    { value: 'DRAFT', label: 'Brouillons' },
  ];
  private readonly categories = inject(SiteData).categories;
  protected readonly categoryOptions = computed<SelectOption<string>[]>(() => [
    { value: ALL_CATEGORIES, label: 'Toutes les catégories' },
    ...this.categories().map((category) => ({ value: category.slug, label: category.name })),
  ]);

  protected readonly status = computed<StatusFilter>(() =>
    this.statut() === 'PUBLISHED' || this.statut() === 'DRAFT' ? (this.statut() as StatusFilter) : 'ALL',
  );
  protected readonly category = computed(() => this.categorie() ?? ALL_CATEGORIES);
  protected readonly ingredientId = computed(() => {
    const id = Number(this.idIngredient());
    return Number.isInteger(id) && id > 0 ? id : undefined;
  });
  /** 1-based, as shown and as in the URL. */
  protected readonly currentPage = computed(() => Math.max(1, Math.floor(Number(this.page())) || 1));
  /** What is typed, sent to the URL once the admin pauses. */
  protected readonly search = signal('');

  protected readonly recipes = resource({
    params: () => ({
      q: this.q()?.trim() || undefined,
      status: this.status() === 'ALL' ? undefined : (this.status() as 'DRAFT' | 'PUBLISHED'),
      category: this.category() || undefined,
      ingredientId: this.ingredientId(),
      page: this.currentPage() - 1,
      size: PAGE_SIZE,
    }),
    loader: ({ params }) => this.api.invoke(searchRecipes, params),
  });
  protected readonly totalPages = computed(() => this.recipes.value()?.totalPages ?? 0);
  protected readonly totalElements = computed(() => this.recipes.value()?.totalElements ?? 0);

  /** Ingredients used by a recipe at least; choosing one filters the list at once. */
  private readonly knownIngredients = resource({
    loader: () => this.api.invoke(searchIngredients, {}),
  });
  protected readonly ingredientOptions = computed<SelectOption<number | undefined>[]>(() => [
    { value: undefined, label: 'Tous les ingrédients' },
    ...(this.knownIngredients.value() ?? [])
      .filter((ingredient) => ingredient.recipeCount > 0 || ingredient.id === this.ingredientId())
      .map((ingredient) => ({ value: ingredient.id, label: `${ingredient.name} (${ingredient.recipeCount})` })),
  ]);
  protected readonly hasFilters = computed(
    () =>
      !!this.q()?.trim() ||
      this.status() !== 'ALL' ||
      !!this.category() ||
      this.ingredientId() !== undefined,
  );

  /** Kept from one page of the list to another. */
  protected readonly selection = new Selection<number>();
  protected readonly shownIds = computed(() => this.recipes.value()?.content.map((recipe) => recipe.id) ?? []);
  protected readonly deleting = signal(false);

  constructor() {
    // The fields show the search of the URL (on arrival, back and forward)
    effect(() => this.search.set(this.q() ?? ''));
    // A page past the end (after deleting its last recipes, or an old link): to the last one
    effect(() => {
      const result = this.recipes.value();
      if (result && !result.content.length && result.totalPages > 0 && this.currentPage() > result.totalPages) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { [ADMIN_RECIPES_QUERY.page]: result.totalPages === 1 ? null : result.totalPages },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
    toObservable(this.search)
      .pipe(debounceTime(SEARCH_DELAY_MS), takeUntilDestroyed())
      .subscribe((search) => {
        if (search.trim() !== (this.q() ?? '').trim()) {
          this.updateQuery({ [ADMIN_RECIPES_QUERY.search]: search.trim() || null });
        }
      });
  }

  protected publicLink(recipe: RecipeAdminSummary): string[] {
    return recipeLink(recipe);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }


  protected changeStatus(status: StatusFilter | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.status]: status && status !== 'ALL' ? status : null });
  }

  protected changeCategory(slug: string | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.category]: slug || null });
  }

  protected changeIngredient(id: number | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.ingredientId]: id === undefined ? null : String(id) });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, replaceUrl: true });
  }

  protected async remove(recipe: RecipeAdminSummary): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer la recette ?',
      message: `« ${recipe.title} » sera supprimée définitivement. Sa photo restera dans la galerie.`,
      confirmLabel: 'Supprimer',
    });
    if (!confirmed || !(await attempt(this.api.invoke(deleteRecipe, { id: recipe.id }))).ok) {
      return;
    }
    this.toaster.success('Recette supprimée.');
    if (this.selection.has(recipe.id)) {
      this.selection.toggle(recipe.id);
    }
    this.recipes.reload();
  }

  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Supprimer ${count} recettes ?` : 'Supprimer la recette ?',
      message:
        count > 1
          ? `Les ${count} recettes sélectionnées seront supprimées définitivement. Leurs photos resteront dans la galerie.`
          : 'La recette sélectionnée sera supprimée définitivement. Sa photo restera dans la galerie.',
      confirmLabel: 'Supprimer',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteRecipes, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} recettes supprimées.` : 'Recette supprimée.');
      this.selection.clear();
      this.recipes.reload();
    }
  }

  /** Any filter change goes back to the first page. */
  private updateQuery(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...queryParams, [ADMIN_RECIPES_QUERY.page]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
