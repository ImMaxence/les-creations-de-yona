import { THEMES, categoriesOf, categoryOfThemeQueryParams, themeLabel, themeOfSlug, themeSlug } from './themes';

describe('themes in the URL', () => {
  it('goes from the URL to the theme and back', () => {
    expect(themeOfSlug('sale')).toBe('SAVORY');
    expect(themeOfSlug('autre')).toBeNull();
    expect(themeSlug('SWEET')).toBe('sucre');
    expect(themeLabel('SAVORY')).toBe('Salé');
  });

  it('shows savory first, as a meal goes', () => {
    expect(THEMES.map((theme) => theme.label)).toEqual(['Salé', 'Sucré']);
  });
});

describe('categoriesOf', () => {
  const plats = { slug: 'plats', theme: 'SAVORY' as const, publishedThemes: [] };
  const desserts = { slug: 'desserts', theme: 'SWEET' as const, publishedThemes: [] };
  // Holds both, but has savory recipes only on the site
  const aperitifs = { slug: 'aperitifs', theme: undefined, publishedThemes: ['SAVORY' as const] };

  it('puts each category under its theme, and one holding both under those it has recipes for', () => {
    expect(categoriesOf([plats, desserts, aperitifs], 'SAVORY').map((category) => category.slug)).toEqual(['plats', 'aperitifs']);
    expect(categoriesOf([plats, desserts, aperitifs], 'SWEET').map((category) => category.slug)).toEqual(['desserts']);
  });

  it('opens only the recipes of the theme in a category holding both', () => {
    expect(categoryOfThemeQueryParams(plats, 'SAVORY')).toEqual({ categorie: 'plats' });
    expect(categoryOfThemeQueryParams(aperitifs, 'SAVORY')).toEqual({ categorie: 'aperitifs', theme: 'sale' });
  });
});
