import { pathOf, skeletonOfPage } from './slow-navigation';

describe('pathOf', () => {
  it('keeps the path alone', () => {
    expect(pathOf('/recettes?categorie=tartes#haut')).toBe('/recettes');
    expect(pathOf('/mon-cap/')).toBe('/mon-cap');
    expect(pathOf('/?q=1')).toBe('/');
  });
});

describe('skeletonOfPage', () => {
  it('draws the shape of the page coming', () => {
    expect(skeletonOfPage('/recettes/tartes/tarte-au-citron', '/')).toBe('recipe');
    expect(skeletonOfPage('/recettes?categorie=tartes', '/')).toBe('list');
    expect(skeletonOfPage('/', '/recettes')).toBe('list');
    expect(skeletonOfPage('/menus', '/')).toBe('list');
    expect(skeletonOfPage('/mon-cap/mon-premier-examen-blanc', '/mon-cap')).toBe('article');
    expect(skeletonOfPage('/mentions-legales', '/')).toBe('article');
  });

  it('leaves the same page and the back-office as they are', () => {
    expect(skeletonOfPage('/recettes?page=2', '/recettes?categorie=tartes')).toBeNull();
    expect(skeletonOfPage('/admin/recettes', '/')).toBeNull();
    expect(skeletonOfPage('/admin', '/admin/recettes')).toBeNull();
  });
});
