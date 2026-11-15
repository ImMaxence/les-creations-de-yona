import { HttpClient } from '@angular/common/http';
import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../api/generated/api';
import { getCurrentAdmin } from '../api/generated/fn/authentication/get-current-admin';
import { AdminResponse } from '../api/generated/models/admin-response';
import { ADMIN_SIGN_IN_PATH } from '../../shared/routing/links';

const XSRF_COOKIE = 'XSRF-TOKEN=';
/** Spring Security endpoint starting the sign-in with Google or Microsoft; it comes back to the back-office. */
const PROVIDER_SIGN_IN_URL = '/api/oauth2/authorization/';
/** Answers 204; needs the CSRF header, added by HttpClient. */
const SIGN_OUT_URL = '/api/auth/logout';

export type SignInProvider = 'google' | 'microsoft';

/**
 * Why the browser leaves for Google or Microsoft: {@code link} from "Mon compte", {@code access} with
 * a link to come in once, {@code choose} to pick another account than the one the browser is in.
 */
export interface ProviderSignIn {
  link?: boolean;
  access?: string;
  choose?: boolean;
}

/** The signed-in admin, if any. The session itself is an HttpOnly cookie held by the API. */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  private readonly adminState = signal<AdminResponse | null>(null);

  readonly admin = this.adminState.asReadonly();
  readonly isAdmin = computed(() => this.adminState() !== null);
  /** Signed in without any passkey yet: the back-office reminds them to add one, in "Mon compte". */
  readonly needsPasskey = computed(() => this.adminState()?.passkeys === 0);

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

  /** The API no longer knows this session: back to the sign-in page. */
  expire(): void {
    this.adminState.set(null);
    void this.router.navigateByUrl(ADMIN_SIGN_IN_PATH);
  }

  /** Full page navigation: the sign-in with Google or Microsoft happens outside the application. */
  signIn(provider: SignInProvider = 'google', reason: ProviderSignIn = {}): void {
    const params = new URLSearchParams();
    if (reason.link) params.set('link', '1');
    if (reason.access) params.set('access', reason.access);
    if (reason.choose) params.set('choose', '1');
    const query = params.toString();
    this.document.location.assign(PROVIDER_SIGN_IN_URL + provider + (query ? `?${query}` : ''));
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.post(SIGN_OUT_URL, null, { responseType: 'text' }));
    this.adminState.set(null);
  }
}
