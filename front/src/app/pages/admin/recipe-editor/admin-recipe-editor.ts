import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FieldTree, FormField, form, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { ImageUploads } from '../../../core/api/image-uploads';
import { createCategory } from '../../../core/api/generated/fn/admin-categories/create-category';
import { createRecipe } from '../../../core/api/generated/fn/admin-recipes/create-recipe';
import { getRecipeAiStatus } from '../../../core/api/generated/fn/admin-recipe-ai/get-recipe-ai-status';
import { duplicateRecipe } from '../../../core/api/generated/fn/admin-recipes/duplicate-recipe';
import { publishRecipe } from '../../../core/api/generated/fn/admin-recipes/publish-recipe';
import { THEMES, themeLabel } from '../../../shared/format/themes';
import { previewRecipe } from '../../../core/api/generated/fn/admin-recipes/preview-recipe';
import { chooseRecipeImage } from '../../../core/api/generated/fn/admin-recipes/choose-recipe-image';
import { chooseRecipePinterestImage } from '../../../core/api/generated/fn/admin-recipes/choose-recipe-pinterest-image';
import { replaceRecipeImage } from '../../../core/api/generated/fn/admin-recipes/replace-recipe-image';
import { replaceRecipePinterestImage } from '../../../core/api/generated/fn/admin-recipes/replace-recipe-pinterest-image';
import { createTag } from '../../../core/api/generated/fn/admin-tags/create-tag';
import { listAdminTags } from '../../../core/api/generated/fn/admin-tags/list-admin-tags';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { updateRecipe } from '../../../core/api/generated/fn/admin-recipes/update-recipe';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { listAdminGlossary } from '../../../core/api/generated/fn/admin-glossary/list-admin-glossary';
import { glossaryMatcher, markTerms } from '../../../shared/format/glossary';
import { GlossaryTermDialog } from '../glossary/glossary-term-dialog';
import { RecipeAiDraft } from '../../../core/api/generated/models/recipe-ai-draft';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { recipeLink } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { NUTRI_SCORE_KINDS, NutriScoreKind } from '../../../shared/format/nutrition';
import { SuggestInput, Suggestion } from '../../../shared/ui/suggest-input/suggest-input';
import { hasParts } from '../../recipe/recipe-parts';
import RecipePreview from '../recipe-preview/recipe-preview';
import { EditHistory } from '../edit-history/edit-history';
import { EditorBar } from '../editor-bar/editor-bar';
import { MarkdownTools } from '../markdown-tools/markdown-tools';
import { PreviewFrame } from '../preview-frame/preview-frame';
import { parisDateTime } from '../../../shared/format/paris-time';
import {
  MAX_QUESTIONS,
  MoldShapeChoice,
  PartDraft,
  RecipeTheme,
  RecipeDraft,
  emptyIngredient,
  emptyPart,
  linkedPart,
  emptyQuestion,
  emptyStep,
  fromAiDraft,
  hasContent,
  recipeSchema,
  toDraft,
  toRecipeForm,
} from './recipe-draft';
import { RecipeAiDialog } from './recipe-ai-dialog';
import { RecipeNutritionPanel } from './recipe-nutrition-panel';
import { RecoveredDraft } from '../recovered-draft';
import { UnsavedChanges } from './unsaved-changes.guard';
import { Icon } from '../../../shared/ui/icon/icon';

type ListName = 'ingredients' | 'steps';

type PendingImage = { file: File } | { imageId: string };

/** The recipe's photo, or the vertical one offered to Pinterest. */
type PhotoSlot = 'main' | 'pinterest';

/** The form being typed, kept in this browser until saved: a closed tab or a sleeping phone loses nothing. */
interface StoredDraft {
  savedAt: string;
  /** updatedAt of the recipe it was typed on; null for a new recipe. */
  basedOn: string | null;
  usesParts: boolean;
  draft: RecipeDraft;
}

const STORED_DRAFT_PREFIX = 'yona-recipe-draft-';
const STORE_DELAY_MS = 800;

const MOLD_OPTIONS: SelectOption<MoldShapeChoice>[] = [
  { value: 'NONE', label: 'Pas de moule' },
  { value: 'ROUND', label: 'Rond' },
  { value: 'SQUARE', label: 'Carré' },
  { value: 'RECTANGLE', label: 'Rectangulaire' },
];

const DIFFICULTY_WORDS: Record<number, string> = {
  1: 'très facile',
  2: 'facile',
  3: 'moyenne',
  4: 'difficile',
  5: 'expert',
};

