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

    expect(form).toEqual({ servings: undefined, parts: [{ linkedRecipeId: 12, linkedRatio: 0.5, ingredients: [] }] });
  });

  it('asks nothing while no ingredient is typed', () => {
    expect(estimateForm([part([{ name: ' ', quantity: 200 }])], 4)).toBeNull();
  });
});
