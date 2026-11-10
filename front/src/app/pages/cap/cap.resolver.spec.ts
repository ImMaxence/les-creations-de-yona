import { ActivatedRouteSnapshot } from '@angular/router';
import { CapArticle } from '../../core/api/generated/models/cap-article';
import { CapArticleCard } from '../../core/api/generated/models/cap-article-card';
import { absoluteUrl } from '../../core/seo/page-seo';
import { capArticleSeo, capSeo } from './cap.resolver';

function article(changes: Partial<CapArticle> = {}): CapArticle {
  return {
    id: 5,
    slug: 'mon-examen-blanc',
    title: 'Mon examen blanc',
    happenedOn: '2026-10-12',
    updatedAt: '2026-10-13T08:00:00Z',
    style: 'CLASSIC',
    blocks: [],
    ...changes,
  };
}

function route(data: Record<string, unknown>): ActivatedRouteSnapshot {
  return { data } as unknown as ActivatedRouteSnapshot;
}

/** The node of that type in the page's JSON-LD. */
function node(nodes: object[] | undefined, type: string): Record<string, unknown> {
  return (nodes as Record<string, unknown>[]).find((candidate) => candidate['@type'] === type)!;
}

describe('capSeo', () => {
  it('is not indexed while empty', () => {
    expect(capSeo(route({ entries: [] })).noIndex).toBe(true);
    expect(capSeo(route({})).noIndex).toBe(true);
    expect(capSeo(route({ entries: [{ slug: 'a' } as CapArticleCard] })).noIndex).toBe(false);
  });

  it('has its Markdown version', () => {
    expect(capSeo(route({ entries: [] })).markdownPath).toBe('/mon-cap.md');
  });
});

describe('capArticleSeo', () => {
  it('describes the article for search engines, as a blog post by Yona', () => {
    const seo = capArticleSeo(route({ article: article({ subtitle: 'Une pâte récalcitrante', excerpt: 'Le matin, tout allait bien', imageId: 'photo' }) }));
    const post = node(seo.jsonLd, 'BlogPosting');

    expect(seo.title).toBe('Mon examen blanc · Mon CAP');
    expect(seo.description).toBe('Une pâte récalcitrante · Le matin, tout allait bien');
    expect(seo.type).toBe('article');
    expect(seo.image).toBe('/api/images/photo/1600.webp');
    expect(seo.markdownPath).toBe('/mon-cap/mon-examen-blanc.md');
    expect(post['headline']).toBe('Mon examen blanc');
    expect(post['alternativeHeadline']).toBe('Une pâte récalcitrante');
    expect(post['datePublished']).toBe('2026-10-12');
    expect(post['dateModified']).toBe('2026-10-13T08:00:00Z');
    expect(post['mainEntityOfPage']).toBe(absoluteUrl('/mon-cap/mon-examen-blanc'));
    expect(post['image']).toBe(absoluteUrl('/api/images/photo/1600.webp'));
  });

  it('leaves out what the article does not have', () => {
    const seo = capArticleSeo(route({ article: article() }));
    const post = node(seo.jsonLd, 'BlogPosting');

    expect(seo.description).toBe('Mon examen blanc, dans Mon CAP');
    expect(seo.image).toBeUndefined();
    expect(post).not.toHaveProperty('alternativeHeadline');
    expect(post).not.toHaveProperty('image');
  });

  it('cuts a long start of text for the description', () => {
    const seo = capArticleSeo(route({ article: article({ excerpt: 'mot '.repeat(80) }) }));

    expect(seo.description!.length).toBeLessThanOrEqual(160);
    expect(seo.description!.endsWith('…')).toBe(true);
  });

  it('places the article under Mon CAP in the breadcrumb', () => {
    const trail = node(capArticleSeo(route({ article: article() })).jsonLd, 'BreadcrumbList');

    expect((trail['itemListElement'] as { name: string }[]).map((item) => item.name)).toEqual(['Mon CAP', 'Mon examen blanc']);
  });
});
