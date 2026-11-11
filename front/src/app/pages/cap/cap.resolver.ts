import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RedirectCommand, ResolveFn, Router } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { getCapEntry } from '../../core/api/generated/fn/mon-cap/get-cap-entry';
import { listCapEntries } from '../../core/api/generated/fn/mon-cap/list-cap-entries';
import { CapArticle } from '../../core/api/generated/models/cap-article';
import { CapArticleCard } from '../../core/api/generated/models/cap-article-card';
import { AUTHOR_REF, WEBSITE_ID, breadcrumb } from '../../core/seo/json-ld';
import { PageSeo, absoluteUrl, excerpt, markdownPathOf } from '../../core/seo/page-seo';
import { CAP_PATH, capArticleLink } from '../../shared/routing/links';
import { NOT_FOUND_PATH } from '../recipe/recipe.resolver';

export const capEntriesResolver: ResolveFn<CapArticleCard[]> = () =>
  inject(Api)
    .invoke(listCapEntries)
    .catch(() => []);

/** A draft or an unknown address shows the 404 page. */
export const capArticleResolver: ResolveFn<CapArticle> = async (route) => {
  const router = inject(Router);
  try {
    return await inject(Api).invoke(getCapEntry, { slug: route.paramMap.get('slug')! });
  } catch (error) {
    if (error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400)) {
      return new RedirectCommand(router.parseUrl(NOT_FOUND_PATH), { skipLocationChange: true });
    }
    throw error;
  }
};

/** Empty, it is not worth indexing. */
/** What the articles are about, for search engines and assistants: the diploma, and pastry. */
const CAP_ABOUT = [
  { '@type': 'EducationalOccupationalCredential', name: 'CAP Pâtissier', credentialCategory: 'Certificat d’aptitude professionnelle' },
  { '@type': 'Thing', name: 'Pâtisserie' },
];

/** The words the articles are found by. */
const CAP_KEYWORDS = ['CAP Pâtissier', 'CAP Pâtisserie', 'formation pâtisserie', 'examen CAP', 'techniques de pâtisserie'];

const CAP_DESCRIPTION =
  'Le carnet de route de Yona vers son CAP Pâtisserie : les étapes, les épreuves et les avancées, article par article';

export function capSeo(route: ActivatedRouteSnapshot): PageSeo {
  const entries = (route.data['entries'] as CapArticleCard[] | undefined) ?? [];
  return {
    title: 'Mon CAP',
    description: CAP_DESCRIPTION,
    markdownPath: markdownPathOf(CAP_PATH),
    noIndex: entries.length === 0,
    // The blog and each of its articles, so that an engine or an assistant knows them all from here
    jsonLd: entries.length
      ? [
          {
            '@type': 'Blog',
            '@id': `${absoluteUrl(CAP_PATH)}#blog`,
            name: 'Mon CAP',
            description: CAP_DESCRIPTION,
            url: absoluteUrl(CAP_PATH),
            author: AUTHOR_REF,
            isPartOf: { '@id': WEBSITE_ID },
            about: CAP_ABOUT,
            keywords: CAP_KEYWORDS.join(', '),
            inLanguage: 'fr-FR',
            blogPost: entries.map((entry) => {
              const path = capArticleLink(entry).join('/');
              return {
                '@type': 'BlogPosting',
                '@id': `${absoluteUrl(path)}#article`,
                headline: entry.title,
                url: absoluteUrl(path),
                datePublished: entry.happenedOn,
                ...(entry.excerpt ? { description: excerpt(entry.excerpt) } : {}),
                ...(entry.imageId ? { image: absoluteUrl(`/api/images/${entry.imageId}/1600.webp`) } : {}),
              };
            }),
          },
          breadcrumb([{ name: 'Mon CAP', path: CAP_PATH }]),
        ]
      : undefined,
  };
}

/** The words of an article, its texts and captions, Markdown left out: its length for search engines. */
export function wordCount(article: Pick<CapArticle, 'blocks'>): number {
  const text = article.blocks
    .flatMap((block) => [block.text, block.caption, ...(block.photos ?? []).map((photo) => photo.caption)])
    .filter(Boolean)
    .join(' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>-]/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** An article of the blog for search engines: its title, its start, its photo, by Yona. */
export function capArticleSeo(route: ActivatedRouteSnapshot): PageSeo {
  const article = route.data['article'] as CapArticle;
  const path = capArticleLink(article).join('/');
  const image = article.imageId ? `/api/images/${article.imageId}/1600.webp` : undefined;
  const description = excerpt([article.subtitle, article.excerpt].filter(Boolean).join(' · ') || `${article.title}, dans Mon CAP`);
  return {
    title: `${article.title} · Mon CAP`,
    description,
    image,
    type: 'article',
    markdownPath: markdownPathOf(path),
    jsonLd: [
      {
        '@type': 'BlogPosting',
        '@id': `${absoluteUrl(path)}#article`,
        headline: article.title,
        ...(article.subtitle ? { alternativeHeadline: article.subtitle } : {}),
        description,
        datePublished: article.happenedOn,
        dateModified: article.updatedAt,
        author: AUTHOR_REF,
        publisher: AUTHOR_REF,
        articleSection: 'Mon CAP',
        about: CAP_ABOUT,
        keywords: CAP_KEYWORDS.join(', '),
        wordCount: wordCount(article),
        isAccessibleForFree: true,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntityOfPage: absoluteUrl(path),
        ...(image ? { image: absoluteUrl(image) } : {}),
        inLanguage: 'fr-FR',
      },
      breadcrumb([
        { name: 'Mon CAP', path: CAP_PATH },
        { name: article.title, path },
      ]),
    ],
  };
}
