import type { Request, RequestHandler } from 'express';
import { absoluteUrl, markdownPathOf } from '../app/core/seo/page-seo';
import { RECIPES_QUERY } from '../app/pages/recipes/recipes.resolver';
import { LATEST_RECIPES_COUNT } from '../app/pages/home/home.resolver';
import { THEMES } from '../app/shared/format/themes';
import {
  ABOUT_PATH,
  GLOSSARY_PATH,
  INSTALL_PATH,
  LEGAL_NOTICE_PATH,
  MENUS_PATH,
  PRIVACY_POLICY_PATH,
  RECIPES_PATH,
  TERMS_OF_USE_PATH,
  mainCategory,
  recipeLink,
} from '../app/shared/routing/links';
import {
  ApiError,
  apiOrigin,
  fetchCategories,
  fetchFeaturedRecipe,
  fetchGlossary,
  fetchLatestRecipes,
  fetchMenu,
  fetchMenus,
  fetchPublishedRecipes,
  fetchRecipe,
  fetchSiteContent,
  fetchSocialLinks,
} from './api';
import {
  aboutMarkdown,
  categoryPath,
  glossaryMarkdown,
  homeMarkdown,
  menuMarkdown,
  menusMarkdown,
  recipesMarkdown,
} from './page-markdown';
import { recipeToMarkdown } from './recipe-markdown';
import { renderedToMarkdown } from './rendered-markdown';

/** A page of the site rendered as a visitor gets it (HTML), or null when it does not answer 200. */
export type PageRenderer = (req: Request, path: string) => Promise<string | null>;

/** Pages whose text is written in their template: rendered, then converted. */
const RENDERED_PAGES = new Set([INSTALL_PATH, LEGAL_NOTICE_PATH, TERMS_OF_USE_PATH, PRIVACY_POLICY_PATH]);

/** Query parameters of /recettes kept in Markdown: a category; pages make no sense (everything is listed). */
const RECIPES_MARKDOWN_QUERY: readonly string[] = [RECIPES_QUERY.category, RECIPES_QUERY.page, RECIPES_QUERY.pageSize];

type MarkdownPage =
  /** path: the page's canonical address, query included. */
  | { markdown: string; path: string }
  /** The recipe lives in another category: its canonical address. */
  | { redirect: string }
  | null;

/**
 * The page a Markdown address stands for: "/a-propos.md" and "/a-propos/index.md" for /a-propos,
 * "/index.md" (or "/index.html.md", llms.txt convention) for the home page. Null for any other address.
 */
export function pagePathOf(path: string): string | null {
  if (!path.endsWith('.md')) {
    return null;
  }
  return path.slice(0, -'.md'.length).replace(/\/index(?:\.html)?$/, '') || '/';
}

/**
 * Every indexable page in Markdown, for AI assistants and agents that read rather than display:
 * at its address + ".md" (markdownPathOf, announced by the page), or at its own address when asked
 * for with "Accept: text/markdown". The page stays the canonical address (Link header), so search
 * engines do not index both. Any other page, an unknown recipe or a draft go on to the site (404 page).
 */
export function markdownPages(render: PageRenderer): RequestHandler {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const filePath = pagePathOf(req.path);
    // Browsers ask for text/html first, or anything (*/*): they get the page
    const negotiated = filePath === null && req.accepts(['text/html', 'text/markdown']) === 'text/markdown';
    if (filePath === null && !negotiated) {
      next();
      return;
    }
    let page: MarkdownPage;
    try {
      page = await pageMarkdown(req, filePath ?? req.path, render);
    } catch (error) {
      console.error('Page in Markdown unavailable', error);
      res
        .status(503)
        .set('Cache-Control', 'no-store')
        .set('Retry-After', '300')
        .type('text/plain')
        .send('Page temporairement indisponible');
      return;
    }
    if (!page) {
      next();
      return;
    }
    if ('redirect' in page) {
      res.redirect(301, negotiated ? page.redirect : markdownPathOf(page.redirect));
      return;
    }
    res
      .vary('Accept')
      .type('text/markdown; charset=utf-8')
      // At the page's own address, kept by no shared cache, as the HTML page (a CDN ignores Vary)
      .set('Cache-Control', negotiated ? 'private, no-cache' : 'public, max-age=3600')
      .set('Link', `<${absoluteUrl(page.path)}>; rel="canonical"`)
      .send(page.markdown);
  };
}

