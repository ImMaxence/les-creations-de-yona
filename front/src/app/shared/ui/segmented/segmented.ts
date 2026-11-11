import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** The choice made, among the options of the row: as each control says it. */
const CHOSEN = ':scope > :is([aria-pressed="true"], [aria-checked="true"], [aria-selected="true"], .is-chosen)';

/**
 * A row of choices in one pill (Tout, Sucré, Salé; Mois, Trimestre, Année…): the background of the
 * chosen one slides to the next instead of jumping. It is a thumb drawn behind the options
 * (styles/_segmented.scss), placed in the browser once the page is drawn; until then (a page
 * rendered by the server), the chosen option keeps its own background. Its colour:
 * --segmented-thumb and --segmented-thumb-shadow on the row (the accent by default).
 */
@Directive({
  selector: '[yonaSegmented]',
  host: { class: 'segmented-slide' },
})
export class Segmented {
  constructor() {
    const host: HTMLElement = inject(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const thumb = host.ownerDocument.createElement('span');
      thumb.className = 'segmented-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      host.prepend(thumb);
      let shown = false;

      const place = (): void => {
        const chosen = host.querySelector<HTMLElement>(CHOSEN);
        const style = thumb.style;
        // Nothing chosen, or not drawn yet (a closed dialog): hidden, it will appear in place
        if (!chosen?.offsetWidth) {
          style.opacity = '0';
          shown = false;
          return;
        }
        if (!shown) {
          style.transition = 'none';
        }
        style.width = `${chosen.offsetWidth}px`;
        style.height = `${chosen.offsetHeight}px`;
        style.transform = `translate(${chosen.offsetLeft}px, ${chosen.offsetTop}px)`;
        style.borderRadius = getComputedStyle(chosen).borderRadius;
        style.opacity = '';
        if (!shown) {
          // Placed at once the first time, then each change slides
          void thumb.offsetWidth;
          style.transition = '';
          shown = true;
        }
      };

      place();
      host.classList.add('is-sliding');
      const changes = new MutationObserver(place);
      changes.observe(host, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['aria-pressed', 'aria-checked', 'aria-selected', 'class'],
      });
      // Wider or narrower (a font loaded, a panel folded, a row that wraps): placed again, without sliding
      const resizes =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(() => {
              shown = false;
              place();
            });
      resizes?.observe(host);
      destroyRef.onDestroy(() => {
        changes.disconnect();
        resizes?.disconnect();
      });
    });
  }
}
