import { ABOUT_PATH } from '../../shared/routing/links';
import { DEFAULT_DESCRIPTION, SITE_NAME, absoluteUrl } from './page-seo';

/**
 * Identifiers shared by the JSON-LD of every page: search engines and AI assistants link the
 * pages on them (the site, and Yona as the author of each recipe).
 */
export const WEBSITE_ID = absoluteUrl('/#site');
export const AUTHOR_ID = absoluteUrl(`${ABOUT_PATH}#yona`);

/** Yona where a page names the author; the full description (photo, text, networks) is on the about page. */
export const AUTHOR_REF = { '@type': 'Person', '@id': AUTHOR_ID, name: 'Yona', url: absoluteUrl(ABOUT_PATH) };

/** The site, at the head of every page's graph. */
export const WEBSITE_NODE = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: absoluteUrl('/'),
  name: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
  inLanguage: 'fr-FR',
  author: { '@id': AUTHOR_ID },
  publisher: { '@id': AUTHOR_ID },
};

/** "Accueil > Recettes > Desserts > Tarte": each step's name and address. */
export function breadcrumb(steps: { name: string; path: string }[]): object {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

/** A list of pages (recipes of a category, menus), each with its address. */
export function itemList(items: { name: string; path: string }[]): object {
  return {
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(item.path),
      name: item.name,
    })),
  };
}
