import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, Scroll } from '@angular/router';
import { filter } from 'rxjs';

/**
 * The router scrolls back to the top on every navigation (`scrollPositionRestoration`): right for
 * a new page, not for a filter, an order or a page size changed in place, which only rewrites the
 * query of the URL. Returns a function to call just before such a navigation: the visitor stays
 * where they were. Call in an injection context.
 */
export function keepScrollThroughNextNavigation(): () => void {
  let kept: number | null = null;
  // The router scrolls on its Scroll event, after this subscriber has run: the position is put
  // back in the next frame, still before it is painted.
  inject(Router)
    .events.pipe(
      filter((event) => event instanceof Scroll),
      takeUntilDestroyed(),
    )
    .subscribe(() => {
      const top = kept;
      if (top !== null) {
        kept = null;
        requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }));
      }
    });
  return () => {
    kept = window.scrollY;
  };
}
