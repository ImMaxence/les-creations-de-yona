/** The visible height shorter than this, at once or against the tallest seen: the keyboard of a phone, not its toolbar. */
const KEYBOARD_PX = 120;

/**
 * "Messages" fitted to what the screen shows, as a messaging app: the keyboard of a phone open, the page
 * takes the height left above it (the field right on the keyboard, the bar of the back-office still at
 * the top), then its whole height again once it is gone. Each time the keyboard comes or goes, the page,
 * which holds on one screen, goes back to its top: iOS (26 especially, the installed app above all) leaves
 * it scrolled down after the keyboard otherwise, a blank stretch under it, until the next reload.
 * Zoomed in with two fingers, the page keeps its height. Gives what stops it.
 */
export function fitToViewport(host: HTMLElement, view: Window): () => void {
  const viewport = view.visualViewport;
  if (!viewport) {
    return () => undefined;
  }
  let width = viewport.width;
  let tallest = 0;
  let last = viewport.height;
  const update = () => {
    if (Math.abs(viewport.scale - 1) > 0.01) {
      return;
    }
    const height = viewport.height;
    if (Math.abs(viewport.width - width) > 1) {
      // Turned: the tallest measured again
      width = viewport.width;
      tallest = 0;
    }
    tallest = Math.max(tallest, height);
    host.style.setProperty('--messages-viewport', `${height}px`);
    host.classList.toggle('is-keyboard', height < tallest - KEYBOARD_PX);
    if (Math.abs(height - last) > KEYBOARD_PX) {
      view.scrollTo(0, 0);
    }
    last = height;
  };
  update();
  viewport.addEventListener('resize', update);
  return () => {
    viewport.removeEventListener('resize', update);
    host.style.removeProperty('--messages-viewport');
    host.classList.remove('is-keyboard');
  };
}