async function pageMarkdown(req: Request, path: string, render: PageRenderer): Promise<MarkdownPage> {
  const origin = apiOrigin(req);
  const recipe = /^\/recettes\/([^/]+)\/([^/]+)$/.exec(path);
  if (recipe) {
    return recipePage(origin, recipe[1], recipe[2]);
  }
  const menu = /^\/menus\/([^/]+)$/.exec(path);
  if (menu) {
    const detail = await orNotFound(fetchMenu(origin, menu[1]));
    return detail && { markdown: menuMarkdown(detail), path };
  }
  if (RENDERED_PAGES.has(path)) {
    const html = await render(req, path);
    const markdown = html && renderedToMarkdown(html, path);
    return markdown ? { markdown, path } : null;
  }
  switch (path) {
    case '/':
      return { markdown: await home(origin), path };
    case RECIPES_PATH:
      return recipesPage(origin, new URLSearchParams(req.originalUrl.split('?')[1] ?? ''));
    case MENUS_PATH:
      return { markdown: menusMarkdown(await fetchMenus(origin)), path };
    case GLOSSARY_PATH: {
      const terms = await fetchGlossary(origin);
      // Empty, the page is not indexed either
      return terms.length ? { markdown: glossaryMarkdown(terms), path } : null;
    }
    case ABOUT_PATH: {
      const [content, socialLinks] = await Promise.all([fetchSiteContent(origin), fetchSocialLinks(origin)]);
      return { markdown: aboutMarkdown(content, socialLinks), path };
    }
    default:
      return null;
  }
}

async function recipePage(origin: string, categorySlug: string, recipeSlug: string): Promise<MarkdownPage> {
  const recipe = await orNotFound(fetchRecipe(origin, recipeSlug));
  if (!recipe) {
    return null;
  }
  const path = recipeLink(recipe).join('/');
  return mainCategory(recipe).slug === categorySlug ? { markdown: recipeToMarkdown(recipe), path } : { redirect: path };
}

/** All the recipes, or those of a category; a search or another filter has no Markdown version. */
async function recipesPage(origin: string, query: URLSearchParams): Promise<MarkdownPage> {
  if ([...query.keys()].some((name) => !RECIPES_MARKDOWN_QUERY.includes(name))) {
    return null;
  }
  const slug = query.get(RECIPES_QUERY.category);
  const categories = await fetchCategories(origin);
  if (!slug) {
    return { markdown: recipesMarkdown(await fetchPublishedRecipes(origin), categories), path: RECIPES_PATH };
  }
  const category = categories.find((known) => known.slug === slug);
  const recipes = category ? await fetchPublishedRecipes(origin, { category: slug }) : [];
  // An unknown or empty category is not indexed either
  return category && recipes.length
    ? { markdown: recipesMarkdown(recipes, categories, category), path: categoryPath(category) }
    : null;
}

/** As the home page: the featured recipe, then the latest of each theme without it. */
async function home(origin: string): Promise<string> {
  const [content, featured, menus, ...latest] = await Promise.all([
    fetchSiteContent(origin),
    fetchFeaturedRecipe(origin),
    fetchMenus(origin),
    ...THEMES.map(({ value }) => fetchLatestRecipes(origin, value, LATEST_RECIPES_COUNT + 1)),
  ]);
  return homeMarkdown({
    content,
    featured,
    menus,
    latest: THEMES.map(({ value }, index) => ({
      theme: value,
      recipes: latest[index].filter((recipe) => recipe.slug !== featured?.slug).slice(0, LATEST_RECIPES_COUNT),
    })).filter((group) => group.recipes.length > 0),
  });
}

/** A draft, an unpublished menu or an unknown address: null, the site shows its 404 page. */
async function orNotFound<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