/** 1 to 5 by half points, shown as stars on the recipe page. */
const DIFFICULTY_OPTIONS: SelectOption<number | null>[] = [
  { value: null, label: 'Non précisée' },
  ...Array.from({ length: 9 }, (_option, index) => {
    const value = 1 + index / 2;
    const words = DIFFICULTY_WORDS[value];
    return { value, label: `${value.toLocaleString('fr-FR')} / 5${words ? ` (${words})` : ''}` };
  }),
];

@Component({
  selector: 'yona-admin-recipe-editor',
  imports: [
    Icon,
    EditorBar,
    PreviewFrame,
    RecoveredDraft,
    NgTemplateOutlet,
    RouterLink,
    FormField,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    Button,
    Dialog,
    FieldError,
    GlossaryTermDialog,
    ImageUpload,
    MarkdownTools,
    RecipeAiDialog,
    RecipeNutritionPanel,
    RecipePreview,
    Select,
    SuggestInput,
  ],
  templateUrl: './admin-recipe-editor.html',
  styleUrl: './admin-recipe-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'history.onKeydown($event)', '(input)': 'history.onInput($event)' },
})
export default class AdminRecipeEditor implements UnsavedChanges {
  /** From adminRecipeResolver; absent for a new recipe. */
  readonly recipe = input<RecipeDetail>();

  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly isNew = computed(() => !this.recipe());
  protected readonly draft = linkedSignal(() => toDraft(this.recipe()));
  protected readonly recipeForm = form(this.draft, recipeSchema);
  /** Last saved state, to warn before leaving with unsaved changes. */
  private readonly savedSnapshot = linkedSignal(() => JSON.stringify(toDraft(this.recipe())));
  protected readonly unsaved = computed(() => JSON.stringify(this.draft()) !== this.savedSnapshot());

  /**
   * Recipe in parts (the dough, the filling…), each with its title, ingredients and steps.
   * Otherwise its single part is edited as plain ingredients and steps.
   */
  protected readonly usesParts = linkedSignal(() => hasParts(this.recipe()?.parts ?? []));

