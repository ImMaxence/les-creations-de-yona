import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { TimeoutError, catchError, from, of, switchMap, tap, throwError, timeout } from 'rxjs';

/** Copies of the public API's answers, in the browser's cache storage. */
const CACHE_NAME = 'yona-api';

/** Waited for at most, then the copy is read: a network that does not answer does not block the reading. */
const NETWORK_TIMEOUT_MS = 3000;

/** The public data, read again offline (the back-office and the writes are never kept). */
const PUBLIC_API =
  /^\/api\/(recipes|featured-recipe|glossary|categories|ingredients|menus|site-content|social-links|tags|theme)(\/|\?|$)/;

/**
 * Offline reading of the public data, without the service worker in the way (1.14.1): busy
 * installing a new version, it made each answer wait for seconds. The page asks the API directly,
 * as the back-office does; each answer is copied in the cache storage; when the network does not
 * answer within 3 seconds, fails, or a proxy refuses (403, 5xx), the copy is read instead.
 */
export const apiCacheInterceptor: HttpInterceptorFn = (request, next) => {
  const path = request.urlWithParams.replace(/^https?:\/\/[^/]+/, '');
  if (
    !isPlatformBrowser(inject(PLATFORM_ID)) ||
    request.method !== 'GET' ||
    !PUBLIC_API.test(path) ||
    typeof caches === 'undefined'
  ) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { 'ngsw-bypass': 'true' } })).pipe(
    timeout({ each: NETWORK_TIMEOUT_MS }),
    tap((event) => {
      if (event instanceof HttpResponse && event.ok) {
        void keep(path, event.body);
      }
    }),
    catchError((error: unknown) => {
      const unreachable =
        error instanceof TimeoutError ||
        (error instanceof HttpErrorResponse && (error.status === 0 || error.status === 403 || error.status >= 500));
      if (!unreachable) {
        return throwError(() => error);
      }
      return from(copyOf(path)).pipe(
        switchMap((copy) =>
          copy === undefined ? throwError(() => error) : of(new HttpResponse({ body: copy.body, status: 200, url: path })),
        ),
      );
    }),
  );
};

async function keep(path: string, body: unknown): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(path, new Response(JSON.stringify(body ?? null), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    // Storage full or refused (private browsing): the page still works online
  }
}

/** The copy kept, wrapped so that a kept null (no featured recipe) is told apart from no copy. */
async function copyOf(path: string): Promise<{ body: unknown } | undefined> {
  try {
    const answer = await (await caches.open(CACHE_NAME)).match(path);
    return answer ? { body: await answer.json() } : undefined;
  } catch {
    return undefined;
  }
}
