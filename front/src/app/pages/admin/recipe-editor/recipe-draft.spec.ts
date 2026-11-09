import { RecipeAiDraft } from '../../../core/api/generated/models/recipe-ai-draft';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';
import { fromAiDraft, hasContent, linkedPart, toDraft, toRecipeForm } from './recipe-draft';

const AI: RecipeAiDraft = {
  title: 'Crêpes',
  servings: 4,
  restMinutes: 60,
  categoryIds: [],
  tagIds: [7],
  equipment: ['Poêle', 'Fouet'],
  parts: [
    {
      ingredients: [
        { name: 'Farine', quantity: 250, unit: 'g' },
        { name: 'Œufs', quantity: 4 },
      ],
      steps: [{ description: 'Mélangez la farine et les œufs', ingredientPositions: [1, 0, 5] }],
    },
  ],
};

describe('fromAiDraft', () => {
  it('fills the content, keeps the publication and the categories when none was found', () => {
    const current = { ...toDraft(null), status: 'PUBLISHED' as const, categoryIds: [3], videoUrl: 'https://youtu.be/x' };

    const draft = fromAiDraft(current, AI);

    expect(draft.title).toBe('Crêpes');
    expect(draft.status).toBe('PUBLISHED');
    expect(draft.videoUrl).toBe('https://youtu.be/x');
    expect(draft.categoryIds).toEqual([3]);
    expect(draft.tagIds).toEqual([7]);
    expect(draft.equipment).toBe('Poêle\nFouet');
    expect(draft.prepMinutes).toBeNull();
    const [flour, eggs] = draft.parts[0]!.ingredients;
    expect(flour!.unit).toBe('g');
    expect(eggs!.unit).toBe('');
    // The step points at its lines, whatever their place; an unknown position is dropped
    expect(draft.parts[0]!.steps[0]!.ingredientKeys).toEqual([eggs!.key, flour!.key]);
  });

  it('sees an untouched new recipe as empty, and a typed title as content', () => {
    expect(hasContent(toDraft(null))).toBe(false);
    expect(hasContent({ ...toDraft(null), title: 'Tarte' })).toBe(true);
  });
});

describe('a recipe used as a part', () => {
  const DOUGH = { id: 12, title: 'Pâte sablée' };

  it('starts with the whole recipe, under its title, without content of its own', () => {
    expect(linkedPart(DOUGH)).toEqual({
      title: 'Pâte sablée',
      ingredients: [],
      steps: [],
      linkedRecipeId: 12,
      linkedRecipeTitle: 'Pâte sablée',
      linkedRatio: 1,
    });
  });

  it('is sent with its recipe and how many times', () => {
    const draft = { ...toDraft(null), parts: [{ ...linkedPart(DOUGH), linkedRatio: 0.5 }] };

    expect(toRecipeForm(draft).parts).toEqual([
      { title: 'Pâte sablée', ingredients: [], steps: [], linkedRecipeId: 12, linkedRatio: 0.5 },
    ]);
  });

  it('sends no ratio for a part of its own', () => {
    const part = toRecipeForm(toDraft(null)).parts[0]!;

    expect(part.linkedRecipeId).toBeUndefined();
    expect(part.linkedRatio).toBeUndefined();
  });

  it('comes back from a saved recipe', () => {
    const saved = {
      categories: [],
      tags: [],
      equipment: [],
      questions: [],
      parts: [{ title: 'Pâte', ingredients: [], steps: [], linkedRecipe: { ...DOUGH, slug: 'pate', categorySlug: 'bases', status: 'PUBLISHED', ratio: 2 } }],
    } as unknown as RecipeDetail;

    expect(toDraft(saved).parts[0]).toEqual({
      title: 'Pâte',
      ingredients: [],
      steps: [],
      linkedRecipeId: 12,
      linkedRecipeTitle: 'Pâte sablée',
      linkedRatio: 2,
    });
  });
});
