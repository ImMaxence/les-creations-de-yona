import { convertToParamMap } from '@angular/router';
import { DEFAULT_PAGE_SIZE, readFilters } from './recipes.resolver';

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
        page: '2',
        parPage: '24',
      }),
    );
    expect(filters).toEqual({
      search: 'tarte',
      category: 'desserts',
      ingredients: ['Œufs', 'Chocolat'],
      tag: 'vegetarien',
      maxMinutes: 30,
      difficulty: 'facile',
      page: 2,
      pageSize: 24,
    });
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
    expect(filters.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(filters.ingredients).toEqual([]);
  });
});
