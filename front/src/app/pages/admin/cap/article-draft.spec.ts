import { ArticleDraft, isArticleDraft, keptArticleKey } from './article-draft';

const DRAFT: ArticleDraft = {
  title: 'Examen blanc',
  subtitle: '',
  date: '2026-11-10',
  imageId: null,
  style: 'NOTEBOOK',
  published: false,
  featured: false,
  blocks: [{ type: 'TEXT', text: 'Le matin' }, { type: 'STEPS', photos: [{}, {}] }],
};

describe('keptArticleKey', () => {
  it('keeps each article apart, a new one under "nouveau"', () => {
    expect(keptArticleKey(12)).toBe('yona-article-draft-12');
    expect(keptArticleKey(null)).toBe('yona-article-draft-nouveau');
  });
});

describe('isArticleDraft', () => {
  it('takes back an article as it was kept', () => {
    expect(isArticleDraft(DRAFT)).toBe(true);
    expect(isArticleDraft({ ...DRAFT, imageId: 'e1b4…', blocks: [] })).toBe(true);
  });

  it('refuses what is not one, or was kept by an older version', () => {
    expect(isArticleDraft(null)).toBe(false);
    expect(isArticleDraft('Examen')).toBe(false);
    expect(isArticleDraft({ ...DRAFT, title: undefined })).toBe(false);
    expect(isArticleDraft({ ...DRAFT, style: 'MAGAZINE' })).toBe(false);
    expect(isArticleDraft({ ...DRAFT, published: 'oui' })).toBe(false);
    expect(isArticleDraft({ ...DRAFT, imageId: 3 })).toBe(false);
    expect(isArticleDraft({ ...DRAFT, blocks: 'texte' })).toBe(false);
    expect(isArticleDraft({ ...DRAFT, blocks: [{ type: 'VIDEO' }] })).toBe(false);
    expect(isArticleDraft({ ...DRAFT, blocks: [null] })).toBe(false);
  });
});
