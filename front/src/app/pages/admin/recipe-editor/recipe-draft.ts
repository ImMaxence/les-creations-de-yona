import { applyEach, maxLength, min, required, schema, validate } from '@angular/forms/signals';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';
import { RecipeForm } from '../../../core/api/generated/models/recipe-form';

/** Editable copy of a recipe: every field exists, empty ones as "" or null. */
export interface RecipeDraft {
  title: string;
  intro: string;
  status: 'DRAFT' | 'PUBLISHED';
  featured: boolean;
  /** The first one is the main category, in the recipe URL. */
  categoryIds: number[];
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  /** 1 to 5, by half points. */
  difficulty: number | null;
  /** YouTube link as pasted by the admin. */
  videoUrl: string;
  /** A recipe without parts has a single one, untitled. */
  parts: PartDraft[];
}

/** The dough, the filling…: its own ingredients and steps. */
export interface PartDraft {
  title: string;
  ingredients: IngredientDraft[];
  steps: StepDraft[];
}

export interface IngredientDraft {
  name: string;
  quantity: number | null;
  unit: string;
  note: string;
}

export interface StepDraft {
  description: string;
  durationMinutes: number | null;
}

export function emptyPart(): PartDraft {
  return { title: '', ingredients: [emptyIngredient()], steps: [emptyStep()] };
}

export function emptyIngredient(): IngredientDraft {
  return { name: '', quantity: null, unit: '', note: '' };
}

export function emptyStep(): StepDraft {
  return { description: '', durationMinutes: null };
}

export function toDraft(recipe: RecipeDetail | null | undefined): RecipeDraft {
  if (!recipe) {
    return {
      title: '',
      intro: '',
      status: 'DRAFT',
      featured: false,
      categoryIds: [],
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      difficulty: null,
      videoUrl: '',
      parts: [emptyPart()],
    };
  }
  return {
    title: recipe.title,
    intro: recipe.intro ?? '',
    status: recipe.status,
    featured: recipe.featured,
    categoryIds: recipe.categories.map((category) => category.id),
    servings: recipe.servings ?? null,
    prepMinutes: recipe.prepMinutes ?? null,
    cookMinutes: recipe.cookMinutes ?? null,
    difficulty: recipe.difficulty ?? null,
    videoUrl: recipe.youtubeVideoId ? youtubeUrl(recipe.youtubeVideoId) : '',
    parts: recipe.parts.map((part) => ({
      title: part.title ?? '',
      ingredients: part.ingredients.map((line) => ({
        name: line.name,
        quantity: line.quantity ?? null,
        unit: line.unit ?? '',
        note: line.note ?? '',
      })),
      steps: part.steps.map((step) => ({
        description: step.description,
        durationMinutes: step.durationMinutes ?? null,
      })),
    })),
  };
}

/** Request body: blank optional fields are left out rather than sent as "" or null. */
export function toRecipeForm(draft: RecipeDraft): RecipeForm {
  return {
    title: draft.title.trim(),
    intro: blankToUndefined(draft.intro),
    status: draft.status,
    featured: draft.featured && draft.status === 'PUBLISHED',
    categoryIds: draft.categoryIds,
    servings: draft.servings ?? undefined,
    prepMinutes: draft.prepMinutes ?? undefined,
    cookMinutes: draft.cookMinutes ?? undefined,
    difficulty: draft.difficulty ?? undefined,
    videoUrl: blankToUndefined(draft.videoUrl),
    parts: draft.parts.map((part) => ({
      title: blankToUndefined(part.title),
      ingredients: part.ingredients.map((line) => ({
        name: line.name.trim(),
        quantity: line.quantity ?? undefined,
        unit: blankToUndefined(line.unit),
        note: blankToUndefined(line.note),
      })),
      steps: part.steps.map((step) => ({
        description: step.description.trim(),
        durationMinutes: step.durationMinutes ?? undefined,
      })),
    })),
  };
}

