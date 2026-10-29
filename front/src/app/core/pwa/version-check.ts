import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { tap } from 'rxjs';
import { AppUpdates } from './app-updates';

/** Header of every answer of the API: the version of the backend (VersionHeaderFilter). */
export const VERSION_HEADER = 'X-App-Version';

/**
 * Reads the version of the backend on every answer of the API, errors included: a page opened
 * before a deployment learns a new version is out (see AppUpdates). In the browser only.
 */
export const versionCheckInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return next(request);
  }
  const updates = inject(AppUpdates);
  return next(request).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          updates.backendVersion(event.headers.get(VERSION_HEADER));
        }
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          updates.backendVersion(error.headers?.get(VERSION_HEADER) ?? null);
        }
      },
    }),
  );
};
