import { PlatformLocation } from '@angular/common';
import { FetchBackend, HttpBackend, HttpEvent, HttpRequest } from '@angular/common/http';
import { Injectable, InjectionToken, Provider, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** Origin of the API as seen from the SSR server, e.g. http://back:8080 inside Docker. */
const INTERNAL_API_URL = new InjectionToken<string>('INTERNAL_API_URL');

/**
 * Server-side only. API calls are written with relative URLs (/api/...), which Angular resolves
 * against the public origin of the page. This backend sends them straight to the API instead,
 * without a round trip through Cloudflare.
 *
 * It runs after every interceptor, so the HTTP transfer cache keys stay the same as in the
 * browser and the client reuses the server responses during hydration.
 */
@Injectable()
class InternalApiBackend implements HttpBackend {
  private readonly fetchBackend = inject(FetchBackend);
  private readonly internalApiUrl = inject(INTERNAL_API_URL);
  private readonly publicHostname = inject(PlatformLocation).hostname;

  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const url = new URL(request.url);
    const isOwnApi = url.hostname === this.publicHostname && url.pathname.startsWith('/api/');
    return this.fetchBackend.handle(
      isOwnApi ? request.clone({ url: this.internalApiUrl + url.pathname + url.search }) : request,
    );
  }
}

export function provideInternalApiUrl(internalApiUrl: string | undefined): Provider[] {
  if (!internalApiUrl) {
    return [];
  }
  return [
    { provide: INTERNAL_API_URL, useValue: internalApiUrl.replace(/\/$/, '') },
    { provide: HttpBackend, useClass: InternalApiBackend },
  ];
}
