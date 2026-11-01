import { inject } from '@angular/core';
import { AUTHOR_ID } from '../../core/seo/json-ld';
import { PageSeo, absoluteUrl, excerpt } from '../../core/seo/page-seo';
import { SiteData } from '../../core/site/site-data';
import { ABOUT_PATH } from '../../shared/routing/links';

export const AUTHOR_PHOTO = '/images/yona-960.webp';

/** The photo of the "À propos" section: the one chosen in the back-office, otherwise the one bundled with the site. */
export function authorPhoto(siteData: SiteData): string {
  const imageId = siteData.content().aboutImageId;
  return imageId ? `/api/images/${imageId}/1600.webp` : AUTHOR_PHOTO;
}

/**
 * Yona described for search engines and AI assistants, with the text and photo of the "À propos"
 * section (edited in the back-office): on the home page and the about page.
 */
export function authorNode(siteData: SiteData): object {
  const socialLinks = siteData.socialLinks();
  return {
    '@type': 'Person',
    '@id': AUTHOR_ID,
    name: 'Yona',
    url: absoluteUrl(ABOUT_PATH),
    image: absoluteUrl(authorPhoto(siteData)),
    description: excerpt(siteData.content().aboutText),
    knowsAbout: ['Pâtisserie', 'Cuisine maison'],
    sameAs: socialLinks.length ? socialLinks.map((link) => link.url) : undefined,
  };
}

export function homeSeo(): PageSeo {
  const siteData = inject(SiteData);
  return { image: authorPhoto(siteData), jsonLd: [authorNode(siteData)] };
}
