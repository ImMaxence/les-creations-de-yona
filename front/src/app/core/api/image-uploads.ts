import { Injectable, inject } from '@angular/core';
import { AdminSession } from '../auth/admin-session';
import { Toaster } from '../notifications/toaster';
import { problemMessage, safeParse } from './admin-errors.interceptor';

/** Cookie set by the API, copied into a header on every write (Angular's default names). */
const XSRF_COOKIE = 'XSRF-TOKEN';
const XSRF_HEADER = 'X-XSRF-TOKEN';

/**
 * Photo uploads of the back-office, with their progress. HttpClient runs on fetch here, which
 * cannot report how much of a request body is sent: XMLHttpRequest can. What the interceptors do
 * for other calls is done here too: XSRF header, service worker bypass, errors shown as a toast,
 * expired session sent back to the sign-in.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploads {
  private readonly toaster = inject(Toaster);
  private readonly session = inject(AdminSession);

  /**
   * Multipart body (field "file") to an API path: PUT "/api/admin/recipes/12/image" for instance.
   * onProgress receives the share sent so far, from 0 to 1; at 1, the server still converts the
   * photo before answering. Rejects once the error has been shown.
   */
  send<T>(path: string, file: File, onProgress: (sent: number) => void, method: 'PUT' | 'POST' = 'PUT'): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(method, path);
      request.responseType = 'json';
      request.setRequestHeader('Accept', 'application/json');
      // Relayed by the service worker, Safari on iOS loses the file (see service-worker-bypass.ts)
      request.setRequestHeader('ngsw-bypass', 'true');
      const xsrfToken = readCookie(XSRF_COOKIE);
      if (xsrfToken) {
        request.setRequestHeader(XSRF_HEADER, xsrfToken);
      }
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded / event.total);
        }
      });
      request.addEventListener('load', () => {
        if (request.status >= 200 && request.status < 300) {
          resolve(request.response as T);
          return;
        }
        if (request.status === 401) {
          this.session.signIn();
        } else {
          const body = typeof request.response === 'string' ? safeParse(request.response) : request.response;
          this.toaster.error(problemMessage(body));
        }
        reject(new Error(`Upload answered ${request.status}`));
      });
      request.addEventListener('error', () => {
        this.toaster.error("L'envoi de la photo a échoué. Vérifiez la connexion et réessayez.");
        reject(new Error('Upload failed'));
      });
      const body = new FormData();
      body.append('file', file);
      request.send(body);
    });
  }
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}
