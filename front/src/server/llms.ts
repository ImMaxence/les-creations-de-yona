import type { RequestHandler } from 'express';
import type { CapArticle } from '../app/core/api/generated/models/cap-article';
import type { CapArticleCard } from '../app/core/api/generated/models/cap-article-card';
import type { GlossaryTermResponse } from '../app/core/api/generated/models/glossary-term-response';
import type { MenuDetail } from '../app/core/api/generated/models/menu-detail';
import type { MenuSummary } from '../app/core/api/generated/models/menu-summary';
import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import type { RecipeDetail } from '../app/core/api/generated/models/recipe-detail';
import type { SiteContentResponse } from '../app/core/api/generated/models/site-content-response';
import type { SocialLinkResponse } from '../app/core/api/generated/models/social-link-response';
import { SITE_NAME, absoluteUrl, excerpt } from '../app/core/seo/page-seo';
import { THEMES } from '../app/shared/format/themes';
import {
  ABOUT_PATH,
  CAP_PATH,
  GLOSSARY_PATH,
  INSTALL_PATH,
  MENUS_PATH,
  RECIPES_PATH,
  TERMS_OF_USE_PATH,
  capArticleLink,
  menuLink,
} from '../app/shared/routing/links';
import {
  apiOrigin,
  fetchCapArticle,
  fetchCapEntries,
  fetchGlossary,
  fetchMenu,
  fetchMenus,
  fetchPublishedRecipes,
  fetchRecipe,
  fetchSiteContent,
  fetchSocialLinks,
} from './api';
import { aboutMarkdown, glossaryMarkdown, link, menuMarkdown, recipesByTheme, textParagraphs } from './page-markdown';
import { capArticleToMarkdown } from './cap-markdown';
import { recipeToMarkdown } from './recipe-markdown';

const SUMMARY =
  'Le blog de cuisine et de pâtisserie de Yona, en français : des recettes maison, simples et gourmandes, ' +
  'salées et sucrées, écrites et testées par Yona';

/** Recipes read at once from the API for llms-full.txt: the backend keeps its answers in memory anyway. */
const PARALLEL_REQUESTS = 5;

export interface LlmsContent {
  content: SiteContentResponse;
  recipes: RecipeCard[];
  menus: MenuSummary[];
  glossary: GlossaryTermResponse[];
  /** Published articles of "Mon CAP", the latest first. */
  capArticles?: CapArticleCard[];
}

/**
 * The site described for AI assistants (https://llmstxt.org): what it is, who writes it, and every
 * published recipe, menu and page worth reading, in Markdown.
 */
