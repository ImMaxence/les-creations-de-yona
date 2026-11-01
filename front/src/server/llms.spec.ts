import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import type { SiteContentResponse } from '../app/core/api/generated/models/site-content-response';
import { llmsTxt } from './llms';

function card(title: string, slug: string, theme: RecipeCard['theme'], category: string): RecipeCard {
  return {
    title,
    slug,
    theme,
    categories: [{ id: 1, name: category, slug: category.toLowerCase() }],
    createdAt: '2026-10-01T10:00:00Z',
  } as RecipeCard;
}

const CONTENT = {
  aboutText: 'Je suis Yona.\n\nJe prépare\nmon CAP Pâtisserie !',
} as SiteContentResponse;

describe('llmsTxt', () => {
  it('describes the site and lists the recipes, savory then sweet, with their address', () => {
    const text = llmsTxt({
      content: CONTENT,
      recipes: [card('Tarte', 'tarte', 'SWEET', 'Desserts'), card('Gratin', 'gratin', 'SAVORY', 'Plats')],
      menus: [],
      glossary: [],
    });

    expect(text.startsWith('# Les créations de Yona\n\n> Le blog de cuisine et de pâtisserie de Yona')).toBe(true);
    expect(text).toContain('\nJe suis Yona.\n\nJe prépare mon CAP Pâtisserie !\n');
    expect(text).toContain(
      '## Recettes salées\n\n- [Gratin](https://les-creations-de-yona.fr/recettes/plats/gratin): Plats\n\n' +
        '## Recettes sucrées\n\n- [Tarte](https://les-creations-de-yona.fr/recettes/desserts/tarte): Desserts\n',
    );
    expect(text).toContain('- [À propos de Yona](https://les-creations-de-yona.fr/a-propos)');
  });

  it('leaves out the menus and the glossary when there are none', () => {
    const text = llmsTxt({ content: CONTENT, recipes: [], menus: [], glossary: [] });

    expect(text).not.toContain('## Menus');
    expect(text).not.toContain('Glossaire');
    expect(text).not.toContain('## Recettes');
  });
});
