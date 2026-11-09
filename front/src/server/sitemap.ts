import type { RequestHandler } from 'express';
import type { GlossaryTermResponse } from '../app/core/api/generated/models/glossary-term-response';
import type { MenuSummary } from '../app/core/api/generated/models/menu-summary';
import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import { SITE_URL } from '../app/core/seo/page-seo';
import {
  ABOUT_PATH,
  CAP_PATH,
  GLOSSARY_PATH,
  INSTALL_PATH,
  LEGAL_NOTICE_PATH,
  MENUS_PATH,
  OBSERVATIONS_PATH,
  PRIVACY_POLICY_PATH,
  RECIPES_PATH,
  TERMS_OF_USE_PATH,
  categoryQueryParams,
  menuLink,
  recipeLink,
} from '../app/shared/routing/links';
import { apiOrigin, fetchCapEntries, fetchGlossary, fetchMenus, fetchObservationCount, fetchPublishedRecipes } from './api';

const STATIC_PATHS = ['/', RECIPES_PATH, ABOUT_PATH, INSTALL_PATH, LEGAL_NOTICE_PATH, TERMS_OF_USE_PATH, PRIVACY_POLICY_PATH];

/** Indexable pages only: no search results, no empty category nor glossary (all noindex). */
function sitemapPaths(
  recipes: RecipeCard[],
  glossary: GlossaryTermResponse[],
  menus: MenuSummary[],
  capSteps: number,
  observations: number,
): string[] {
  const categories = new Set(recipes.flatMap((recipe) => recipe.categories.map((category) => category.slug)));
  return [
    ...STATIC_PATHS,
    ...(capSteps ? [CAP_PATH] : []),
    ...(observations ? [OBSERVATIONS_PATH] : []),
    ...(glossary.length ? [GLOSSARY_PATH] : []),
    ...(menus.length ? [MENUS_PATH, ...menus.map((menu) => menuLink(menu).join('/'))] : []),
    ...[...categories].map(
      (slug) => `${RECIPES_PATH}?${new URLSearchParams(categoryQueryParams({ slug }))}`,
    ),
    ...recipes.map((recipe) => recipeLink(recipe).join('/')),
  ];
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
  );
}

function toXml(paths: string[]): string {
  const urls = paths.map((path) => `  <url><loc>${escapeXml(new URL(path, SITE_URL).href)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * /sitemap.xml, built on each request from the published recipes: always up to date, cached one
 * hour. URLs use the production domain, the only one search engines should index.
 */
export const sitemap: RequestHandler = async (req, res) => {
  const origin = apiOrigin(req);
  try {
    const [recipes, glossary, menus, capEntries, observations] = await Promise.all([
      fetchPublishedRecipes(origin),
      fetchGlossary(origin),
      fetchMenus(origin),
      fetchCapEntries(origin),
      fetchObservationCount(origin),
    ]);
    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(toXml(sitemapPaths(recipes, glossary, menus, capEntries.length, observations)));
  } catch (error) {
    console.error('Sitemap unavailable', error);
    res
      .status(503)
      .set('Cache-Control', 'no-store')
      .set('Retry-After', '300')
      .type('text/plain')
      .send('Sitemap temporairement indisponible');
  }
};
