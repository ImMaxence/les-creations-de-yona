import { searchTarget, servingsIn } from './search-target';

describe('servingsIn', () => {
  it('reads a number of people, as typed by visitors', () => {
    expect(servingsIn('recette 8 personnes')).toBe(8);
    expect(servingsIn('Tarte pour 6 Pers.')).toBe(6);
    expect(servingsIn('brioche 10 parts')).toBe(10);
    expect(servingsIn('gâteau 12 gourmands')).toBe(12);
  });

  it('leaves alone a number that is not one', () => {
    expect(servingsIn('3 chocolats')).toBeNull();
    expect(servingsIn('tarte 8 personnalisée')).toBeNull();
    expect(servingsIn('0 personne')).toBeNull();
    expect(servingsIn('')).toBeNull();
  });
});

describe('searchTarget', () => {
  it('opens a recipe for the servings asked, and filters the list on a category or an ingredient', () => {
    expect(searchTarget({ kind: 'recipe', label: 'Tarte', slug: 'tarte', categorySlug: 'tartes' }, 8)).toEqual({
      commands: ['/recettes', 'tartes', 'tarte'],
      queryParams: { portions: 8 },
    });
    expect(searchTarget({ kind: 'category', label: 'Petit-déjeuner', slug: 'petit-dejeuner' }, null)).toEqual({
      commands: ['/recettes'],
      queryParams: { categorie: 'petit-dejeuner' },
    });
    expect(searchTarget({ kind: 'ingredient', label: 'Chocolat' }, null).queryParams).toEqual({ ingredient: 'Chocolat' });
    expect(searchTarget({ kind: 'menu', label: 'Noël', slug: 'noel' }, 8).commands).toEqual(['/menus', 'noel']);
  });
});
