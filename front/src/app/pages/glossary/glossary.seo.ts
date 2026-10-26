import { ActivatedRouteSnapshot } from '@angular/router';
import { GlossaryTermResponse } from '../../core/api/generated/models/glossary-term-response';
import { PageSeo, absoluteUrl } from '../../core/seo/page-seo';
import { GLOSSARY_PATH } from '../../shared/routing/links';

/**
 * The glossary as a set of defined terms (schema.org DefinedTermSet), each one with its own
 * address on the page: /glossaire#chemiser. Empty, it is not worth indexing.
 */
export function glossarySeo(route: ActivatedRouteSnapshot): PageSeo {
  const terms = (route.data['terms'] as GlossaryTermResponse[] | undefined) ?? [];
  const url = absoluteUrl(GLOSSARY_PATH);
  return {
    title: 'Glossaire de pâtisserie',
    description:
      'Émulsionner, chemiser, blanchir, sabler… Les mots de la pâtisserie expliqués simplement, pour réussir les recettes.',
    noIndex: terms.length === 0,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      '@id': url,
      name: 'Glossaire de pâtisserie',
      url,
      hasDefinedTerm: terms.map((term) => ({
        '@type': 'DefinedTerm',
        name: term.name,
        description: term.definition,
        url: `${url}#${term.slug}`,
        inDefinedTermSet: url,
      })),
    },
  };
}
