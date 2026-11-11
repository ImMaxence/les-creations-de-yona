import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router } from '@angular/router';
import { SkeletonKind } from '../../../shared/ui/skeleton/skeleton';

/** Under this, the page changes at once: a skeleton would only flash. */
export const SLOW_NAVIGATION_MS = 400;

/** The path of an address, without its query and its anchor. */
export function pathOf(url: string): string {
  return url.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/';
}

/**
 * The page coming, drawn in grey, for another page of the site; null for the same page (a filter,
 * the next page of a list: it keeps its own content) and for the back-office (its pages have
 * their own skeletons, around the side panel).
 */
export function skeletonOfPage(target: string, current: string): SkeletonKind | null {
  const path = pathOf(target);
  if (path === pathOf(current) || path === '/admin' || path.startsWith('/admin/')) {
    return null;
  }
  const segments = path.split('/').filter(Boolean);
  if (segments[0] === 'recettes' && segments.length === 3) {
    return 'recipe';
  }
  if (segments.length <= 1 && ['', 'recettes', 'menus', 'mon-cap', 'boutique', 'favoris'].includes(segments[0] ?? '')) {
    return 'list';
  }
  return 'article';
}

/** The address being loaded for longer than a moment; null otherwise, and always on the server. */
@Injectable({ providedIn: 'root' })
export class SlowNavigation {
  readonly target = signal<string | null>(null);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    const router = inject(Router);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        clearTimeout(timer);
        // The first page is the server's, already drawn
        if (router.navigated) {
          timer = setTimeout(() => this.target.set(event.url), SLOW_NAVIGATION_MS);
        }
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      ) {
        clearTimeout(timer);
        this.target.set(null);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      subscription.unsubscribe();
    });
  }
}
