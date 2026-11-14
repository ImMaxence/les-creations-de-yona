import { convertToParamMap } from '@angular/router';
import { readFilters, recipesApiQuery } from './recipes.resolver';

describe('readFilters', () => {
  it('reads every filter from the URL', () => {
    const filters = readFilters(
      convertToParamMap({
        q: ' tarte ',
        categorie: 'desserts',
        ingredient: ['Œufs', 'Chocolat'],
        tag: 'vegetarien',
        temps: '30',
        difficulte: 'facile',
        theme: 'sale',
        nutrition: 'proteines',
        page: '2',
      }),
    );
    expect(filters).toEqual({
      search: 'tarte',
      category: 'desserts',
      ingredients: ['Œufs', 'Chocolat'],
      tag: 'vegetarien',
      maxMinutes: 30,
      difficulty: 'facile',
      theme: 'SAVORY',
      nutrition: 'proteines',
      page: 2,
    });
    // An unknown one is left out
    expect(readFilters(convertToParamMap({ nutrition: 'sans-sucre' })).nutrition).toBeNull();
    expect(recipesApiQuery({ ...filters, nutrition: 'leger' }).nutrition).toBe('LIGHT');
  });

  it('drops blank and repeated ingredients, case ignored, and keeps 5 at most', () => {
    const filters = readFilters(
      convertToParamMap({ ingredient: ['Œufs', ' ', 'œufs', 'Lait', 'Sucre', 'Farine', 'Beurre', 'Sel'] }),
    );
    expect(filters.ingredients).toEqual(['Œufs', 'Lait', 'Sucre', 'Farine', 'Beurre']);
  });

  it('falls back to the defaults for invalid values', () => {
    const filters = readFilters(convertToParamMap({ temps: '45', difficulte: 'extreme', page: '-1', parPage: '13' }));
    expect(filters.maxMinutes).toBeNull();
    expect(filters.difficulty).toBeNull();
    expect(filters.page).toBe(1);
    expect(filters.ingredients).toEqual([]);
  });
});
