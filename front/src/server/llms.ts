import type { RequestHandler } from 'express';
import type { GlossaryTermResponse } from '../app/core/api/generated/models/glossary-term-response';
import type { MenuSummary } from '../app/core/api/generated/models/menu-summary';
import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import type { SiteContentResponse } from '../app/core/api/generated/models/site-content-response';
import { SITE_NAME, absoluteUrl, excerpt } from '../app/core/seo/page-seo';
import { paragraphs } from '../app/shared/format/paragraphs';
import { THEMES, Theme } from '../app/shared/format/themes';
import {
  ABOUT_PATH,
  GLOSSARY_PATH,
  INSTALL_PATH,
  MENUS_PATH,
  RECIPES_PATH,
  menuLink,
  recipeLink,
} from '../app/shared/routing/links';
import { apiOrigin, fetchGlossary, fetchMenus, fetchPublishedRecipes, fetchSiteContent } from './api';

const THEME_HEADINGS: Record<Theme, string> = { SAVORY: 'Recettes salées', SWEET: 'Recettes sucrées' };

export interface LlmsContent {
  content: SiteContentResponse;
  recipes: RecipeCard[];
  menus: MenuSummary[];
  glossary: GlossaryTermResponse[];
}

/**
 * The site described for AI assistants (https://llmstxt.org): what it is, who writes it, and every
 * published recipe, menu and page worth reading, in Markdown.
 */
export function llmsTxt({ content, recipes, menus, glossary }: LlmsContent): string {
  const lines = [
    `# ${SITE_NAME}`,
    '',
    '> Le blog de cuisine et de pâtisserie de Yona, en français : des recettes maison, simples et gourmandes, ' +
      'salées et sucrées, écrites et testées par Yona',
    '',
    // One line per paragraph: Markdown would join the lines of a paragraph anyway
    ...paragraphs(content.aboutText).flatMap((paragraph) => [paragraph.replace(/\s+/g, ' '), '']),
    'Chaque recette donne ses ingrédients et leurs quantités, son matériel, ses étapes, ses temps (préparation, ' +
      'repos, cuisson), sa difficulté, le nombre de personnes, souvent un conseil et des questions fréquentes. ' +
      'Chaque recette existe aussi en Markdown : ajouter « .md » à son adresse',
    '',
    'Les recettes, textes et photos appartiennent à leur autrice : les citer avec un lien vers la recette plutôt ' +
      'que les reproduire en entier',
    '',
  ];
  // Savory, then sweet, as the site shows them; every recipe has one since 1.10
  for (const theme of THEMES) {
    const ofTheme = recipes.filter((recipe) => (recipe.theme ?? 'SWEET') === theme.value);
    if (ofTheme.length) {
      lines.push(`## ${THEME_HEADINGS[theme.value]}`, '', ...ofTheme.map(recipeLine), '');
    }
  }
  if (menus.length) {
    lines.push(
      '## Menus',
      '',
      ...menus.map((menu) => link(menu.title, menuLink(menu).join('/'), menu.intro && excerpt(menu.intro, 200))),
      '',
    );
  }
  lines.push(
    '## Pages',
    '',
    link('Toutes les recettes', RECIPES_PATH, 'à filtrer par catégorie, ingrédient, temps ou difficulté'),
    ...(menus.length ? [link('Menus', MENUS_PATH, 'des menus composés par Yona pour chaque occasion')] : []),
    ...(glossary.length
      ? [link('Glossaire de pâtisserie', GLOSSARY_PATH, `${glossary.length} mots de la pâtisserie expliqués simplement`)]
      : []),
    link('À propos de Yona', ABOUT_PATH, "l'autrice des recettes"),
    '',
    '## Optional',
    '',
    link("Installer l'application", INSTALL_PATH, 'les recettes sur téléphone, lisibles hors connexion'),
    '',
  );
  return lines.join('\n');
}

/** "- [Tarte aux pommes](…): Tartes, Desserts". */
function recipeLine(recipe: RecipeCard): string {
  return link(recipe.title, recipeLink(recipe).join('/'), recipe.categories.map((category) => category.name).join(', '));
}

function link(title: string, path: string, notes?: string | null): string {
  return `- [${title.replace(/[[\]]/g, '')}](${absoluteUrl(path)})${notes ? `: ${notes.replace(/\s+/g, ' ').trim()}` : ''}`;
}

/** /llms.txt, built on each request from the API like the sitemap, cached one hour. */
export const llms: RequestHandler = async (req, res) => {
  const origin = apiOrigin(req);
  try {
    const [content, recipes, menus, glossary] = await Promise.all([
      fetchSiteContent(origin),
      fetchPublishedRecipes(origin),
      fetchMenus(origin),
      fetchGlossary(origin),
    ]);
    res
      .type('text/plain; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600')
      .send(llmsTxt({ content, recipes, menus, glossary }));
  } catch (error) {
    console.error('llms.txt unavailable', error);
    res
      .status(503)
      .set('Cache-Control', 'no-store')
      .set('Retry-After', '300')
      .type('text/plain')
      .send('Fichier temporairement indisponible');
  }
};
