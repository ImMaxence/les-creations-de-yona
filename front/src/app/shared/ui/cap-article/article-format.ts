import { CapBlock } from '../../../core/api/generated/models/cap-block';
import { ViewedPhoto } from '../photo-viewer/photo-viewer';

const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'Europe/Paris' });

/** "1er", "12": the day of a date as French writes it. */
export function frenchDay(isoDate: string): string {
  const day = DAY.format(new Date(isoDate));
  return day === '1' ? '1er' : day;
}

/**
 * Every photo of an article, in the order of the page (its own first), to go from one to the
 * next once big; each once, the same photo twice opening at its first place.
 */
export function articlePhotos(article: { title: string; imageId?: string | null; blocks: readonly CapBlock[] }): ViewedPhoto[] {
  const photos: ViewedPhoto[] = article.imageId ? [{ imageId: article.imageId, alt: article.title }] : [];
  for (const block of article.blocks) {
    if (block.imageId && (block.type === 'IMAGE' || block.type === 'IMAGE_TEXT')) {
      photos.push({ imageId: block.imageId, caption: block.caption });
    }
    if (block.type === 'STEPS') {
      block.photos?.forEach((photo, index) => {
        if (photo.imageId) {
          photos.push({ imageId: photo.imageId, caption: `${index + 1}. ${photo.caption ?? ''}`.trim() });
        }
      });
    }
  }
  return photos.filter((photo, index) => photos.findIndex((other) => other.imageId === photo.imageId) === index);
}

/** A link of the text to a page of the site ("/recettes/…"), opened without reloading it; not one to another site. */
export function isSitePath(href: string | null | undefined): href is string {
  // "/\site.fr" is read by browsers as "//site.fr"
  return !!href && href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\');
}
