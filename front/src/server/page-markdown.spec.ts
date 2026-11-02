import type { CategoryResponse } from '../app/core/api/generated/models/category-response';
import type { MenuDetail } from '../app/core/api/generated/models/menu-detail';
import type { MenuSummary } from '../app/core/api/generated/models/menu-summary';
import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import type { SiteContentResponse } from '../app/core/api/generated/models/site-content-response';
import { aboutMarkdown, glossaryMarkdown, homeMarkdown, menuMarkdown, menusMarkdown, recipesMarkdown } from './page-markdown';

function card(title: string, slug: string, theme: RecipeCard['theme'], category: string): RecipeCard {
  return {
    title,
    slug,
    theme,
    categories: [{ id: 1, name: category, slug: category.toLowerCase() }],
    createdAt: '2026-10-01T10:00:00Z',
  } as RecipeCard;
}

const TART = card('Tarte', 'tarte', 'SWEET', 'Desserts');
const GRATIN = card('Gratin', 'gratin', 'SAVORY', 'Plats');

const CONTENT = {
  aboutTitle: 'Bienvenue dans ma cuisine',
  aboutText: 'Je suis Yona.\n\nJe prépare\nmon CAP Pâtisserie !',
  latestTitle: 'Dernières recettes',
  menusTitle: 'Nos menus',
} as SiteContentResponse;

const MENU = { title: 'Menu de Noël', slug: 'noel', intro: 'Un repas de fête', recipeCount: 2 } as MenuSummary;

describe('homeMarkdown', () => {
  it('gives the featured recipe, the latest of each theme, the menus and Yona, as the home page', () => {
    const text = homeMarkdown({
      content: CONTENT,
      featured: TART,
      latest: [{ theme: 'SAVORY', recipes: [GRATIN] }],
      menus: [MENU],
    });

    expect(text.startsWith('# Les créations de Yona\n\n> Recettes maison, simples et gourmandes')).toBe(true);
    expect(text).toContain('## À la une\n\n- [Tarte](https://les-creations-de-yona.fr/recettes/desserts/tarte): Desserts\n');
    expect(text).toContain(
      '## Dernières recettes\n\n### Recettes salées\n\n- [Gratin](https://les-creations-de-yona.fr/recettes/plats/gratin): Plats\n',
    );
    expect(text).toContain('## Nos menus\n\n- [Menu de Noël](https://les-creations-de-yona.fr/menus/noel): 2 recettes · Un repas de fête\n');
    expect(text).toContain('## Bienvenue dans ma cuisine\n\nJe suis Yona.\n\nJe prépare mon CAP Pâtisserie !\n');
  });

  it('leaves out what the site does not have yet', () => {
    const text = homeMarkdown({ content: CONTENT, featured: null, latest: [], menus: [] });

    expect(text).not.toContain('## À la une');
    expect(text).not.toContain('## Dernières recettes');
    expect(text).not.toContain('## Nos menus');
  });
});

describe('recipesMarkdown', () => {
  const desserts = { name: 'Desserts', slug: 'desserts', publishedThemes: ['SWEET'] } as CategoryResponse;
  const empty = { name: 'Soupes', slug: 'soupes', publishedThemes: [] as string[] } as CategoryResponse;

  it('lists every recipe, savory then sweet, and the categories holding some', () => {
    const text = recipesMarkdown([TART, GRATIN], [desserts, empty]);

    expect(text.startsWith('# Toutes les recettes\n\n> Toutes les recettes maison de Yona')).toBe(true);
    expect(text).toContain('2 recettes, les plus récentes en premier');
    expect(text.indexOf('## Recettes salées')).toBeLessThan(text.indexOf('## Recettes sucrées'));
    expect(text).toContain('## Catégories\n\n- [Desserts](https://les-creations-de-yona.fr/recettes?categorie=desserts)\n');
    expect(text).not.toContain('Soupes');
  });

  it('gives the recipes of a category under its name', () => {
    const text = recipesMarkdown([TART], [desserts], desserts);

    expect(text.startsWith('# Desserts\n\n> Toutes les recettes de la catégorie desserts')).toBe(true);
    expect(text).toContain('1 recette, les plus récentes en premier');
    expect(text).toContain('- [Tarte](https://les-creations-de-yona.fr/recettes/desserts/tarte): Desserts\n');
    expect(text).not.toContain('## Catégories');
  });
});

describe('menus', () => {
  it('lists the menus with their size and introduction', () => {
    expect(menusMarkdown([MENU])).toContain('- [Menu de Noël](https://les-creations-de-yona.fr/menus/noel): 2 recettes · Un repas de fête');
  });

  it('gives a menu with its recipes', () => {
    const menu = { title: 'Menu de Noël', slug: 'noel', intro: 'Un repas\nde fête', recipes: [GRATIN, TART] } as MenuDetail;

    expect(menuMarkdown(menu)).toBe(
      [
        '# Menu de Noël',
        '',
        '> Un repas',
        '> de fête',
        '',
        'Un menu composé par Yona sur Les créations de Yona : https://les-creations-de-yona.fr/menus/noel',
        '',
        '## Les recettes',
        '',
        '- [Gratin](https://les-creations-de-yona.fr/recettes/plats/gratin): Plats',
        '- [Tarte](https://les-creations-de-yona.fr/recettes/desserts/tarte): Desserts',
        '',
        '- [Tous les menus](https://les-creations-de-yona.fr/menus)',
        '',
      ].join('\n'),
    );
  });
});

describe('glossaryMarkdown', () => {
  it('gives each word under its own heading', () => {
    const text = glossaryMarkdown([{ id: 1, name: 'Abaisser', slug: 'abaisser', definition: 'Étaler une pâte ', forms: [] }]);

    expect(text).toContain('# Glossaire de pâtisserie\n\n> Émulsionner, chemiser');
    expect(text).toContain('## Abaisser\n\nÉtaler une pâte\n');
  });
});

describe('aboutMarkdown', () => {
  it('gives the text of "À propos" and the networks of Yona', () => {
    const text = aboutMarkdown(CONTENT, [{ platform: 'INSTAGRAM', url: 'https://www.instagram.com/yona' }]);

    expect(text.startsWith('# À propos de Yona\n\n## Bienvenue dans ma cuisine\n\nJe suis Yona.\n')).toBe(true);
    expect(text).toContain('## Retrouver Yona\n\n- [Instagram](https://www.instagram.com/yona)\n');
  });

  it('leaves out the networks when there are none', () => {
    expect(aboutMarkdown(CONTENT, [])).not.toContain('Retrouver Yona');
  });
});
