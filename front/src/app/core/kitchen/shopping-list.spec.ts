import { TestBed } from '@angular/core/testing';
import { ShoppingList, ShoppingRecipe, linesFor, shownServings } from './shopping-list';

const CAKE: ShoppingRecipe = {
  slug: 'gateau-yaourt',
  title: 'Gâteau au yaourt',
  categorySlug: 'gateaux',
  servings: 6,
  lines: [
    { name: 'Beurre', quantity: 90, unit: 'g' },
    { name: 'Œufs', quantity: 3, unit: null },
    { name: 'Sel', quantity: null, unit: null },
  ],
};

describe('linesFor', () => {
  it('keeps the quantities added, until other servings are chosen on the list', () => {
    expect(linesFor(CAKE)).toBe(CAKE.lines);
    expect(shownServings(CAKE)).toBe(6);
  });

  it('follows the servings chosen on the list, rounded to measurable values', () => {
    const forFour = { ...CAKE, chosenServings: 4 };
    expect(shownServings(forFour)).toBe(4);
    expect(linesFor(forFour).map((line) => line.quantity)).toEqual([60, 2, null]);
  });
});

describe('ShoppingList', () => {
  beforeEach(() => localStorage.clear());

  it('changes the servings of a recipe on the list, between 1 and 50', () => {
    const list = TestBed.inject(ShoppingList);
    list.add(CAKE);

    list.setServings(CAKE.slug, 12);
    expect(linesFor(list.recipes()[0]!)[0]!.quantity).toBe(180);
    list.setServings(CAKE.slug, 0);
    expect(shownServings(list.recipes()[0]!)).toBe(1);

    // Added again from its page: the servings chosen there win
    list.add(CAKE);
    expect(shownServings(list.recipes()[0]!)).toBe(6);
  });
});
