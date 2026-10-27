const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
/** Same limit as the API (10 MB): refused before sending rather than after a long upload. */
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** For the "accept" attribute of a file input. */
export const PHOTO_ACCEPT = ACCEPTED_TYPES.join(',');

/** Why the API would refuse this file, checked before sending it; null when it may be sent. */
export function photoFileError(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Choisissez une photo au format JPEG ou PNG';
  }
  return file.size > MAX_SIZE_BYTES ? 'Cette photo dépasse 10 Mo' : null;
}
