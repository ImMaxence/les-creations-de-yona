import { applyEach, max, maxLength, min, required, schema, validate } from '@angular/forms/signals';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';
import { RecipeForm } from '../../../core/api/generated/models/recipe-form';
import { fromParisInput, toParisInput } from '../../../shared/format/paris-time';

export type MoldShapeChoice = 'NONE' | 'ROUND' | 'SQUARE' | 'RECTANGLE';

/** Editable copy of a recipe: every field exists, empty ones as "" or null. */
export interface RecipeDraft {
  title: string;
  intro: string;
  status: 'DRAFT' | 'PUBLISHED';
  featured: boolean;
  /** Drafts only: Paris time, as the datetime-local field shows it ("2026-10-31T10:00"); "" for none. */
  scheduledAt: string;
  /** The first one is the main category, in the recipe URL. */
  categoryIds: number[];
  /** Végétarien, sans gluten…: none required. */
  tagIds: number[];
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  /** Resting, rising…: counted in the total time. */
  restMinutes: number | null;
  /** 1 to 5, by half points. */
  difficulty: number | null;
  /** YouTube link as pasted by the admin. */
  videoUrl: string;
  /** "Le conseil de Yona", Markdown. */
  tip: string;
  /** Moule à tarte, fouet…: one item per line, as typed. */
  equipment: string;
  /** Mold the quantities are written for, so that visitors can adapt them to theirs. */
  moldShape: MoldShapeChoice;
  /** Diameter, side or length, in cm. */
  moldLengthCm: number | null;
  /** Rectangle only. */
  moldWidthCm: number | null;
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
  /** Names the line for the steps that use it, whatever its position or name. */
  key: string;
  name: string;
  quantity: number | null;
  unit: string;
  note: string;
}

export interface StepDraft {
  description: string;
  durationMinutes: number | null;
  /** Ingredients of its part the step needs (IngredientDraft.key), shown alone in the cooking mode. */
  ingredientKeys: string[];
}

export function emptyPart(): PartDraft {
  return { title: '', ingredients: [emptyIngredient()], steps: [emptyStep()] };
}

export function emptyIngredient(): IngredientDraft {
  return { key: newKey(), name: '', quantity: null, unit: '', note: '' };
}

export function emptyStep(): StepDraft {
  return { description: '', durationMinutes: null, ingredientKeys: [] };
}

/**
 * Keys of saved lines follow their place, so that the same recipe always gives the same draft
 * (the unsaved-changes check compares them); new lines get a random one.
 */
function newKey(): string {
  return `new-${Math.random().toString(36).slice(2, 10)}`;
}

