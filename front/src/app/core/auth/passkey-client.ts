import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { problemMessage } from '../api/admin-errors.interceptor';
import { assertionJson, creationOptions, deviceLabel, newPasskeyJson, passkeyErrorMessage, requestOptions } from './passkeys';

/** What a passkey ceremony ends with: done, closed by the admin (nothing to say), or a message to show. */
export type PasskeyResult<T = void> = { ok: true; value: T } | { ok: false; message: string | null };

/** Two calls of the API around the browser's own window: making a passkey, or signing in with one. */
@Injectable({ providedIn: 'root' })
export class PasskeyClient {
  private readonly http = inject(HttpClient);

  /** Sign in with any passkey of the site this device holds; the API opens the session. */
  async signIn(): Promise<PasskeyResult<string>> {
    try {
      const options = await this.post<Record<string, unknown>>('/api/auth/passkey/options', null);
      const credential = (await navigator.credentials.get({ publicKey: requestOptions(options) })) as PublicKeyCredential | null;
      if (!credential) {
        return { ok: false, message: null };
      }
      const answer = await this.post<{ redirectUrl: string }>('/api/auth/passkey', assertionJson(credential));
      return { ok: true, value: answer.redirectUrl };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
    }
  }

  /**
   * A new passkey on this device: for the admin signed in ("Mon compte", the API answers their account),
   * or with a link to come in (the API answers where to go). {@code base} names the two routes:
   * {@code base}/options, then {@code base}.
   */
  async create<T>(base: string, label = deviceLabel(navigator.userAgent)): Promise<PasskeyResult<T>> {
    try {
      const options = await this.post<Record<string, unknown>>(`${base}/options`, null);
      const credential = (await navigator.credentials.create({ publicKey: creationOptions(options) })) as PublicKeyCredential | null;
      if (!credential) {
        return { ok: false, message: null };
      }
      return { ok: true, value: await this.post<T>(base, newPasskeyJson(credential, label)) };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
    }
  }

  private post<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(url, body, { headers: { 'Content-Type': 'application/json' } }));
  }
}

/** The API's own French message, or what the browser's refusal means; null for a window closed. */
function messageOf(error: unknown): string | null {
  if (error instanceof HttpErrorResponse) {
    // Already shown as a toast for the back-office routes (adminErrorsInterceptor)
    return error.url?.includes('/api/admin/') ? null : problemMessage(error.error);
  }
  return passkeyErrorMessage(error);
}
