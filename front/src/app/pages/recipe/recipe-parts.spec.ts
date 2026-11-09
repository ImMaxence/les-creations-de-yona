import { IngredientLine } from '../../core/api/generated/models/ingredient-line';
import { Part } from '../../core/api/generated/models/part';
import { describeMold, equivalent, hasParts, moldArea, shownIngredients, totalIngredients } from './recipe-parts';

function line(name: string, quantity?: number, unit?: string, note?: string): IngredientLine {
  return { name, quantity, unit, note };
}

function part(title: string | undefined, ingredients: IngredientLine[]): Part {
  return { title, ingredients, steps: [] };
}

describe('hasParts', () => {
  it('sees a single untitled part as no parts', () => {
    expect(hasParts([part(undefined, [])])).toBe(false);
    expect(hasParts([part('La pâte', [])])).toBe(true);
    expect(hasParts([part(undefined, []), part(undefined, [])])).toBe(true);
  });
});

describe('totalIngredients', () => {
  const parts = [
    part('La pâte', [line('Beurre', 100, 'g'), line('Farine', 200, 'g', 'tamisée'), line('Œufs', 2)]),
    part('La garniture', [line('beurre', 50, 'g'), line('Beurre', 1, 'c. à soupe'), line('Œufs', 1)]),
  ];

  it('adds up the quantities of the same unit, whatever the case of the name', () => {
    const butter = totalIngredients(parts, 1).find((ingredient) => ingredient.name === 'Beurre');
    expect(butter?.amount).toBe('150 g + 1 c. à soupe');
    expect(butter?.parts).toEqual(['La pâte', 'La garniture']);
  });

  it('adds up quantities without a unit', () => {
    expect(totalIngredients(parts, 1).find((ingredient) => ingredient.name === 'Œufs')?.amount).toBe('3');
  });

  it('keeps a note only for an ingredient listed once', () => {
    const total = totalIngredients(parts, 1);
    expect(total.find((ingredient) => ingredient.name === 'Farine')?.note).toBe('tamisée');
    expect(total.find((ingredient) => ingredient.name === 'Beurre')?.note).toBeNull();
  });

  it('keeps the order of first appearance', () => {
    expect(totalIngredients(parts, 1).map((ingredient) => ingredient.name)).toEqual(['Beurre', 'Farine', 'Œufs']);
  });

  it('scales and rounds to measurable quantities', () => {
    // 200 g × 7/6 = 233.3 g: rounded to 5 g
    expect(totalIngredients(parts, 7 / 6).find((ingredient) => ingredient.name === 'Farine')?.amount).toBe('235 g');
  });
});

describe('shownIngredients', () => {
  it('shows the quantity as written when not scaled', () => {
    expect(shownIngredients([line('Sucre', 33.3, 'g'), line('Sel')], 1)).toEqual([
      { name: 'Sucre', amount: '33,3 g', note: null, parts: [] },
      { name: 'Sel', amount: null, note: null, parts: [] },
    ]);
  });
});

describe('moldArea', () => {
  it('computes the area of each shape', () => {
    expect(moldArea({ shape: 'ROUND', lengthCm: 20 })).toBeCloseTo(314.16, 2);
    expect(moldArea({ shape: 'SQUARE', lengthCm: 22 })).toBe(484);
    expect(moldArea({ shape: 'RECTANGLE', lengthCm: 30, widthCm: 20 })).toBe(600);
  });

  it('gives a 24 cm round mold 1.44 times the quantities of a 20 cm one', () => {
    const ratio = moldArea({ shape: 'ROUND', lengthCm: 24 }) / moldArea({ shape: 'ROUND', lengthCm: 20 });
    expect(ratio).toBeCloseTo(1.44, 5);
  });
});

describe('equivalent in pieces', () => {
  const EGG = { grams: 50, singular: 'œuf', plural: 'œufs' };
  const eggs = (quantity: number, unit?: string): IngredientLine => ({ name: 'Œufs', quantity, unit, piece: EGG });

  it('counts a weight in pieces, to the nearest half', () => {
    expect(equivalent(400, EGG)).toBe('≈ 8 œufs');
    expect(equivalent(120, EGG)).toBe('≈ 2,5 œufs');
    expect(equivalent(75, EGG)).toBe('≈ 1,5 œuf');
  });

  it('never says zero', () => {
    expect(equivalent(4, EGG)).toBe('≈ 0,5 œuf');
  });

  it('follows the servings', () => {
    expect(shownIngredients([eggs(400, 'g')], 0.5)[0]?.equivalent).toBe('≈ 4 œufs');
  });

  it('understands kilos', () => {
    expect(shownIngredients([eggs(1, 'kg')], 1)[0]?.equivalent).toBe('≈ 20 œufs');
  });

  it('says nothing for a quantity that is not a weight', () => {
    expect(shownIngredients([eggs(3)], 1)[0]?.equivalent).toBeUndefined();
    expect(shownIngredients([eggs(2, 'c. à soupe')], 1)[0]?.equivalent).toBeUndefined();
  });

  it('says nothing for an ingredient bought by weight', () => {
    expect(shownIngredients([line('Farine', 400, 'g')], 1)[0]?.equivalent).toBeUndefined();
  });

  it('counts the total of the parts', () => {
    const total = totalIngredients([part('La pâte', [eggs(100, 'g')]), part('La crème', [eggs(300, 'g')])], 1);
    expect(total[0]?.equivalent).toBe('≈ 8 œufs');
  });

  it('says nothing when the total mixes a weight and something else', () => {
    const total = totalIngredients([part('La pâte', [eggs(100, 'g')]), part('La crème', [eggs(1, 'c. à soupe')])], 1);
    expect(total[0]?.amount).toBe('100 g + 1 c. à soupe');
    expect(total[0]?.equivalent).toBeUndefined();
  });
});

describe('describeMold', () => {
  it('describes each shape in French', () => {
    expect(describeMold({ shape: 'ROUND', lengthCm: 20 })).toBe('rond de 20 cm');
    expect(describeMold({ shape: 'SQUARE', lengthCm: 22.5 })).toBe('carré de 22,5 cm');
    expect(describeMold({ shape: 'RECTANGLE', lengthCm: 30, widthCm: 20 })).toBe('rectangulaire de 30 × 20 cm');
  });
});
