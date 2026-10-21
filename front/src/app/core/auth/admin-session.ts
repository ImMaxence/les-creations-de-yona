import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/generated/api';
import { getCurrentAdmin } from '../api/generated/fn/authentication/get-current-admin';
import { AdminResponse } from '../api/generated/models/admin-response';

const XSRF_COOKIE = 'XSRF-TOKEN=';

/** The signed-in admin, if any. The session itself is an HttpOnly cookie held by the API. */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly api = inject(Api);
  private readonly document = inject(DOCUMENT);

  private readonly adminState = signal<AdminResponse | null>(null);

  readonly admin = this.adminState.asReadonly();
  readonly isAdmin = computed(() => this.adminState() !== null);

  /**
   * Browser only. Only the back-office creates the XSRF-TOKEN cookie, so public visitors never
   * trigger a call to the API: the cookie hints at a session, the API confirms it.
   */
  async restore(): Promise<void> {
    if (!this.document.cookie.split('; ').some((cookie) => cookie.startsWith(XSRF_COOKIE))) {
      return;
    }
    try {
      this.adminState.set(await this.api.invoke(getCurrentAdmin));
    } catch {
      this.adminState.set(null);
    }
  }
}
