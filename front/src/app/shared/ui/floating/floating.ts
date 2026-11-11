import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/** Room kept between the list and the edges of the screen, in pixels. */
const EDGE = 8;

/**
 * A list opened under a field or a button, drawn above everything else: in the browser's top layer
 * (a "manual" popover), so that no dialog, accordion or scrolling box around it cuts it. Placed under
 * what opened it, or above when the room is there rather than below; inside the screen; and kept in
 * place while the page or the dialog scrolls. Its own styles stay those of the component.
 * <ul yonaFloating [yonaFloating]="field">…</ul>, the element shown with an @if.
 */
@Directive({
  selector: '[yonaFloating]',
  host: { popover: 'manual', class: 'floating' },
})
export class Floating {
  /** What it hangs under: the field or the button that opened it. */
  readonly yonaFloating = input.required<HTMLElement>();
  /** Room between the two, in pixels. */
  readonly floatingGap = input(6);

  constructor() {
    const list: HTMLElement = inject(ElementRef).nativeElement;
    const view = list.ownerDocument.defaultView;
    let frame = 0;
    let resized: ResizeObserver | undefined;

    const place = (): void => {
      if (!view) {
        return;
      }
      const anchor = this.yonaFloating().getBoundingClientRect();
      const screenWidth = list.ownerDocument.documentElement.clientWidth;
      const gap = this.floatingGap();
      list.style.minWidth = `${anchor.width}px`;
      const box = list.getBoundingClientRect();
      // Under its start; too wide for the room left on the right, under its end
      let left = anchor.left;
      if (left + box.width > screenWidth - EDGE) {
        left = Math.max(EDGE, Math.min(anchor.right, screenWidth - EDGE) - box.width);
      }
      const below = view.innerHeight - anchor.bottom - gap - EDGE;
      const above = anchor.top - gap - EDGE;
      const up = box.height > below && above > below;
      list.style.left = `${left}px`;
      list.style.top = up ? 'auto' : `${anchor.bottom + gap}px`;
      list.style.bottom = up ? `${view.innerHeight - anchor.top + gap}px` : 'auto';
      list.style.transformOrigin = up ? 'bottom center' : 'top center';
    };
    const later = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };

    // First of the work after this render: what the component does next (focus its filter field,
    // scroll to the option chosen) needs the list shown
    afterNextRender({
      earlyRead: () => {
        // Not in every browser of the tests (jsdom): the list is then drawn where it stands
        if (typeof list.showPopover === 'function' && !list.matches(':popover-open')) {
          list.showPopover();
        }
        place();
        // Capture: the scroll of any box (a dialog, a panel) moves the field too
        view?.addEventListener('scroll', later, { capture: true, passive: true });
        view?.addEventListener('resize', later, { passive: true });
        if (typeof ResizeObserver !== 'undefined') {
          // Fewer options once filtered: placed again, above the field it stays against it
          resized = new ResizeObserver(later);
          resized.observe(list);
        }
      },
    });

    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(frame);
      view?.removeEventListener('scroll', later, { capture: true });
      view?.removeEventListener('resize', later);
      resized?.disconnect();
    });
  }
}
