import { applyEach, maxLength, min, required, schema, validate } from '@angular/forms/signals';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';
import { RecipeForm } from '../../../core/api/generated/models/recipe-form';

/** Editable copy of a recipe: every field exists, empty ones as "" or null. */
export interface RecipeDraft {
  title: string;
  intro: string;
  status: 'DRAFT' | 'PUBLISHED';
  featured: boolean;
  categoryId: number | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  /** 1 to 5, by half points. */
  difficulty: number | null;
  /** YouTube link as pasted by the admin. */
  videoUrl: string;
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
      categoryId: null,
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      difficulty: null,
      videoUrl: '',
      ingredients: [emptyIngredient()],
      steps: [emptyStep()],
    };
  }
  return {
    title: recipe.title,
    intro: recipe.intro ?? '',
    status: recipe.status,
    featured: recipe.featured,
    categoryId: recipe.category.id,
    servings: recipe.servings ?? null,
    prepMinutes: recipe.prepMinutes ?? null,
    cookMinutes: recipe.cookMinutes ?? null,
    difficulty: recipe.difficulty ?? null,
    videoUrl: recipe.youtubeVideoId ? youtubeUrl(recipe.youtubeVideoId) : '',
    ingredients: recipe.ingredients.map((line) => ({
      name: line.name,
      quantity: line.quantity ?? null,
      unit: line.unit ?? '',
      note: line.note ?? '',
    })),
    steps: recipe.steps.map((step) => ({
      description: step.description,
      durationMinutes: step.durationMinutes ?? null,
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
    categoryId: draft.categoryId!,
    servings: draft.servings ?? undefined,
    prepMinutes: draft.prepMinutes ?? undefined,
    cookMinutes: draft.cookMinutes ?? undefined,
    difficulty: draft.difficulty ?? undefined,
    videoUrl: blankToUndefined(draft.videoUrl),
    ingredients: draft.ingredients.map((line) => ({
      name: line.name.trim(),
      quantity: line.quantity ?? undefined,
      unit: blankToUndefined(line.unit),
      note: blankToUndefined(line.note),
    })),
    steps: draft.steps.map((step) => ({
      description: step.description.trim(),
      durationMinutes: step.durationMinutes ?? undefined,
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

/** Same rules as the API (RecipeForm on the backend), checked before sending. */
export const recipeSchema = schema<RecipeDraft>((recipe) => {
  required(recipe.title, { message: 'Donnez un titre à la recette.' });
  maxLength(recipe.title, 150, { message: '150 caractères au maximum.' });
  maxLength(recipe.intro, 1000, { message: '1 000 caractères au maximum.' });
  required(recipe.categoryId, { message: 'Choisissez une catégorie.' });
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

  validate(recipe.ingredients, ({ value }) =>
    value().length === 0 ? { kind: 'noIngredient', message: 'Ajoutez au moins un ingrédient.' } : undefined,
  );
  applyEach(recipe.ingredients, (line) => {
    required(line.name, { message: "Nom de l'ingrédient obligatoire." });
    maxLength(line.name, 100, { message: '100 caractères au maximum.' });
    min(line.quantity, 0.01, { message: 'Quantité positive.' });
    maxLength(line.unit, 30, { message: '30 caractères au maximum.' });
    maxLength(line.note, 200, { message: '200 caractères au maximum.' });
  });

  validate(recipe.steps, ({ value }) =>
    value().length === 0 ? { kind: 'noStep', message: 'Ajoutez au moins une étape.' } : undefined,
  );
  applyEach(recipe.steps, (step) => {
    required(step.description, { message: "Décrivez l'étape." });
    maxLength(step.description, 5000, { message: '5 000 caractères au maximum.' });
    min(step.durationMinutes, 1, { message: 'Au moins 1 minute.' });
  });
});
