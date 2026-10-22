import { ChangeDetectionStrategy, Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideExternalLink, LucidePencil, LucidePlus, LucideStar, LucideTrash2 } from '@lucide/angular';
import { debounceTime } from 'rxjs';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { deleteRecipe } from '../../../core/api/generated/fn/admin-recipes/delete-recipe';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { recipeLink } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { Select, SelectOption } from '../../../shared/ui/select/select';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

/**
 * Every recipe, drafts included, the last modified first (the API's default order). Search,
 * status and page live in the URL: back from editing a recipe, the admin finds the same list.
 */
@Component({
  selector: 'yona-admin-recipes',
  imports: [
    RouterLink,
    Button,
    Select,
    Pagination,
    ParisDatePipe,
    LucideExternalLink,
    LucidePencil,
    LucidePlus,
    LucideStar,
    LucideTrash2,
  ],
  templateUrl: './admin-recipes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminRecipes {
  // Query parameters (?q=…&statut=…&page=…), bound by the router
  readonly q = input<string>();
  readonly statut = input<string>();
  readonly page = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly statusOptions: SelectOption<StatusFilter>[] = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'PUBLISHED', label: 'Publiées' },
    { value: 'DRAFT', label: 'Brouillons' },
  ];

  protected readonly status = computed<StatusFilter>(() =>
    this.statut() === 'PUBLISHED' || this.statut() === 'DRAFT' ? (this.statut() as StatusFilter) : 'ALL',
  );
  /** 1-based, as shown and as in the URL. */
  protected readonly currentPage = computed(() => Math.max(1, Math.floor(Number(this.page())) || 1));
  /** What is typed, sent to the URL once the admin pauses. */
  protected readonly search = signal('');

  protected readonly recipes = resource({
    params: () => ({
      q: this.q()?.trim() || undefined,
      status: this.status() === 'ALL' ? undefined : (this.status() as 'DRAFT' | 'PUBLISHED'),
      page: this.currentPage() - 1,
      size: PAGE_SIZE,
    }),
    loader: ({ params }) => this.api.invoke(searchRecipes, params),
  });
  protected readonly totalPages = computed(() => this.recipes.value()?.totalPages ?? 0);

  constructor() {
    // The field shows the search of the URL (on arrival, back and forward)
    effect(() => this.search.set(this.q() ?? ''));
    toObservable(this.search)
      .pipe(debounceTime(SEARCH_DELAY_MS), takeUntilDestroyed())
      .subscribe((search) => {
        if (search.trim() !== (this.q() ?? '').trim()) {
          this.updateQuery({ q: search.trim() || null, page: null });
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
    this.updateQuery({ statut: status && status !== 'ALL' ? status : null, page: null });
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
    this.recipes.reload();
  }

  private updateQuery(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
