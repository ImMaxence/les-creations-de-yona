import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideExternalLink,
  LucidePencil,
  LucidePlus,
  LucideStar,
  LucideTrash2,
} from '@lucide/angular';
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
import { Select, SelectOption } from '../../../shared/ui/select/select';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

@Component({
  selector: 'yona-admin-recipes',
  imports: [
    RouterLink,
    Button,
    Select,
    ParisDatePipe,
    LucideChevronLeft,
    LucideChevronRight,
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
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly statusOptions: SelectOption<StatusFilter>[] = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'PUBLISHED', label: 'Publiées' },
    { value: 'DRAFT', label: 'Brouillons' },
  ];

  protected readonly search = signal('');
  private readonly debouncedSearch = toSignal(
    toObservable(this.search).pipe(debounceTime(SEARCH_DELAY_MS)),
    { initialValue: '' },
  );
  protected readonly status = signal<StatusFilter>('ALL');
  /** Back to the first page whenever the filters change. */
  protected readonly page = linkedSignal({
    source: () => [this.debouncedSearch(), this.status()],
    computation: () => 0,
  });

  protected readonly recipes = resource({
    params: () => ({
      q: this.debouncedSearch().trim() || undefined,
      status: this.status() === 'ALL' ? undefined : (this.status() as 'DRAFT' | 'PUBLISHED'),
      page: this.page(),
      size: PAGE_SIZE,
    }),
    loader: ({ params }) => this.api.invoke(searchRecipes, params),
  });
  protected readonly totalPages = computed(() => this.recipes.value()?.totalPages ?? 0);

  protected publicLink(recipe: RecipeAdminSummary): string[] {
    return recipeLink(recipe);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected async remove(recipe: RecipeAdminSummary): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer la recette ?',
      message: `« ${recipe.title} » et sa photo seront supprimées définitivement.`,
      confirmLabel: 'Supprimer',
    });
    if (!confirmed || !(await attempt(this.api.invoke(deleteRecipe, { id: recipe.id }))).ok) {
      return;
    }
    this.toaster.success('Recette supprimée.');
    this.recipes.reload();
  }
}
