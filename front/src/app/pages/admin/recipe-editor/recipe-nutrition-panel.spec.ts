import { describe, expect, it } from 'vitest';
import { PartDraft, emptyIngredient, linkedPart } from './recipe-draft';
import { estimateForm } from './recipe-nutrition-panel';

function part(lines: { name: string; quantity: number | null; unit?: string }[]): PartDraft {
  return {
    title: '',
    ingredients: lines.map((line) => ({ ...emptyIngredient(), name: line.name, quantity: line.quantity, unit: line.unit ?? '' })),
    steps: [],
    linkedRecipeId: null,
    linkedRecipeTitle: '',
    linkedRatio: null,
  };
}

describe('the estimate of the editor', () => {
  it('sends the lines as the API accepts them', () => {
    const form = estimateForm(
      [
        part([
          { name: ' Farine ', quantity: 250, unit: 'g' },
          { name: '', quantity: 3 },
          { name: 'Sucre', quantity: 0, unit: 'g' },
          { name: 'Beurre', quantity: 12.345, unit: ' g ' },
        ]),
      ],
      4,
    );

    expect(form).toEqual({
      servings: 4,
      cookedGrams: undefined,
      nutriScoreKind: 'GENERAL',
      parts: [
        {
          linkedRecipeId: undefined,
          linkedRatio: undefined,
          ingredients: [
            { name: 'Farine', quantity: 250, unit: 'g' },
            { name: 'Sucre', quantity: undefined, unit: 'g' },
            { name: 'Beurre', quantity: 12.35, unit: 'g' },
          ],
        },
      ],
    });
  });

  it('sends a recipe used as a part by its id, and no servings it would refuse', () => {
    const form = estimateForm([{ ...linkedPart({ id: 12, title: 'Pâte sablée' }), linkedRatio: 0.5 }], 0);

    expect(form).toEqual({
      servings: undefined,
      cookedGrams: undefined,
      nutriScoreKind: 'GENERAL',
      parts: [{ linkedRecipeId: 12, linkedRatio: 0.5, ingredients: [] }],
    });
  });

  it('sends the weight once cooked when it is one, and the grid of the Nutri-Score', () => {
    const lines = [part([{ name: 'Citron', quantity: 3 }])];

    expect(estimateForm(lines, 4, 850, 'BEVERAGE')).toMatchObject({ cookedGrams: 850, nutriScoreKind: 'BEVERAGE' });
    expect(estimateForm(lines, 4, 0)?.cookedGrams).toBeUndefined();
    expect(estimateForm(lines, 4, 12.5)?.cookedGrams).toBeUndefined();
    expect(estimateForm(lines, 4, 200_000)?.cookedGrams).toBeUndefined();
  });

  it('asks nothing while no ingredient is typed', () => {
    expect(estimateForm([part([{ name: ' ', quantity: 200 }])], 4)).toBeNull();
  });
});
