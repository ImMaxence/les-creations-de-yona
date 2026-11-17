import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppBadge, BADGE_CACHE, readCounts } from './app-badge';
import { ServiceWorkerGate } from './service-worker-gate';

describe('AppBadge', () => {
  let kept: Map<string, string>;
  let setAppBadge: ReturnType<typeof vi.fn>;
  let clearAppBadge: ReturnType<typeof vi.fn>;

  /** A device with the Badging API (iOS, a computer), whose service worker already counted {@code counts}. */
  function device(counts: object | null, workerKept = true): AppBadge {
    kept = new Map(counts ? [['/app-badge.json', JSON.stringify(counts)]] : []);
    setAppBadge = vi.fn(async () => undefined);
    clearAppBadge = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: setAppBadge });
    Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: clearAppBadge });
    vi.stubGlobal('caches', {
      open: async (name: string) => {
        expect(name).toBe(BADGE_CACHE);
        return {
          match: async (url: string) => (kept.has(url) ? new Response(kept.get(url)) : undefined),
          put: async (url: string, response: Response) => void kept.set(url, await response.text()),
        };
      },
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ServiceWorkerGate, useValue: { kept: async () => workerKept } },
      ],
    });
    return TestBed.inject(AppBadge);
  }

  /** The changes are queued: done once the queue is. */
  async function settled(): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve));
    }
  }

  function counts(): unknown {
    return JSON.parse(kept.get('/app-badge.json') ?? 'null');
  }

  afterEach(() => {
    delete (navigator as { setAppBadge?: unknown }).setAppBadge;
    delete (navigator as { clearAppBadge?: unknown }).clearAppBadge;
    vi.unstubAllGlobals();
  });

  it('sees the new recipes and articles once the site is open, and keeps what awaits in the back-office', async () => {
    device({ backOffice: 2, newRecipes: 3, newArticles: 1 }).listen();
    await settled();
    expect(counts()).toEqual({ backOffice: 2, newRecipes: 0, newArticles: 0 });
    expect(setAppBadge).toHaveBeenLastCalledWith(2);
  });

  it('follows the menu of the back-office, and clears the icon at nothing', async () => {
    const appBadge = device({ backOffice: 0, newRecipes: 1, newArticles: 2 });
    appBadge.backOffice(4);
    await settled();
    expect(setAppBadge).toHaveBeenLastCalledWith(7);

    appBadge.listen();
    appBadge.backOffice(0);
    await settled();
    expect(counts()).toEqual({ backOffice: 0, newRecipes: 0, newArticles: 0 });
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('keeps nothing in a browser tab', async () => {
    device(null, false).listen();
    await settled();
    expect(kept.size).toBe(0);
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('counts for nothing what is not a whole number', () => {
    expect(readCounts({ backOffice: 2.5, newRecipes: -1, newArticles: '3' })).toEqual({ backOffice: 0, newRecipes: 0, newArticles: 0 });
    expect(readCounts('{}')).toEqual({ backOffice: 0, newRecipes: 0, newArticles: 0 });
    expect(readCounts(null)).toEqual({ backOffice: 0, newRecipes: 0, newArticles: 0 });
    // Kept by 2.23, before the articles
    expect(readCounts({ backOffice: 3, newRecipes: 1 })).toEqual({ backOffice: 3, newRecipes: 1, newArticles: 0 });
  });
});
