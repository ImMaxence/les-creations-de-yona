import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { deleteRecipe } from '../../../core/api/generated/fn/admin-recipes/delete-recipe';
import { deleteRecipes } from '../../../core/api/generated/fn/admin-recipes/delete-recipes';
import { duplicateRecipe } from '../../../core/api/generated/fn/admin-recipes/duplicate-recipe';
import { publishRecipe } from '../../../core/api/generated/fn/admin-recipes/publish-recipe';
import { THEMES, Theme, themeLabel, themeOfSlug, themeSlug } from '../../../shared/format/themes';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { listAdminTags } from '../../../core/api/generated/fn/admin-tags/list-admin-tags';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { categoryNames } from '../../../shared/format/categories';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { parisDateTime } from '../../../shared/format/paris-time';
import { keepScrollThroughNextNavigation } from '../../../shared/routing/kept-scroll';
import { recipeLink } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { InfiniteList } from '../../../shared/ui/infinite-scroll/infinite-list';
import { InfiniteScroll } from '../../../shared/ui/infinite-scroll/infinite-scroll';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { FilterChip } from '../filter-chip/filter-chip';
import { Selection } from '../selection';
import { ADMIN_RECIPES_QUERY } from './admin-recipes-query';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * As the list shows it: a draft with a publication time is "Programmée", a status of its own for
 * the admin, though still a draft for the API (DRAFT with a scheduledAt).
 */
type Status = RecipeAdminSummary['status'] | 'SCHEDULED';
type StatusFilter = 'ALL' | Status;
type ThemeFilter = 'ALL' | Theme;

/** The name and colour of each status (see .badge--…): grey draft, blue scheduled, green published, red failure. */
const STATUSES: Record<Status, { label: string; badge: string }> = {
  DRAFT: { label: 'Brouillon', badge: 'badge--draft' },
  SCHEDULED: { label: 'Programmée', badge: 'badge--scheduled' },
  PUBLISHED: { label: 'Publiée', badge: 'badge--published' },
  FAILED: { label: 'Échec', badge: 'badge--failed' },
};

/** The status shown for a recipe of the list. */
export function shownStatus(recipe: Pick<RecipeAdminSummary, 'status' | 'scheduledAt'>): Status {
  return recipe.status === 'DRAFT' && recipe.scheduledAt ? 'SCHEDULED' : recipe.status;
}

/** What the API is asked for each status filter: a draft "Brouillon" has no publication time. */
export function statusQuery(status: StatusFilter): { status?: RecipeAdminSummary['status']; scheduled?: boolean } {
  switch (status) {
    case 'ALL':
      return {};
    case 'DRAFT':
      return { status: 'DRAFT', scheduled: false };
    case 'SCHEDULED':
      return { status: 'DRAFT', scheduled: true };
    default:
      return { status };
  }
}
type SortOrder = 'modification' | 'creation' | 'anciennes' | 'titre' | 'titre-inverse' | 'vues';

/** Sent to the API; the id keeps equal titles or counts in the same order from one page to the next. */
const SORTS: Record<SortOrder, string[]> = {
  modification: ['updatedAt,desc', 'id,desc'],
  creation: ['createdAt,desc', 'id,desc'],
  anciennes: ['createdAt,asc', 'id,asc'],
  titre: ['title,asc', 'id,asc'],
  'titre-inverse': ['title,desc', 'id,desc'],
  vues: ['viewCount,desc', 'id,desc'],
};
const DEFAULT_SORT: SortOrder = 'modification';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;
const ALL_CATEGORIES = '';
const ALL_TAGS = '';

/**
 * Every recipe, drafts included, the last modified first unless another order is chosen (creation,
 * title, views). Filters and order live in the URL: back from editing a recipe, the admin finds the same list, and the
 * categories, tags and ingredients pages link to the recipes using one of them.
 */