/** Same links as the API accepts (YoutubeVideos on the backend): watch, youtu.be, shorts, embed, live. */
export const YOUTUBE_URL =
  /^https:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}(?:[?&#/].*)?$/;

function youtubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function blankToUndefined(text: string): string | undefined {
  return text.trim() || undefined;
}

/** Same comparison as the API: "Crème" and "creme" are the same ingredient. */
function ingredientKey(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').trim();
}

/** Same rules as the API (RecipeForm and RecipeService on the backend), checked before sending. */
export const recipeSchema = schema<RecipeDraft>((recipe) => {
  required(recipe.title, { message: 'Donnez un titre à la recette.' });
  maxLength(recipe.title, 150, { message: '150 caractères au maximum.' });
  maxLength(recipe.intro, 1000, { message: '1 000 caractères au maximum.' });
  validate(recipe.categoryIds, ({ value }) =>
    value().length === 0 ? { kind: 'noCategory', message: 'Choisissez au moins une catégorie.' } : undefined,
  );
  min(recipe.servings, 1, { message: 'Au moins 1 portion.' });
  min(recipe.prepMinutes, 0, { message: 'Durée positive.' });
  min(recipe.cookMinutes, 0, { message: 'Durée positive.' });
  validate(recipe.videoUrl, ({ value }) =>
    value().trim() && !YOUTUBE_URL.test(value().trim())
      ? {
          kind: 'videoUrl',
          message: "Collez le lien d'une vidéo YouTube (youtube.com/watch?v=…, youtu.be/… ou youtube.com/shorts/…).",
        }
      : undefined,
  );
  validate(recipe.featured, ({ value, valueOf }) =>
    value() && valueOf(recipe.status) !== 'PUBLISHED'
      ? { kind: 'featuredDraft', message: 'Seule une recette publiée peut être à la une.' }
      : undefined,
  );

  // At least one ingredient and one step in the whole recipe, whatever the part
  validate(recipe.parts, ({ value }) => {
    if (value().every((part) => part.ingredients.length === 0)) {
      return { kind: 'noIngredient', message: 'Ajoutez au moins un ingrédient.' };
    }
    if (value().every((part) => part.steps.length === 0)) {
      return { kind: 'noStep', message: 'Ajoutez au moins une étape.' };
    }
    return undefined;
  });
  applyEach(recipe.parts, (part) => {
    validate(part.title, ({ value, valueOf }) =>
      valueOf(recipe.parts).length > 1 && !value().trim()
        ? { kind: 'partTitle', message: 'Donnez un titre à cette partie (la pâte, la garniture…).' }
        : undefined,
    );
    maxLength(part.title, 100, { message: '100 caractères au maximum.' });
    validate(part, ({ value }) =>
      value().ingredients.length === 0 && value().steps.length === 0
        ? { kind: 'emptyPart', message: 'Ajoutez un ingrédient ou une étape à cette partie.' }
        : undefined,
    );

    // An ingredient once per part; another part may list it again
    validate(part.ingredients, ({ value }) => {
      const seen = new Set<string>();
      const repeated = value().find((line) => {
        const key = ingredientKey(line.name);
        return key !== '' && (seen.has(key) || !seen.add(key));
      });
      return repeated
        ? { kind: 'duplicateIngredient', message: `« ${repeated.name.trim()} » apparaît deux fois dans cette partie.` }
        : undefined;
    });
    applyEach(part.ingredients, (line) => {
      required(line.name, { message: "Nom de l'ingrédient obligatoire." });
      maxLength(line.name, 100, { message: '100 caractères au maximum.' });
      min(line.quantity, 0.01, { message: 'Quantité positive.' });
      maxLength(line.unit, 30, { message: '30 caractères au maximum.' });
      maxLength(line.note, 200, { message: '200 caractères au maximum.' });
    });

    applyEach(part.steps, (step) => {
      required(step.description, { message: "Décrivez l'étape." });
      maxLength(step.description, 5000, { message: '5 000 caractères au maximum.' });
      min(step.durationMinutes, 1, { message: 'Au moins 1 minute.' });
    });
  });
});
