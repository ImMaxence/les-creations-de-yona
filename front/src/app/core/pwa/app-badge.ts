import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { ServiceWorkerGate } from './service-worker-gate';

/** What the number on the icon of the app adds up, kept with the service worker (public/app-worker.js). */
export interface BadgeCounts {
  /** What awaits the admin in the back-office: messages not read, orders to handle. */
  backOffice: number;
  /** Recipes told by a notification since the site was last opened. */
  newRecipes: number;
}

/** Where the service worker keeps them too: the same names in app-worker.js. */
export const BADGE_CACHE = 'yona-badge';
const BADGE_FILE = '/app-badge.json';

/**
 * The number on the icon of the installed app (2.23), the red one of an iPhone: set by the service worker when a
 * notification comes, even with the app closed, then here once it is opened. iOS keeps it until the site changes it:
 * the new recipes are seen as soon as the site is open, what awaits in the back-office follows its menu. Android
 * has no such number (its launcher puts a dot on the icon while a notification is there): nothing happens there.
 * Only where the app is installed or receives notifications (ServiceWorkerGate): nothing kept in a browser tab.
 */
@Injectable({ providedIn: 'root' })
export class AppBadge {
  private readonly document = inject(DOCUMENT);
  private readonly serviceWorker = inject(ServiceWorkerGate);
  private readonly supported =
    isPlatformBrowser(inject(PLATFORM_ID)) &&
    typeof navigator !== 'undefined' &&
    typeof navigator.setAppBadge === 'function' &&
    typeof caches !== 'undefined';
  /** One change at a time: each reads what the one before wrote. */
  private queue = Promise.resolve();

  /** The site open, and each time it comes back on screen: its new recipes are seen. */
  listen(): void {
    if (!this.supported) {
      return;
    }
    this.change((counts) => ({ ...counts, newRecipes: 0 }));
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        this.change((counts) => ({ ...counts, newRecipes: 0 }));
      }
    });
  }

  /** What awaits the admin, as the menu of the back-office counts it. */
  backOffice(count: number): void {
    this.change((counts) => ({ ...counts, backOffice: count }));
  }

  private change(update: (counts: BadgeCounts) => BadgeCounts): void {
    if (!this.supported) {
      return;
    }
    this.queue = this.queue.then(() => this.apply(update)).catch(() => undefined);
  }

  private async apply(update: (counts: BadgeCounts) => BadgeCounts): Promise<void> {
    if (!(await this.serviceWorker.kept())) {
      return;
    }
    const cache = await caches.open(BADGE_CACHE);
    const before = readCounts(await (await cache.match(BADGE_FILE))?.json().catch(() => null));
    const counts = update(before);
    if (counts.backOffice !== before.backOffice || counts.newRecipes !== before.newRecipes) {
      await cache.put(BADGE_FILE, new Response(JSON.stringify(counts), { headers: { 'Content-Type': 'application/json' } }));
    }
    // Set again even unchanged: the icon may show what an older version of the site left there
    const total = badgeTotal(counts);
    await (total > 0 ? navigator.setAppBadge(total) : navigator.clearAppBadge());
  }
}

/** What was kept, a count that is not a whole number counting for nothing. */
export function readCounts(kept: unknown): BadgeCounts {
  const value = (name: keyof BadgeCounts): number => {
    const count = (kept as Partial<Record<keyof BadgeCounts, unknown>> | null)?.[name];
    return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : 0;
  };
  return { backOffice: value('backOffice'), newRecipes: value('newRecipes') };
}

export function badgeTotal(counts: BadgeCounts): number {
  return counts.backOffice + counts.newRecipes;
}
