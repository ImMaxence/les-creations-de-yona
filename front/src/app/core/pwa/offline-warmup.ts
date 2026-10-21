import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { filter, take } from 'rxjs';

const PUBLIC_API = '/api/';
const ADMIN_API = '/api/admin/';

/**
 * Offline reading of the pages already visited. A server-rendered page gets its API data inside
 * the HTML (HTTP transfer cache): the browser never calls the API, so the service worker cannot
 * cache it. The public GET requests answered that way are noted until the first navigation ends,
 * then sent once more in the background, through the service worker, which keeps them.
 */
@Injectable({ providedIn: 'root' })
export class OfflineCacheWarmup {
  private readonly urls = new Set<string>();
  private recording = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (!this.recording) {
      return;
    }
    inject(Router)
      .events.pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
        take(1),
      )
      .subscribe(() => this.replay());
  }

  record(url: string): void {
    if (this.recording) {
      this.urls.add(url);
    }
  }

  /** Nothing to do until a service worker controls the page (from the second visit on). */
  private replay(): void {
    this.recording = false;
    if (navigator.serviceWorker?.controller) {
      for (const url of this.urls) {
        fetch(url).catch(() => undefined);
      }
    }
    this.urls.clear();
  }
}

export const offlineWarmupInterceptor: HttpInterceptorFn = (request, next) => {
  if (
    request.method === 'GET' &&
    request.url.startsWith(PUBLIC_API) &&
    !request.url.startsWith(ADMIN_API)
  ) {
    inject(OfflineCacheWarmup).record(request.urlWithParams);
  }
  return next(request);
};
