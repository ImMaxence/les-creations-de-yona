/**
 * Shared view-transition-name: the photo of the clicked recipe card grows into the header image
 * of the recipe page. Only one element of a page may carry it at a time.
 */
export const RECIPE_IMAGE_TRANSITION = 'recipe-image';

/** Plain left click: the link opens in this tab, so the page transition will happen. */
export function isSameTabClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}
