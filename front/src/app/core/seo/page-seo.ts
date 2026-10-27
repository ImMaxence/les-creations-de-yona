import { ActivatedRouteSnapshot } from '@angular/router';

export const SITE_NAME = 'Les créations de Yona';
export const SITE_URL = 'https://les-creations-de-yona.fr';
export const DEFAULT_DESCRIPTION =
  'Recettes maison, simples et gourmandes : plats, desserts et pâtisseries à refaire chez soi';

/** What a page tells search engines and social networks. Every field has a site-wide default. */
export interface PageSeo {
  /** Page title, without the site name. */
  title?: string;
  description?: string;
  /** Path of the canonical URL. Defaults to the current path, without query parameters. */
  canonicalPath?: string;
  /** Image for social cards, as a path or an absolute URL. */
  image?: string;
  type?: 'website' | 'article';
  /** Structured data (schema.org), written as JSON-LD. */
  jsonLd?: object;
  noIndex?: boolean;
}

/**
 * Value of the "seo" key of a route's data: static, or computed once the route's resolvers ran.
 * The function runs in an injection context.
 */
export type RouteSeo = PageSeo | ((route: ActivatedRouteSnapshot) => PageSeo);

export const SEO_DATA_KEY = 'seo';

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

/** Plain text excerpt for meta descriptions, cut on a word boundary. */
export function excerpt(text: string, maxLength = 160): string {
  const plain = text.replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLength) {
    return plain;
  }
  const cut = plain.slice(0, maxLength - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