export function toDraft(recipe: RecipeDetail | null | undefined): RecipeDraft {
  if (!recipe) {
    return {
      title: '',
      intro: '',
      status: 'DRAFT',
      featured: false,
      scheduledAt: '',
      categoryIds: [],
      tagIds: [],
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      restMinutes: null,
      difficulty: null,
      videoUrl: '',
      tip: '',
      equipment: '',
      moldShape: 'NONE',
      moldLengthCm: null,
      moldWidthCm: null,
      // A fixed key, like those of a saved recipe: an untouched new recipe has nothing to save
      parts: [{ ...emptyPart(), ingredients: [{ ...emptyIngredient(), key: '0-0' }] }],
    };
  }
  return {
    title: recipe.title,
    intro: recipe.intro ?? '',
    status: recipe.status,
    featured: recipe.featured,
    scheduledAt: recipe.scheduledAt ? toParisInput(recipe.scheduledAt) : '',
    categoryIds: recipe.categories.map((category) => category.id),
    tagIds: recipe.tags.map((tag) => tag.id),
    servings: recipe.servings ?? null,
    prepMinutes: recipe.prepMinutes ?? null,
    cookMinutes: recipe.cookMinutes ?? null,
    restMinutes: recipe.restMinutes ?? null,
    difficulty: recipe.difficulty ?? null,
    videoUrl: recipe.youtubeVideoId ? youtubeUrl(recipe.youtubeVideoId) : '',
    tip: recipe.tip ?? '',
    equipment: recipe.equipment.join('\n'),
    moldShape: recipe.mold?.shape ?? 'NONE',
    moldLengthCm: recipe.mold?.lengthCm ?? null,
    moldWidthCm: recipe.mold?.widthCm ?? null,
    parts: recipe.parts.map((part, p) => ({
      title: part.title ?? '',
      ingredients: part.ingredients.map((line, i) => ({
        key: `${p}-${i}`,
        name: line.name,
        quantity: line.quantity ?? null,
        unit: line.unit ?? '',
        note: line.note ?? '',
      })),
      steps: part.steps.map((step) => ({
        description: step.description,
        durationMinutes: step.durationMinutes ?? null,
        ingredientKeys: step.ingredientPositions.map((position) => `${p}-${position}`),
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
    scheduledAt: draft.status === 'DRAFT' ? (fromParisInput(draft.scheduledAt) ?? undefined) : undefined,
    categoryIds: draft.categoryIds,
    tagIds: draft.tagIds,
    servings: draft.servings ?? undefined,
    prepMinutes: draft.prepMinutes ?? undefined,
    cookMinutes: draft.cookMinutes ?? undefined,
    restMinutes: draft.restMinutes ?? undefined,
    difficulty: draft.difficulty ?? undefined,
    videoUrl: blankToUndefined(draft.videoUrl),
    tip: blankToUndefined(draft.tip),
    equipment: equipmentLines(draft.equipment),
    mold:
      draft.moldShape === 'NONE' || draft.moldLengthCm == null
        ? undefined
        : {
            shape: draft.moldShape,
            lengthCm: draft.moldLengthCm,
            widthCm: draft.moldShape === 'RECTANGLE' ? (draft.moldWidthCm ?? undefined) : undefined,
          },
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
        // An ingredient moved to another part or removed is no longer the step's
        ingredientPositions: step.ingredientKeys
          .map((key) => part.ingredients.findIndex((line) => line.key === key))
          .filter((position) => position >= 0)
          .sort((a, b) => a - b),
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

const MAX_EQUIPMENT = 30;

/** One item per line, blank lines left out. */
function equipmentLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Same comparison as the API: "Crème" and "creme" are the same ingredient. */
function ingredientKey(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').trim();
}

/** Same rules as the API (RecipeForm and RecipeService on the backend), checked before sending. */
export const recipeSchema = schema<RecipeDraft>((recipe) => {
  required(recipe.title, { message: 'Donnez un titre à la recette' });
  maxLength(recipe.title, 150, { message: '150 caractères au maximum' });
  maxLength(recipe.intro, 1000, { message: '1 000 caractères au maximum' });
  maxLength(recipe.tip, 2000, { message: '2 000 caractères au maximum' });
  validate(recipe.equipment, ({ value }) => {
    const lines = equipmentLines(value());
    if (lines.length > MAX_EQUIPMENT) {
      return { kind: 'tooMuchEquipment', message: `${MAX_EQUIPMENT} lignes au maximum` };
    }
    return lines.some((line) => line.length > 100)
      ? { kind: 'equipmentTooLong', message: '100 caractères au maximum par ligne' }
      : undefined;
  });
  validate(recipe.categoryIds, ({ value }) =>
    value().length === 0 ? { kind: 'noCategory', message: 'Choisissez au moins une catégorie' } : undefined,
  );
  min(recipe.servings, 1, { message: 'Au moins 1 portion' });
  min(recipe.prepMinutes, 0, { message: 'Durée positive' });
  min(recipe.cookMinutes, 0, { message: 'Durée positive' });
  min(recipe.restMinutes, 0, { message: 'Durée positive' });
  validate(recipe.videoUrl, ({ value }) =>
    value().trim() && !YOUTUBE_URL.test(value().trim())
      ? {
          kind: 'videoUrl',
          message: "Collez le lien d'une vidéo YouTube (youtube.com/watch?v=…, youtu.be/… ou youtube.com/shorts/…)",
        }
      : undefined,
  );
  validate(recipe.featured, ({ value, valueOf }) =>
    value() && valueOf(recipe.status) !== 'PUBLISHED'
      ? { kind: 'featuredDraft', message: 'Seule une recette publiée peut être à la une' }
      : undefined,
  );
  validate(recipe.scheduledAt, ({ value, valueOf }) => {
    if (valueOf(recipe.status) !== 'DRAFT' || !value()) {
      return undefined;
    }
    const instant = fromParisInput(value());
    return !instant || new Date(instant).getTime() <= Date.now()
      ? { kind: 'scheduledPast', message: 'Choisissez une date et une heure à venir' }
      : undefined;
  });

  // Mold: its size in cm, a width for a rectangle only
  validate(recipe.moldLengthCm, ({ value, valueOf }) =>
    valueOf(recipe.moldShape) !== 'NONE' && value() == null
      ? { kind: 'moldLength', message: 'Indiquez la taille du moule' }
      : undefined,
  );
  validate(recipe.moldWidthCm, ({ value, valueOf }) =>
    valueOf(recipe.moldShape) === 'RECTANGLE' && value() == null
      ? { kind: 'moldWidth', message: 'Indiquez la largeur du moule' }
      : undefined,
  );
  min(recipe.moldLengthCm, 1, { message: 'Au moins 1 cm' });
  max(recipe.moldLengthCm, 200, { message: '200 cm au plus' });
  min(recipe.moldWidthCm, 1, { message: 'Au moins 1 cm' });
  max(recipe.moldWidthCm, 200, { message: '200 cm au plus' });

  // At least one ingredient and one step in the whole recipe, whatever the part
  validate(recipe.parts, ({ value }) => {
    if (value().every((part) => part.ingredients.length === 0)) {
      return { kind: 'noIngredient', message: 'Ajoutez au moins un ingrédient' };
    }
    if (value().every((part) => part.steps.length === 0)) {
      return { kind: 'noStep', message: 'Ajoutez au moins une étape' };
    }
    return undefined;
  });
  applyEach(recipe.parts, (part) => {
    validate(part.title, ({ value, valueOf }) =>
      valueOf(recipe.parts).length > 1 && !value().trim()
        ? { kind: 'partTitle', message: 'Donnez un titre à cette partie (la pâte, la garniture…)' }
        : undefined,
    );
    maxLength(part.title, 100, { message: '100 caractères au maximum' });
    validate(part, ({ value }) =>
      value().ingredients.length === 0 && value().steps.length === 0
        ? { kind: 'emptyPart', message: 'Ajoutez un ingrédient ou une étape à cette partie' }
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
        ? { kind: 'duplicateIngredient', message: `« ${repeated.name.trim()} » apparaît deux fois dans cette partie` }
        : undefined;
    });
    applyEach(part.ingredients, (line) => {
      required(line.name, { message: "Nom de l'ingrédient obligatoire" });
      maxLength(line.name, 100, { message: '100 caractères au maximum' });
      min(line.quantity, 0.01, { message: 'Quantité positive' });
      maxLength(line.unit, 30, { message: '30 caractères au maximum' });
      maxLength(line.note, 200, { message: '200 caractères au maximum' });
    });

    applyEach(part.steps, (step) => {
      required(step.description, { message: "Décrivez l'étape" });
      maxLength(step.description, 5000, { message: '5 000 caractères au maximum' });
      min(step.durationMinutes, 1, { message: 'Au moins 1 minute' });
    });
  });
});