@Component({
  selector: 'yona-admin-recipes',
  imports: [
    Icon,
    RouterLink,
    BulkBar,
    FilterChip,
    Button,
    CoverImage,
    Select,
    InfiniteScroll,
    ParisDatePipe,
  ],
  templateUrl: './admin-recipes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminRecipes {
  // Query parameters, bound by the router
  readonly q = input<string>();
  readonly statut = input<string>();
  readonly theme = input<string>();
  readonly categorie = input<string>();
  readonly tag = input<string>();
  readonly idIngredient = input<string>();
  readonly photo = input<string>();
  readonly tri = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly categoryNames = categoryNames;
  protected readonly parisDateTime = parisDateTime;
  protected readonly statuses = STATUSES;
  protected readonly shownStatus = shownStatus;
  protected readonly themeLabel = themeLabel;
  protected readonly statusOptions: SelectOption<StatusFilter>[] = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'PUBLISHED', label: 'Publiées' },
    { value: 'SCHEDULED', label: 'Programmées' },
    { value: 'DRAFT', label: 'Brouillons' },
    { value: 'FAILED', label: 'En échec' },
  ];
  protected readonly themeOptions: SelectOption<ThemeFilter>[] = [
    { value: 'ALL', label: 'Sucré et salé' },
    ...THEMES.map(({ value, label }) => ({ value, label })),
  ];
  protected readonly publishing = signal<number | null>(null);
  protected readonly sortOptions: SelectOption<SortOrder>[] = [
    { value: 'modification', label: 'Dernières modifiées' },
    { value: 'creation', label: 'Dernières créées' },
    { value: 'anciennes', label: 'Plus anciennes' },
    { value: 'titre', label: 'Titre, de A à Z' },
    { value: 'titre-inverse', label: 'Titre, de Z à A' },
    { value: 'vues', label: 'Les plus vues' },
  ];
  private readonly categories = inject(SiteData).categories;
  protected readonly categoryOptions = computed<SelectOption<string>[]>(() => [
    { value: ALL_CATEGORIES, label: 'Toutes les catégories' },
    ...this.categories().map((category) => ({ value: category.slug, label: category.name })),
  ]);

  protected readonly status = computed<StatusFilter>(() => {
    const status = this.statut();
    return status && status in STATUSES ? (status as Status) : 'ALL';
  });
  protected readonly themeFilter = computed<ThemeFilter>(() => themeOfSlug(this.theme()) ?? 'ALL');
  protected readonly sort = computed<SortOrder>(() => {
    const sort = this.tri();
    return sort && sort in SORTS ? (sort as SortOrder) : DEFAULT_SORT;
  });
  /** The creation date when the list is sorted by it, else the last change. */
  protected readonly showsCreation = computed(() => this.sort() === 'creation' || this.sort() === 'anciennes');
  protected readonly category = computed(() => this.categorie() ?? ALL_CATEGORIES);
  protected readonly tagSlug = computed(() => this.tag() ?? ALL_TAGS);
  private readonly tags = resource({ loader: () => this.api.invoke(listAdminTags) });
  protected readonly tagOptions = computed<SelectOption<string>[]>(() => [
    { value: ALL_TAGS, label: 'Tous les tags' },
    ...(this.tags.value() ?? []).map((tag) => ({ value: tag.slug, label: `${tag.name} (${tag.recipeCount})` })),
  ]);
  protected readonly ingredientId = computed(() => {
    const id = Number(this.idIngredient());
    return Number.isInteger(id) && id > 0 ? id : undefined;
  });
  /** From the gallery: the recipes showing this photo. */
  protected readonly imageId = computed(() => this.photo() || undefined);
  /** What is typed, sent to the URL once the admin pauses. */
  protected readonly search = signal('');

  /** While the next list loads, the previous one stays on screen: the admin keeps their place in the page. */
  protected readonly recipes = new InfiniteList({
    params: () => ({
      q: this.q()?.trim() || undefined,
      ...statusQuery(this.status()),
      theme: this.themeFilter() === 'ALL' ? undefined : (this.themeFilter() as Theme),
      category: this.category() || undefined,
      tag: this.tagSlug() || undefined,
      ingredientId: this.ingredientId(),
      imageId: this.imageId(),
      size: PAGE_SIZE,
      sort: SORTS[this.sort()],
    }),
    load: (page, params) => this.api.invoke(searchRecipes, { ...params, page }),
    key: (recipe) => recipe.id,
  });

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
      this.themeFilter() !== 'ALL' ||
      !!this.category() ||
      !!this.tagSlug() ||
      this.ingredientId() !== undefined ||
      this.imageId() !== undefined,
  );

  /** Kept when the filters change. */
  protected readonly selection = new Selection<number>();
  protected readonly shownIds = computed(() => this.recipes.items().map((recipe) => recipe.id));
  protected readonly deleting = signal(false);
  /** A filter, an order or a search changes the list in place. */
  private readonly keepScroll = keepScrollThroughNextNavigation();

  constructor() {
    // The fields show the search of the URL (on arrival, back and forward)
    effect(() => this.search.set(this.q() ?? ''));
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


  protected changeTheme(theme: ThemeFilter | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.theme]: theme && theme !== 'ALL' ? themeSlug(theme) : null });
  }

  /** "Publier maintenant": a failed recipe (or any draft) published at once. */
  protected async publishNow(recipe: RecipeAdminSummary): Promise<void> {
    this.publishing.set(recipe.id);
    const published = await attempt(this.api.invoke(publishRecipe, { id: recipe.id }));
    this.publishing.set(null);
    if (published.ok) {
      this.toaster.success(`« ${recipe.title} » publiée`);
      this.recipes.reload();
    }
  }

  protected changeStatus(status: StatusFilter | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.status]: status && status !== 'ALL' ? status : null });
  }

  protected changeSort(sort: SortOrder | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.sort]: sort && sort !== DEFAULT_SORT ? sort : null });
  }

  /** "1 vue", "1 234 vues". */
  protected views(count: number): string {
    return `${count.toLocaleString('fr-FR')} vue${count > 1 ? 's' : ''}`;
  }

  protected changeCategory(slug: string | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.category]: slug || null });
  }

  protected changeTag(slug: string | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.tag]: slug || null });
  }

  protected clearImage(): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.image]: null });
  }

  protected changeIngredient(id: number | undefined): void {
    this.updateQuery({ [ADMIN_RECIPES_QUERY.ingredientId]: id === undefined ? null : String(id) });
  }

  /** The order chosen stays: it is not a filter. */
  protected clearFilters(): void {
    this.search.set('');
    this.keepScroll();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.sort() === DEFAULT_SORT ? {} : { [ADMIN_RECIPES_QUERY.sort]: this.sort() },
      replaceUrl: true,
    });
  }

  /** A new draft with the same content, opened in the editor. */
  protected async duplicate(recipe: RecipeAdminSummary): Promise<void> {
    const copy = await attempt(this.api.invoke(duplicateRecipe, { id: recipe.id }));
    if (copy.ok) {
      this.toaster.success(`Copie créée en brouillon : « ${copy.value.title} »`);
      await this.router.navigate([copy.value.id], { relativeTo: this.route });
    }
  }

  protected async remove(recipe: RecipeAdminSummary): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Mettre la recette à la corbeille ?',
      message: `« ${recipe.title} » quitte le site et reste 30 jours dans la corbeille, d'où elle peut être restaurée. Sa photo reste dans la galerie`,
      confirmLabel: 'Mettre à la corbeille',
    });
    if (!confirmed || !(await attempt(this.api.invoke(deleteRecipe, { id: recipe.id }))).ok) {
      return;
    }
    this.toaster.success('Recette mise à la corbeille');
    if (this.selection.has(recipe.id)) {
      this.selection.toggle(recipe.id);
    }
    this.recipes.reload();
  }

  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Mettre ${count} recettes à la corbeille ?` : 'Mettre la recette à la corbeille ?',
      message:
        count > 1
          ? `Les ${count} recettes sélectionnées quittent le site et restent 30 jours dans la corbeille. Leurs photos restent dans la galerie`
          : 'La recette sélectionnée quitte le site et reste 30 jours dans la corbeille. Sa photo reste dans la galerie',
      confirmLabel: 'Mettre à la corbeille',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteRecipes, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} recettes mises à la corbeille` : 'Recette mise à la corbeille');
      this.selection.clear();
      this.recipes.reload();
    }
  }

  /** Any filter change starts the list over, the admin staying where they are on the page. */
  private updateQuery(queryParams: Record<string, string | null>): void {
    this.keepScroll();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