  /** Ctrl+Z and Ctrl+Y over the whole form: a word typed, a step removed, the form filled by the AI. */
  protected readonly history = new EditHistory<{ draft: RecipeDraft; usesParts: boolean }>({
    write: (state) => {
      this.draft.set(state.draft);
      this.usesParts.set(state.usesParts);
    },
    host: () => this.host.nativeElement,
    injector: inject(Injector),
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly statusOptions: SelectOption<'DRAFT' | 'PUBLISHED'>[] = [
    { value: 'DRAFT', label: 'Brouillon (invisible sur le site)', badge: 'draft' },
    { value: 'PUBLISHED', label: 'Publiée', badge: 'published' },
  ];
  protected readonly themeOptions: SelectOption<RecipeTheme>[] = THEMES.map(({ value, label }) => ({ value, label }));
  /** The time a failed publication was planned for: "samedi 31 octobre à 10:00". */
  protected readonly failedAt = computed(() => {
    const recipe = this.recipe();
    return recipe?.status === 'FAILED' && recipe.scheduledAt ? parisDateTime(recipe.scheduledAt) : null;
  });
  protected readonly publishing = signal(false);
  protected readonly difficultyOptions = DIFFICULTY_OPTIONS;
  protected readonly moldOptions = MOLD_OPTIONS;
  protected readonly nutriScoreKindOptions: SelectOption<NutriScoreKind>[] = NUTRI_SCORE_KINDS.map(({ value, label }) => ({
    value,
    label,
  }));
  /** What the grid chosen is for. */
  protected readonly nutriScoreKindHint = computed(
    () => NUTRI_SCORE_KINDS.find((kind) => kind.value === this.draft().nutriScoreKind)?.hint ?? '',
  );
  /** Under the scheduling field: "samedi 31 octobre à 10:00". */
  protected readonly scheduledLabel = computed(() => {
    const recipe = this.recipe();
    return recipe?.scheduledAt && recipe.status === 'DRAFT' ? parisDateTime(recipe.scheduledAt) : null;
  });
  protected readonly duplicating = signal(false);
  /** A form typed earlier and never saved, offered back when the editor opens. */
  protected readonly recovered = signal<StoredDraft | null>(null);
  /** The recipe was saved again since that form was typed (another tab, another admin). */
  protected readonly recoveredIsOutdated = computed(() => {
    const stored = this.recovered();
    return !!stored && stored.basedOn !== (this.recipe()?.updatedAt ?? null);
  });
  private readonly storageKey = computed(() => STORED_DRAFT_PREFIX + (this.recipe()?.id ?? 'nouvelle'));
  private storeTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly categories = this.siteData.categories;
  /** The first category chosen: it gives the recipe its theme, unless it holds both. */
  protected readonly mainCategory = computed(() => {
    const id = this.draft().categoryIds[0];
    return this.categories().find((category) => category.id === id) ?? null;
  });
  /** The theme the recipe will have once saved (see RecipeService.themeOf). */
  protected readonly theme = computed(() => this.mainCategory()?.theme ?? this.draft().theme);
  protected readonly themeLabel = themeLabel;
  /** Among the chosen ones: the main category, in the recipe URL. */
  protected readonly mainCategoryOptions = computed<SelectOption<number>[]>(() =>
    this.draft().categoryIds.map((id) => ({
      value: id,
      label: this.categories().find((category) => category.id === id)?.name ?? '',
    })),
  );
  /** Every tag, to tick those of the recipe. */
  protected readonly tags = resource({ loader: () => this.api.invoke(listAdminTags) });

  // The glossary, without leaving the recipe: its words underlined in the steps, a word selected added in a window
  protected readonly glossaryTerms = resource({ loader: () => this.api.invoke(listAdminGlossary) });
  private readonly glossaryWords = computed(() => glossaryMatcher(this.glossaryTerms.value() ?? []));
  /** Kept for later, without definition yet. */
  protected readonly wordsToDefine = computed(() => (this.glossaryTerms.value() ?? []).filter((term) => !term.definition).length);
  /** Words selected in a step: "+ Glossaire" shows under it. */
  protected readonly glossarySelection = signal<{ p: number; i: number; text: string } | null>(null);
  private readonly glossaryDialog = viewChild.required(GlossaryTermDialog);
  protected readonly creatingTag = signal(false);
  protected readonly newTagName = signal('');
  /** Ingredients already known, the most used first, so that the same one is not created twice. */
  private readonly knownIngredients = resource({
    loader: () => this.api.invoke(searchIngredients, {}),
  });
  protected readonly ingredientSuggestions = computed<Suggestion[]>(() =>
    [...(this.knownIngredients.value() ?? [])]
      .sort((a, b) => b.recipeCount - a.recipeCount || a.name.localeCompare(b.name, 'fr'))
      .map((ingredient) => ({
        value: ingredient.name,
        hint: ingredient.recipeCount
          ? `${ingredient.recipeCount} recette${ingredient.recipeCount > 1 ? 's' : ''}`
          : undefined,
      })),
  );
  /** Every recipe but this one, to use as a part; drafts marked as such. */
  private readonly allRecipes = resource({ loader: () => this.loadRecipes() });
  protected readonly linkableRecipes = computed<SelectOption<number>[]>(() =>
    (this.allRecipes.value() ?? [])
      .filter((recipe) => recipe.id !== this.recipe()?.id)
      .map((recipe) => ({ value: recipe.id, label: recipe.status === 'PUBLISHED' ? recipe.title : `${recipe.title} (non publiée)` })),
  );
  /** Already in a part: not suggested again there (a part lists an ingredient once). */
  protected readonly ingredientNames = computed(() =>
    this.draft().parts.map(
      (part) => new Set(part.ingredients.map((ingredient) => ingredient.name.trim()).filter(Boolean)),
    ),
  );
  /** Ingredients (or steps) can be dragged from one part to another. */
  protected readonly ingredientListIds = computed(() => this.draft().parts.map((_part, index) => `ingredients-${index}`));
  protected readonly stepListIds = computed(() => this.draft().parts.map((_part, index) => `steps-${index}`));
  protected readonly publicLink = computed(() => {
    const recipe = this.recipe();
    return recipe?.status === 'PUBLISHED' ? recipeLink(recipe) : null;
  });

  protected readonly imageId = linkedSignal(() => this.recipe()?.imageId ?? null);
  /** New recipe: the photo (a file, or an image of the gallery) is set right after the recipe is created. */
  private readonly pendingImage = signal<PendingImage | null>(null);
  protected readonly pendingPreview = signal<string | null>(null);
  protected readonly uploading = signal(false);
  /** Share of a new photo sent (0 to 1) while it uploads. */
  protected readonly uploadProgress = signal<number | null>(null);
  /** Same as the photo, for the vertical photo offered to Pinterest. */
  protected readonly pinterestImageId = linkedSignal(() => this.recipe()?.pinterestImageId ?? null);
  private readonly pendingPinterest = signal<PendingImage | null>(null);
  protected readonly pinterestPreview = signal<string | null>(null);
  protected readonly pinterestUploading = signal(false);
  protected readonly pinterestProgress = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly creatingCategory = signal(false);
  /** The form as it would be saved, shown full screen by "Aperçu". */
  protected readonly preview = signal<RecipeDetail | null>(null);
  protected readonly previewOpen = signal(false);
  protected readonly previewing = signal(false);
  /** Under "Aperçu", in the dialog's head. */
  protected readonly previewStatus = computed(() => {
    const status = this.preview()?.status === 'PUBLISHED' ? 'Recette publiée' : 'Brouillon, invisible sur le site';
    return this.unsaved() ? `${status} · modifications pas encore enregistrées` : status;
  });
  protected readonly newCategoryName = signal('');
  /** "Remplir avec l'IA": greyed out, with the reason, when it cannot work (no key, quota used…). */
  protected readonly aiStatus = resource({ loader: () => this.api.invoke(getRecipeAiStatus) });
  protected readonly aiOpen = signal(false);
  /** The form was filled by the AI and not saved since: a banner asks to check it. */
  protected readonly aiFilled = signal(false);
  /** Why Gemini cannot be used now; null when it can. */
  protected readonly geminiUnavailable = computed(() => {
    const status = this.aiStatus.value();
    if (!status || status.available) {
      return null;
    }
    return status.availableAgainAt ? `${status.reason} (vers ${parisDateTime(status.availableAgainAt)})` : (status.reason ?? '');
  });

  constructor() {
    // Each change a step of Ctrl+Z; another recipe, a history of its own
    effect(() => {
      const state = { draft: this.draft(), usesParts: this.usesParts() };
      // The recipe read again (created, published from the list of failures): a new history
      const recipe = this.recipe() ?? null;
      untracked(() => this.history.record(state, recipe));
    });
    // On opening (and on moving to another recipe): a form typed earlier and never saved
    effect(() => {
      const key = this.storageKey();
      untracked(() => {
        const stored = readStoredDraft(key);
        if (stored && JSON.stringify(stored.draft) !== JSON.stringify(this.draft())) {
          this.recovered.set(stored);
        } else {
          removeStoredDraft(key);
          this.recovered.set(null);
        }
      });
    });
    // Each change kept shortly after typing, until saved; nothing written while the offer is open
    effect(() => {
      const draft = this.draft();
      const unsaved = this.unsaved();
      if (this.recovered()) {
        return;
      }
      clearTimeout(this.storeTimer);
      this.storeTimer = setTimeout(() => this.storeDraft(draft, unsaved), STORE_DELAY_MS);
    });
    // Leaving the tab or locking the phone: written at once
    const flush = () => {
      if (document.visibilityState === 'hidden' && !this.recovered()) {
        clearTimeout(this.storeTimer);
        this.storeDraft(this.draft(), this.unsaved());
      }
    };
    document.addEventListener('visibilitychange', flush);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', flush);
      clearTimeout(this.storeTimer);
      this.revokePreview('main');
      this.revokePreview('pinterest');
    });
  }

