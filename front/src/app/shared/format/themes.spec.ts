import { themeLabel, themeOfSlug, themeSlug } from './themes';

describe('themes in the URL', () => {
  it('goes from the URL to the theme and back', () => {
    expect(themeOfSlug('sale')).toBe('SAVORY');
    expect(themeOfSlug('autre')).toBeNull();
    expect(themeSlug('SWEET')).toBe('sucre');
    expect(themeLabel('SAVORY')).toBe('Salé');
  });
});
