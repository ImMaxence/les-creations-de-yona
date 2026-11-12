/** A photo of the messages (sent, of a group, of a link's preview), read on the back-office's API. */
export function messagePhoto(imageId: string, width: 800 | 1600 = 800): string {
  return `/api/admin/messages/images/${imageId}/${width}.webp`;
}

/** The image of a link's preview while the message is written. */
export function linkDraftImage(url: string): string {
  return `/api/admin/messages/link-preview/image?url=${encodeURIComponent(url)}`;
}

/** What the API takes as it is: JPEG or PNG, 10 MB at most. */
const SENDABLE = ['image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;
/** The longest side of a photo turned into JPEG: more than the 1600 px kept. */
const MAX_SIDE = 3200;

/**
 * A photo as the API takes it: a JPEG or a PNG of 10 MB at most is sent as it is; any other image the
 * browser reads (an iPhone's HEIC, a WebP, a heavy PNG) is drawn again as a JPEG first. Null when the
 * browser cannot read it.
 */
export async function sendablePhoto(file: File): Promise<File | null> {
  if (SENDABLE.includes(file.type) && file.size <= MAX_BYTES) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    // A transparent PNG on white rather than black
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return blob ? new File([blob], file.name.replace(/\.[^.]*$/, '') + '.jpg', { type: 'image/jpeg' }) : null;
  } catch {
    return null;
  }
}

/** The image files of a paste or a drop. */
export function imageFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((file) => !file.type || file.type.startsWith('image/'));
}