export function llmsTxt({ content, recipes, menus, glossary, capArticles = [] }: LlmsContent): string {
  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SUMMARY}`,
    '',
    ...textParagraphs(content.aboutText),
    'Chaque recette donne ses ingrédients et leurs quantités, son matériel, ses étapes, ses temps (préparation, ' +
      'repos, cuisson), sa difficulté, le nombre de personnes, souvent un conseil et des questions fréquentes',
    '',
    "Chaque page existe aussi en Markdown : son adresse suivie de « .md » (« /index.md » pour l'accueil), ou la " +
      "même adresse demandée avec l'en-tête « Accept: text/markdown ». Tout le texte du site, recettes complètes " +
      `comprises, en un seul fichier : ${absoluteUrl('/llms-full.txt')}`,
    '',
    'Les recettes, textes et photos appartiennent à leur autrice : les citer avec un lien vers la recette plutôt ' +
      'que les reproduire en entier',
    '',
    ...recipesByTheme(recipes, '##'),
  ];
  if (menus.length) {
    lines.push(
      '## Menus',
      '',
      ...menus.map((menu) => link(menu.title, menuLink(menu).join('/'), menu.intro && excerpt(menu.intro, 200))),
      '',
    );
  }
  if (capArticles.length) {
    lines.push(
      '## Mon CAP',
      '',
      'Le carnet de route de Yona vers son CAP Pâtisserie : ses journées de formation, ses examens, les techniques apprises',
      '',
      ...capArticles.map((article) =>
        link(article.title, capArticleLink(article).join('/'), [article.subtitle, article.excerpt && excerpt(article.excerpt, 200)].filter(Boolean).join(' · ')),
      ),
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
    ...(capArticles.length
      ? [link('Mon CAP', CAP_PATH, 'le carnet de route de Yona vers son CAP Pâtisserie, article par article')]
      : []),
    link('À propos de Yona', ABOUT_PATH, "l'autrice des recettes"),
    '',
    '## Optional',
    '',
    link('Tout le texte du site', '/llms-full.txt', 'chaque recette en entier, en un seul fichier'),
    link("Installer l'application", INSTALL_PATH, 'les recettes sur téléphone, lisibles hors connexion'),
    link(
      "Conditions d'utilisation",
      TERMS_OF_USE_PATH,
      'citation avec un lien bienvenue, exploration et entraînement des modèles permis',
    ),
    '',
  );
  return lines.join('\n');
}

export interface LlmsFullContent {
  content: SiteContentResponse;
  socialLinks: SocialLinkResponse[];
  /** Savory, then sweet, the latest first in each. */
  recipes: RecipeDetail[];
  menus: MenuDetail[];
  glossary: GlossaryTermResponse[];
  /** "Mon CAP", the latest first. */
  capArticles?: CapArticle[];
}

/**
 * llms-full.txt: the whole text of the site in one file, for an assistant that reads it all at once
 * rather than page by page. The pages one after the other, as their Markdown versions, between "---".
 */
export function llmsFullTxt({ content, socialLinks, recipes, menus, glossary, capArticles = [] }: LlmsFullContent): string {
  const pages = [
    aboutMarkdown(content, socialLinks),
    ...recipes.map(recipeToMarkdown),
    ...menus.map(menuMarkdown),
    ...(glossary.length ? [glossaryMarkdown(glossary)] : []),
    ...capArticles.map(capArticleToMarkdown),
  ];
  const head = [
    `# ${SITE_NAME} : tout le texte`,
    '',
    `> ${SUMMARY}`,
    '',
    `Ci-dessous : Yona, puis ${recipes.length} recette${recipes.length > 1 ? 's' : ''} en entier (salées, puis ` +
      'sucrées, les plus récentes en premier)' +
      `${menus.length ? ', les menus' : ''}${glossary.length ? ', le glossaire de pâtisserie' : ''}` +
      `${capArticles.length ? ' et les articles de Mon CAP' : ''}. ` +
      `La liste des pages est dans ${absoluteUrl('/llms.txt')} ; chacune existe aussi seule en Markdown, ` +
      'à son adresse suivie de « .md »',
    '',
    'Les recettes, textes et photos appartiennent à leur autrice : les citer avec un lien vers la recette plutôt ' +
      'que les reproduire en entier',
    '',
  ];
  return [head.join('\n'), ...pages.map((page) => page.trim() + '\n')].join('\n---\n\n');
}

/** /llms.txt, built on each request from the API like the sitemap, cached one hour. */
export const llms: RequestHandler = async (req, res) => {
  const origin = apiOrigin(req);
  try {
    const [content, recipes, menus, glossary, capEntries] = await Promise.all([
      fetchSiteContent(origin),
      fetchPublishedRecipes(origin),
      fetchMenus(origin),
      fetchGlossary(origin),
      fetchCapEntries(origin),
    ]);
    sendText(res, llmsTxt({ content, recipes, menus, glossary, capArticles: capEntries }));
  } catch (error) {
    console.error('llms.txt unavailable', error);
    sendUnavailable(res);
  }
};

/** /llms-full.txt, every recipe read from the API, a few at a time; cached one hour like llms.txt. */
export const llmsFull: RequestHandler = async (req, res) => {
  const origin = apiOrigin(req);
  try {
    const [content, socialLinks, cards, menuSummaries, glossary, capCards] = await Promise.all([
      fetchSiteContent(origin),
      fetchSocialLinks(origin),
      fetchPublishedRecipes(origin),
      fetchMenus(origin),
      fetchGlossary(origin),
      fetchCapEntries(origin),
    ]);
    const ordered = THEMES.flatMap((theme) => cards.filter((card) => (card.theme ?? 'SWEET') === theme.value));
    const recipes = await inBatches(ordered, (card) => fetchRecipe(origin, card.slug));
    const menus = await Promise.all(menuSummaries.map((menu) => fetchMenu(origin, menu.slug)));
    const capArticles = await inBatches(capCards, (card) => fetchCapArticle(origin, card.slug));
    sendText(res, llmsFullTxt({ content, socialLinks, recipes, menus, glossary, capArticles }));
  } catch (error) {
    console.error('llms-full.txt unavailable', error);
    sendUnavailable(res);
  }
};

async function inBatches<T, R>(items: T[], read: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += PARALLEL_REQUESTS) {
    results.push(...(await Promise.all(items.slice(start, start + PARALLEL_REQUESTS).map(read))));
  }
  return results;
}

function sendText(res: Parameters<RequestHandler>[1], text: string): void {
  res.type('text/plain; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(text);
}

function sendUnavailable(res: Parameters<RequestHandler>[1]): void {
  res
    .status(503)
    .set('Cache-Control', 'no-store')
    .set('Retry-After', '300')
    .type('text/plain')
    .send('Fichier temporairement indisponible');
}
