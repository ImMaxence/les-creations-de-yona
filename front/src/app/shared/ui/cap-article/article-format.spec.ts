import { CapBlock } from '../../../core/api/generated/models/cap-block';
import { articlePhotos, frenchDay, isSitePath } from './article-format';

describe('frenchDay', () => {
  it('writes the first of the month "1er"', () => {
    expect(frenchDay('2026-11-01')).toBe('1er');
    expect(frenchDay('2026-11-12')).toBe('12');
    expect(frenchDay('2026-11-21')).toBe('21');
  });
});

describe('articlePhotos', () => {
  const blocks: CapBlock[] = [
    { type: 'TEXT', text: 'Le matin' },
    { type: 'IMAGE', imageId: 'big', caption: 'Le plan de travail' },
    { type: 'IMAGE_TEXT', imageId: 'side', side: 'LEFT', text: 'À côté' },
    { type: 'STEPS', photos: [{ imageId: 'step-1', caption: 'Abaisser' }, {}, { imageId: 'step-3' }] },
    { type: 'TIP', text: 'Toujours peser' },
  ];

  it('lists every photo in the order of the page, its own first', () => {
    expect(articlePhotos({ title: 'Examen', imageId: 'main', blocks })).toEqual([
      { imageId: 'main', alt: 'Examen' },
      { imageId: 'big', caption: 'Le plan de travail' },
      { imageId: 'side', caption: undefined },
      { imageId: 'step-1', caption: '1. Abaisser' },
      // Numbered by its place among the steps, the empty one included
      { imageId: 'step-3', caption: '3.' },
    ]);
  });

  it('shows a photo used twice once, at its first place', () => {
    const photos = articlePhotos({ title: 'Examen', imageId: 'big', blocks });

    expect(photos.filter((photo) => photo.imageId === 'big')).toEqual([{ imageId: 'big', alt: 'Examen' }]);
  });

  it('has none for an article without photos', () => {
    expect(articlePhotos({ title: 'Examen', imageId: null, blocks: [{ type: 'TEXT', text: 'Rien' }, { type: 'IMAGE' }] })).toEqual([]);
  });
});

describe('isSitePath', () => {
  it('takes the pages of the site', () => {
    expect(isSitePath('/recettes/tartes/tarte-au-citron')).toBe(true);
  });

  it('leaves the other sites to the browser', () => {
    expect(isSitePath('https://example.com')).toBe(false);
    expect(isSitePath('//example.com')).toBe(false);
    expect(isSitePath('/\\example.com')).toBe(false);
    expect(isSitePath('mailto:yona@example.fr')).toBe(false);
    expect(isSitePath('')).toBe(false);
    expect(isSitePath(null)).toBe(false);
  });
});
