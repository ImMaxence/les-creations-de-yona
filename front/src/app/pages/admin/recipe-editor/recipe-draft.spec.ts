import { RecipeAiDraft } from '../../../core/api/generated/models/recipe-ai-draft';
import { fromAiDraft, hasContent, toDraft } from './recipe-draft';

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
