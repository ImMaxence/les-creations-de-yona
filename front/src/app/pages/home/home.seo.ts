import { inject } from '@angular/core';
import { PageSeo, SITE_URL, absoluteUrl } from '../../core/seo/page-seo';
import { SiteData } from '../../core/site/site-data';

export const AUTHOR_PHOTO = '/images/yona-960.webp';

/** The home page stands in for an "about" page: it describes the author for search engines. */
export function homeSeo(): PageSeo {
  const socialLinks = inject(SiteData).socialLinks();
  return {
    image: AUTHOR_PHOTO,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Yona',
      url: SITE_URL,
      image: absoluteUrl(AUTHOR_PHOTO),
      description:
        'Passionnée de cuisine, Yona fait de sa passion un métier en préparant son CAP Pâtisserie.',
      sameAs: socialLinks.length ? socialLinks.map((link) => link.url) : undefined,
    },
  };
}
