const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
/** Same limit as the API (10 MB): refused before sending rather than after a long upload. */
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
/** A photo opened in the photo editor first: any image the browser can read, 10 MB as for the API. */
const MAX_EDITABLE_BYTES = MAX_SIZE_BYTES;

/** For the "accept" attribute of a file input. */
export const PHOTO_ACCEPT = ACCEPTED_TYPES.join(',');

/** For a photo going through the photo editor (iPhone HEIC, WebP… as well). */
export const EDITABLE_PHOTO_ACCEPT = 'image/*';

/** Why the API would refuse this file, checked before sending it; null when it may be sent. */
export function photoFileError(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Choisissez une photo au format JPEG ou PNG';
  }
  return file.size > MAX_SIZE_BYTES ? 'Cette photo dépasse 10 Mo' : null;
}

/** Why the photo editor cannot open this file; null when it may try (it says so if the browser cannot read it). */
export function editablePhotoError(file: File): string | null {
  if (file.type && !file.type.startsWith('image/')) {
    return 'Choisissez une photo';
  }
  return file.size > MAX_EDITABLE_BYTES ? 'Cette photo dépasse 10 Mo' : null;
}

/** The API takes it as it is: JPEG or PNG, 10 MB at most. */
export function sendableAsIs(file: File): boolean {
  return photoFileError(file) === null;
}
