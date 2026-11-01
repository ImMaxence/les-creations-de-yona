import { inject } from '@angular/core';
import { AUTHOR_ID, WEBSITE_ID } from '../../core/seo/json-ld';
import { PageSeo, absoluteUrl, excerpt } from '../../core/seo/page-seo';
import { SiteData } from '../../core/site/site-data';
import { ABOUT_PATH } from '../../shared/routing/links';
import { authorNode, authorPhoto } from '../home/home.seo';

/** A profile page (schema.org ProfilePage) whose subject is Yona, the author of every recipe. */
export function aboutSeo(): PageSeo {
  const siteData = inject(SiteData);
  const url = absoluteUrl(ABOUT_PATH);
  return {
    title: 'À propos de Yona',
    description: excerpt(siteData.content().aboutText),
    image: authorPhoto(siteData),
    jsonLd: [
      {
        '@type': 'ProfilePage',
        '@id': url,
        url,
        name: 'À propos de Yona',
        inLanguage: 'fr-FR',
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': AUTHOR_ID },
      },
      authorNode(siteData),
    ],
  };
}
