import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import type { RecipeDetail } from '../app/core/api/generated/models/recipe-detail';
import type { SiteContentResponse } from '../app/core/api/generated/models/site-content-response';
import { llmsFullTxt, llmsTxt } from './llms';

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
    expect(text).toContain("- [Conditions d'utilisation](https://les-creations-de-yona.fr/conditions-d-utilisation)");
  });

  it('leaves out the menus and the glossary when there are none', () => {
    const text = llmsTxt({ content: CONTENT, recipes: [], menus: [], glossary: [] });

    expect(text).not.toContain('## Menus');
    expect(text).not.toContain('Glossaire');
    expect(text).not.toContain('## Recettes');
  });

  it('points to the Markdown versions and to the whole text', () => {
    const text = llmsTxt({ content: CONTENT, recipes: [], menus: [], glossary: [] });

    expect(text).toContain('« Accept: text/markdown »');
    expect(text).toContain('- [Tout le texte du site](https://les-creations-de-yona.fr/llms-full.txt)');
  });
});

describe('llmsFullTxt', () => {
  const recipe = {
    title: 'Tarte aux pommes',
    slug: 'tarte-aux-pommes',
    categories: [{ id: 1, name: 'Tartes', slug: 'tartes' }],
    tags: [],
    equipment: [],
    questions: [],
    parts: [{ ingredients: [{ name: 'Pommes', quantity: 4 }], steps: [{ description: 'Épluchez les pommes' }] }],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  } as unknown as RecipeDetail;

  it('gives Yona, then every recipe in full, one page after the other', () => {
    const text = llmsFullTxt({
      content: { ...CONTENT, aboutTitle: 'Bienvenue' },
      socialLinks: [],
      recipes: [recipe],
      menus: [],
      glossary: [],
    });

    expect(text.startsWith('# Les créations de Yona : tout le texte\n\n> Le blog de cuisine')).toBe(true);
    expect(text).toContain('Ci-dessous : Yona, puis 1 recette en entier');
    expect(text).toContain('\n---\n\n# À propos de Yona\n\n## Bienvenue\n');
    expect(text).toContain('\n---\n\n# Tarte aux pommes\n');
    expect(text).toContain('1. Épluchez les pommes');
    expect(text).not.toContain('Glossaire');
  });
});