  /** "Reprendre": the form as it was left. */
  protected resumeRecovered(): void {
    const stored = this.recovered();
    if (stored) {
      this.draft.set(stored.draft);
      this.usesParts.set(stored.usesParts);
      this.recovered.set(null);
    }
  }

  /** "Ignorer": the saved recipe stays, the typed form is forgotten. */
  protected discardRecovered(): void {
    removeStoredDraft(this.storageKey());
    this.recovered.set(null);
  }

  /** Largest page of the API: read page after page. */
  private async loadRecipes(): Promise<RecipeAdminSummary[]> {
    const recipes: RecipeAdminSummary[] = [];
    for (let page = 0, totalPages = 1; page < totalPages; page++) {
      const result = await this.api.invoke(searchRecipes, { page, size: 50, sort: ['title,asc'] });
      recipes.push(...result.content);
      totalPages = result.totalPages;
    }
    return recipes;
  }

  private storeDraft(draft: RecipeDraft, unsaved: boolean): void {
    if (!unsaved) {
      removeStoredDraft(this.storageKey());
      return;
    }
    const stored: StoredDraft = {
      savedAt: new Date().toISOString(),
      basedOn: this.recipe()?.updatedAt ?? null,
      usesParts: this.usesParts(),
      draft,
    };
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(stored));
    } catch {
      // Storage blocked or full: the form still works, it just isn't kept
    }
  }

  /**
   * A new draft with the same content, photos, categories and tags, opened right away. Made from
   * the saved recipe: unsaved changes are not copied.
   */
  protected async duplicate(): Promise<void> {
    const recipe = this.recipe();
    if (!recipe) {
      return;
    }
    if (
      this.unsaved() &&
      !(await this.confirm.ask({
        title: 'Dupliquer la version enregistrée ?',
        message: 'Les modifications pas encore enregistrées ne seront pas dans la copie',
        confirmLabel: 'Dupliquer',
      }))
    ) {
      return;
    }
    this.duplicating.set(true);
    const copy = await attempt(this.api.invoke(duplicateRecipe, { id: recipe.id }));
    this.duplicating.set(false);
    if (copy.ok) {
      // Already asked: leaving does not ask again
      this.savedSnapshot.set(JSON.stringify(this.draft()));
      this.toaster.success(`Copie créée en brouillon : « ${copy.value.title} »`);
      await this.router.navigate(['/admin/recettes', copy.value.id]);
    }
  }

  protected clearSchedule(): void {
    this.draft.update((draft) => ({ ...draft, scheduledAt: '' }));
  }

  // Ingredients a step needs, for the cooking mode

  /** The named ingredients of the part, to tick those of each step. */
  protected stepIngredientChoices(partIndex: number): { key: string; name: string }[] {
    return (this.draft().parts[partIndex]?.ingredients ?? [])
      .filter((line) => line.name.trim())
      .map((line) => ({ key: line.key, name: line.name.trim() }));
  }

  /** The text of a step, its glossary words in a <mark>: drawn under the field, it underlines them. */
  protected markedStep(text: string): string {
    return markTerms(text, this.glossaryWords());
  }

  /** A word or a few selected in a step, its punctuation left out: offered to the glossary. */
  protected checkSelection(event: Event, p: number, i: number): void {
    const area = event.target as HTMLTextAreaElement;
    const text = area.value
      .slice(area.selectionStart, area.selectionEnd)
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      .trim();
    this.glossarySelection.set(text && text.length <= 60 && !text.includes('\n') ? { p, i, text } : null);
  }

  protected clearSelection(): void {
    this.glossarySelection.set(null);
  }

  /** The underlined copy follows the field when it scrolls. */
  protected syncMarks(event: Event): void {
    const area = event.target as HTMLTextAreaElement;
    const marks = area.previousElementSibling as HTMLElement | null;
    if (marks) {
      marks.scrollTop = area.scrollTop;
    }
  }

  /** {@code word}: the words selected; empty from the "Glossaire" button. */
  protected openGlossary(word: string): void {
    this.glossarySelection.set(null);
    this.glossaryDialog().start(word);
  }

  protected toggleStepIngredient(partIndex: number, stepIndex: number, key: string): void {
    this.updatePart(partIndex, (part) => ({
      ...part,
      steps: part.steps.map((step, index) =>
        index !== stepIndex
          ? step
          : {
              ...step,
              ingredientKeys: step.ingredientKeys.includes(key)
                ? step.ingredientKeys.filter((chosen) => chosen !== key)
                : [...step.ingredientKeys, key],
            },
      ),
    }));
  }

  hasUnsavedChanges(): boolean {
    return this.unsaved();
  }

  /**
   * The recipe as visitors would see it once saved, changes included, without saving anything:
   * the API applies the same checks and transformations as a save, then discards them.
   */
  protected async openPreview(): Promise<void> {
    await submit(this.recipeForm, async () => {
      this.previewing.set(true);
      try {
        const recipe = await this.api.invoke(previewRecipe, {
          id: this.recipe()?.id,
          body: toRecipeForm(this.draft()),
        });
        // A new recipe gets its photo once created: the one chosen in the gallery shows already
        this.preview.set({ ...recipe, imageId: this.imageId() ?? undefined });
        this.previewOpen.set(true);
      } catch {
        // The API error is already shown as a toast
      } finally {
        this.previewing.set(false);
      }
      return undefined;
    });
  }


  protected isInvalid(field: FieldTree<unknown>): boolean {
    return field().touched() && field().invalid();
  }

  // Categories

  protected isChosen(categoryId: number): boolean {
    return this.draft().categoryIds.includes(categoryId);
  }

  /** Added at the end; removing the main category makes the next one the main category. */
  protected toggleCategory(categoryId: number): void {
    this.draft.update((draft) => ({
      ...draft,
      categoryIds: draft.categoryIds.includes(categoryId)
        ? draft.categoryIds.filter((id) => id !== categoryId)
        : [...draft.categoryIds, categoryId],
    }));
  }

  protected chooseMainCategory(categoryId: number | undefined): void {
    if (categoryId === undefined) {
      return;
    }
    this.draft.update((draft) => ({
      ...draft,
      categoryIds: [categoryId, ...draft.categoryIds.filter((id) => id !== categoryId)],
    }));
  }

  /** Creates a category without leaving the recipe, and adds it to the recipe's. */
  protected async addCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) {
      this.toaster.error('Donnez un nom à la catégorie');
      return;
    }
    const created = await attempt(this.api.invoke(createCategory, { body: { name } }));
    if (!created.ok) {
      return;
    }
    await this.siteData.load();
    this.draft.update((draft) => ({ ...draft, categoryIds: [...draft.categoryIds, created.value.id] }));
    this.creatingCategory.set(false);
    this.newCategoryName.set('');
    this.toaster.success(`Catégorie « ${created.value.name} » créée et ajoutée à la recette`);
  }

  // Tags

  protected isTagChosen(tagId: number): boolean {
    return this.draft().tagIds.includes(tagId);
  }

  protected toggleTag(tagId: number): void {
    this.draft.update((draft) => ({
      ...draft,
      tagIds: draft.tagIds.includes(tagId) ? draft.tagIds.filter((id) => id !== tagId) : [...draft.tagIds, tagId],
    }));
  }

  /** Creates a tag without leaving the recipe, and ticks it. */
  protected async addTag(): Promise<void> {
    const name = this.newTagName().trim();
    if (!name) {
      this.toaster.error('Donnez un nom au tag');
      return;
    }
    const created = await attempt(this.api.invoke(createTag, { body: { name } }));
    if (!created.ok) {
      return;
    }
    this.tags.reload();
    this.draft.update((draft) => ({ ...draft, tagIds: [...draft.tagIds, created.value.id] }));
    this.creatingTag.set(false);
    this.newTagName.set('');
    this.toaster.success(`Tag « ${created.value.name} » créé et ajouté à la recette`);
  }

  // Parts

  /** The current ingredients and steps become the first part, followed by an empty one. */
  protected splitIntoParts(): void {
    this.usesParts.set(true);
    this.draft.update((draft) => ({ ...draft, parts: [...draft.parts, emptyPart()] }));
  }

  /** Back to a recipe without parts, once a single part is left. */
  protected stopUsingParts(): void {
    this.usesParts.set(false);
    this.updatePart(0, (part) => ({ ...part, title: '' }));
  }

  protected addPart(): void {
    this.draft.update((draft) => ({ ...draft, parts: [...draft.parts, emptyPart()] }));
  }

  /** Another recipe, written once, as a part of this one. */
  protected addLinkedPart(recipeId: number): void {
    const recipe = this.allRecipes.value()?.find((candidate) => candidate.id === recipeId);
    if (recipe) {
      this.draft.update((draft) => ({ ...draft, parts: [...draft.parts, linkedPart(recipe)] }));
    }
  }

  protected async removePart(index: number): Promise<void> {
    const part = this.draft().parts[index];
    const hasContent =
      part &&
      !part.linkedRecipeId &&
      (part.title.trim() ||
        part.ingredients.some((line) => line.name.trim()) ||
        part.steps.some((step) => step.description.trim()));
    if (
      hasContent &&
      !(await this.confirm.ask({
        title: 'Supprimer cette partie ?',
        message: `« ${part.title.trim() || `Partie ${index + 1}`} » sera retirée avec ses ingrédients et ses étapes`,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    this.draft.update((draft) => ({ ...draft, parts: draft.parts.filter((_part, position) => position !== index) }));
  }

  protected movePart(from: number, to: number): void {
    if (to < 0 || to >= this.draft().parts.length) {
      return;
    }
    this.draft.update((draft) => {
      const parts = [...draft.parts];
      moveItemInArray(parts, from, to);
      return { ...draft, parts };
    });
  }

  // Ingredients and steps of a part

  protected add(list: ListName, partIndex: number): void {
    this.updatePart(partIndex, (part) =>
      list === 'ingredients'
        ? { ...part, ingredients: [...part.ingredients, emptyIngredient()] }
        : { ...part, steps: [...part.steps, emptyStep()] },
    );
  }

  protected remove(list: ListName, partIndex: number, index: number): void {
    this.updatePart(partIndex, (part) => ({
      ...part,
      [list]: part[list].filter((_item: unknown, position: number) => position !== index),
    }));
  }

  /** Drag and drop, or the arrow buttons for keyboard users. */
  protected move(list: ListName, partIndex: number, from: number, to: number): void {
    const items = this.draft().parts[partIndex]?.[list] ?? [];
    if (to < 0 || to >= items.length || from === to) {
      return;
    }
    this.updatePart(partIndex, (part) => {
      const moved = [...part[list]];
      moveItemInArray(moved, from, to);
      return { ...part, [list]: moved };
    });
  }

  // Questions fréquentes

  protected readonly maxQuestions = MAX_QUESTIONS;

  protected addQuestion(): void {
    this.draft.update((draft) => ({ ...draft, questions: [...draft.questions, emptyQuestion()] }));
  }

  protected removeQuestion(index: number): void {
    this.draft.update((draft) => ({ ...draft, questions: draft.questions.filter((_item, position) => position !== index) }));
  }

  /** The arrow buttons: a short list, no drag and drop needed. */
  protected moveQuestion(from: number, to: number): void {
    this.draft.update((draft) => {
      if (to < 0 || to >= draft.questions.length) {
        return draft;
      }
      const questions = [...draft.questions];
      moveItemInArray(questions, from, to);
      return { ...draft, questions };
    });
  }

  /** Within a part, or from one part to another (the list data is the part index). */
  protected drop(list: ListName, event: CdkDragDrop<number>): void {
    const from = event.previousContainer.data;
    const to = event.container.data;
    if (from === to) {
      this.move(list, to, event.previousIndex, event.currentIndex);
      return;
    }
    this.draft.update((draft) => {
      const parts = draft.parts.map((part) => ({ ...part, [list]: [...part[list]] }));
      transferArrayItem<unknown>(parts[from]![list], parts[to]![list], event.previousIndex, event.currentIndex);
      return { ...draft, parts };
    });
  }

  private updatePart(index: number, change: (part: PartDraft) => PartDraft): void {
    this.draft.update((draft) => ({
      ...draft,
      parts: draft.parts.map((part, position) => (position === index ? change(part) : part)),
    }));
  }

  // Photo

  protected async onImageChosen(file: File, slot: PhotoSlot = 'main'): Promise<void> {
    const recipe = this.recipe();
    if (recipe) {
      await this.uploadImage(recipe.id, file, slot);
      return;
    }
    this.revokePreview(slot);
    this.slotImageId(slot).set(null);
    this.slotPending(slot).set({ file });
    this.slotPreview(slot).set(URL.createObjectURL(file));
  }

  /** An image of the gallery, or none (null). The previous photo stays in the gallery. */
  protected async onImageSelected(imageId: string | null, slot: PhotoSlot = 'main'): Promise<void> {
    const recipe = this.recipe();
    if (recipe) {
      await this.chooseImage(recipe.id, imageId, slot);
      return;
    }
    this.revokePreview(slot);
    this.slotImageId(slot).set(imageId);
    this.slotPending(slot).set(imageId ? { imageId } : null);
  }

  /** "Retoucher": the API has already put the retouched photo in place of the previous one. */
  protected onImageRetouched(imageId: string, slot: PhotoSlot = 'main'): void {
    this.slotImageId(slot).set(imageId);
    if (this.slotPending(slot)()) {
      // A photo of the gallery chosen for a recipe not created yet
      this.slotPending(slot).set({ imageId });
    }
  }

  /** The recipe read by the AI replaces what was typed, after confirmation. */
  protected async fillWithAi(ai: RecipeAiDraft): Promise<void> {
    const replace =
      !hasContent(this.draft()) ||
      (await this.confirm.ask({
        title: 'Remplacer le contenu du formulaire ?',
        message:
          'La recette lue par l’IA remplace le titre, les ingrédients, les étapes et les autres champs déjà remplis. La photo et la publication ne changent pas',
        confirmLabel: 'Remplacer',
      }));
    if (!replace) {
      return;
    }
    this.draft.set(fromAiDraft(this.draft(), ai));
    this.usesParts.set(hasParts(ai.parts));
    this.aiFilled.set(true);
    this.toaster.success('Formulaire rempli par l’IA : relisez-le avant d’enregistrer');
  }

  /** "Publier maintenant", for a failed publication: as saved, without the changes not saved yet. */
  protected async publishNow(): Promise<void> {
    const recipe = this.recipe();
    if (!recipe) {
      return;
    }
    this.publishing.set(true);
    const published = await attempt(this.api.invoke(publishRecipe, { id: recipe.id }));
    this.publishing.set(false);
    if (published.ok) {
      this.toaster.success('Recette publiée');
      await this.router.navigate(['/admin/recettes', recipe.id], { onSameUrlNavigation: 'reload' });
    }
  }

  /** "Publier", in the bar always in sight: saves the form as published, and goes back to a draft if that fails. */
  protected async publish(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Publier cette recette ?',
      message: 'Elle sera visible sur le site, et les abonnés aux notifications seront prévenus',
      confirmLabel: 'Publier',
    });
    if (!confirmed) {
      return;
    }
    const { status, scheduledAt } = this.draft();
    this.draft.update((draft) => ({ ...draft, status: 'PUBLISHED', scheduledAt: '' }));
    if (!(await this.save(true))) {
      this.draft.update((draft) => ({ ...draft, status, scheduledAt }));
    }
  }

  /** False when nothing was saved: the form is not valid, or the API refused. */
  protected async save(publishing = false): Promise<boolean> {
    let saved = false;
    await submit(this.recipeForm, async () => {
      this.saving.set(true);
      try {
        const body = toRecipeForm(this.draft());
        const existing = this.recipe();
        if (existing) {
          const updated = await this.api.invoke(updateRecipe, { id: existing.id, body });
          this.draft.set(toDraft(updated));
          // The same recipe as the API keeps it: not a step of Ctrl+Z
          this.history.replace({ draft: this.draft(), usesParts: this.usesParts() });
          this.savedSnapshot.set(JSON.stringify(this.draft()));
          removeStoredDraft(this.storageKey());
          this.aiFilled.set(false);
          this.toaster.success(publishing ? 'Recette publiée' : 'Recette enregistrée');
        } else {
          const created = await this.api.invoke(createRecipe, { body });
          this.savedSnapshot.set(JSON.stringify(this.draft()));
          removeStoredDraft(this.storageKey());
          for (const slot of ['main', 'pinterest'] as const) {
            const image = this.slotPending(slot)();
            if (image && 'file' in image) {
              await this.uploadImage(created.id, image.file, slot);
            } else if (image) {
              await this.chooseImage(created.id, image.imageId, slot);
            }
          }
          this.toaster.success(publishing ? 'Recette publiée' : 'Recette créée');
          await this.router.navigate(['/admin/recettes', created.id], { replaceUrl: true });
        }
        saved = true;
      } catch {
        // The API error is already shown as a toast
      } finally {
        this.saving.set(false);
      }
      return undefined;
    });
    return saved;
  }

  private async uploadImage(recipeId: number, file: File, slot: PhotoSlot): Promise<void> {
    const progress = slot === 'main' ? this.uploadProgress : this.pinterestProgress;
    const path = slot === 'main' ? replaceRecipeImage.PATH : replaceRecipePinterestImage.PATH;
    progress.set(0);
    try {
      await this.changeImage(
        () =>
          this.imageUploads.send<RecipeDetail>(path.replace('{id}', String(recipeId)), file, (sent) => progress.set(sent)),
        slot,
        slot === 'main' ? 'Photo enregistrée' : 'Photo Pinterest enregistrée',
      );
    } finally {
      progress.set(null);
    }
  }

  private async chooseImage(recipeId: number, imageId: string | null, slot: PhotoSlot): Promise<void> {
    const body = { imageId: imageId ?? undefined };
    await this.changeImage(
      () =>
        slot === 'main'
          ? this.api.invoke(chooseRecipeImage, { id: recipeId, body })
          : this.api.invoke(chooseRecipePinterestImage, { id: recipeId, body }),
      slot,
      imageId ? 'Photo enregistrée' : 'Photo retirée, elle reste dans la galerie',
    );
  }

  private async changeImage(call: () => Promise<RecipeDetail>, slot: PhotoSlot, successMessage: string): Promise<void> {
    const busy = slot === 'main' ? this.uploading : this.pinterestUploading;
    busy.set(true);
    try {
      const updated = await call();
      this.imageId.set(updated.imageId ?? null);
      this.pinterestImageId.set(updated.pinterestImageId ?? null);
      this.toaster.success(successMessage);
    } catch {
      // The API error is already shown as a toast
    } finally {
      busy.set(false);
    }
  }

  private slotImageId(slot: PhotoSlot) {
    return slot === 'main' ? this.imageId : this.pinterestImageId;
  }

  private slotPending(slot: PhotoSlot) {
    return slot === 'main' ? this.pendingImage : this.pendingPinterest;
  }

  private slotPreview(slot: PhotoSlot) {
    return slot === 'main' ? this.pendingPreview : this.pinterestPreview;
  }

  private revokePreview(slot: PhotoSlot): void {
    const preview = this.slotPreview(slot)();
    if (preview) {
      URL.revokeObjectURL(preview);
      this.slotPreview(slot).set(null);
    }
  }
}

function readStoredDraft(key: string): StoredDraft | null {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as StoredDraft | null;
    // A draft kept before a field existed (equipment…) gets its empty value
    return stored?.draft && Array.isArray(stored.draft.parts) ? { ...stored, draft: { ...toDraft(null), ...stored.draft } } : null;
  } catch {
    return null;
  }
}

function removeStoredDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing was kept
  }
}
