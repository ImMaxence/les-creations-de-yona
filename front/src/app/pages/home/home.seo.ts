import { inject } from '@angular/core';
import { PageSeo, SITE_URL, absoluteUrl, excerpt } from '../../core/seo/page-seo';
import { SiteData } from '../../core/site/site-data';

export const AUTHOR_PHOTO = '/images/yona-960.webp';

/**
 * The home page stands in for an "about" page: it describes the author for search engines, with
 * the text and photo of its "À propos" section (edited in the back-office).
 */
export function homeSeo(): PageSeo {
  const siteData = inject(SiteData);
  const socialLinks = siteData.socialLinks();
  const content = siteData.content();
  const photo = content.aboutImageId ? `/api/images/${content.aboutImageId}/1600.webp` : AUTHOR_PHOTO;
  return {
    image: photo,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Yona',
      url: SITE_URL,
      image: absoluteUrl(photo),
      description: excerpt(content.aboutText),
      sameAs: socialLinks.length ? socialLinks.map((link) => link.url) : undefined,
    },
  };
}
