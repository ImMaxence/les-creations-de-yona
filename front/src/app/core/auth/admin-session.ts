import { HttpClient } from '@angular/common/http';
import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from '../api/generated/api';
import { getCurrentAdmin } from '../api/generated/fn/authentication/get-current-admin';
import { AdminResponse } from '../api/generated/models/admin-response';

const XSRF_COOKIE = 'XSRF-TOKEN=';
/** Spring Security endpoint starting the Google sign-in; it comes back to /admin. */
const GOOGLE_SIGN_IN_URL = '/api/oauth2/authorization/google';
/** Answers 204; needs the CSRF header, added by HttpClient. */
const SIGN_OUT_URL = '/api/auth/logout';

/** The signed-in admin, if any. The session itself is an HttpOnly cookie held by the API. */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  private readonly adminState = signal<AdminResponse | null>(null);

  readonly admin = this.adminState.asReadonly();
  readonly isAdmin = computed(() => this.adminState() !== null);

  /**
   * Browser only, on public pages. Only the back-office creates the XSRF-TOKEN cookie, so public
   * visitors never trigger a call to the API: the cookie hints at a session, the API confirms it.
   */
  async restore(): Promise<void> {
    if (this.document.cookie.split('; ').some((cookie) => cookie.startsWith(XSRF_COOKIE))) {
      await this.load();
    }
  }

  /** Asks the API who is signed in; null without a valid session. Also creates the CSRF cookie. */
  async load(): Promise<AdminResponse | null> {
    try {
      this.adminState.set(await this.api.invoke(getCurrentAdmin));
    } catch {
      this.adminState.set(null);
    }
    return this.adminState();
  }

  /** Full page navigation: the Google sign-in happens outside the application. */
  signIn(): void {
    this.document.location.assign(GOOGLE_SIGN_IN_URL);
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.post(SIGN_OUT_URL, null, { responseType: 'text' }));
    this.adminState.set(null);
  }
}
