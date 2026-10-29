import { minutesIn, searchTarget, servingsIn, servingsMatch, withServings } from './search-target';

describe('minutesIn', () => {
  it('reads a time, as the API does', () => {
    expect(minutesIn('tarte en 30 min')).toBe(30);
    expect(minutesIn('dessert moins de 45 minutes')).toBe(45);
    expect(minutesIn('brioche 1h30')).toBe(90);
    expect(minutesIn('pain 2 heures')).toBe(120);
  });

  it('leaves alone what is no time', () => {
    expect(minutesIn('gâteau 8')).toBeNull();
    expect(minutesIn('2 hamburgers')).toBeNull();
    expect(servingsIn('brioche 1h30')).toBeNull();
    expect(servingsIn('tarte en 30 min')).toBeNull();
  });
});

describe('servingsIn', () => {
  it('reads a number of people, as typed by visitors', () => {
    expect(servingsIn('recette 8 personnes')).toBe(8);
    expect(servingsIn('Tarte pour 6 Pers.')).toBe(6);
    expect(servingsIn('brioche 10 parts')).toBe(10);
    expect(servingsIn('gâteau 12 gourmands')).toBe(12);
  });

  it('reads a number alone as a number of people', () => {
    expect(servingsIn('gâteau 8')).toBe(8);
    expect(servingsIn('gâteau au yaourt pour 4')).toBe(4);
  });

  it('leaves alone a number that is not one', () => {
    expect(servingsIn('3 chocolats')).toBeNull();
    expect(servingsIn('tarte 8 personnalisée')).toBeNull();
    expect(servingsIn('0 personne')).toBeNull();
    expect(servingsIn('gâteau 2026')).toBeNull();
    expect(servingsIn('')).toBeNull();
  });
});

describe('withServings', () => {
  it('changes the number of people in the search itself', () => {
    expect(withServings('gâteau 8 personnes', 10)).toBe('gâteau 10 personnes');
    expect(withServings('Gâteau 8', 7)).toBe('Gâteau 7');
    expect(withServings('tarte', 4)).toBe('tarte');
  });

  it('says where the number is', () => {
    expect(servingsMatch('cake salé 6 pers.')).toEqual({ servings: 6, start: 10, end: 11 });
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

  it('filters the list on a theme', () => {
    expect(searchTarget({ kind: 'theme', label: 'Recettes salées', theme: 'SAVORY' }, 6)).toEqual({
      commands: ['/recettes'],
      queryParams: { theme: 'sale', portions: 6 },
    });
  });
});
