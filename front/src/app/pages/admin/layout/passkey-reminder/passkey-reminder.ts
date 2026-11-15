import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AdminSession } from '../../../../core/auth/admin-session';
import { ADMIN_PATH } from '../../../../shared/routing/links';
import { Icon } from '../../../../shared/ui/icon/icon';

export const ACCOUNT_PATH = `${ADMIN_PATH}/mon-compte`;

/** "Plus tard": asked again a week after, on this browser, admin by admin. */
const LATER_KEY = 'admin-passkey-reminder';
const LATER_MS = 7 * 24 * 60 * 60 * 1000;

/** Until when each admin put the reminder off, by their id. */
export function readPostponed(): Record<string, number> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(LATER_KEY) ?? '{}');
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/**
 * Above the account in the menu, while the admin has no passkey: one to add in "Mon compte", to come in
 * with the face, the fingerprint or the code of the device, Google or not. Not on "Mon compte" itself.
 */
@Component({
  selector: 'yona-passkey-reminder',
  imports: [Icon, RouterLink],
  templateUrl: './passkey-reminder.html',
  styleUrl: './passkey-reminder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasskeyReminder {
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);

  protected readonly accountPath = ACCOUNT_PATH;
  private readonly postponed = signal(readPostponed());
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly shown = computed(() => {
    const admin = this.session.admin();
    if (!this.session.needsPasskey() || !admin || this.url().startsWith(ACCOUNT_PATH)) {
      return false;
    }
    return (this.postponed()[admin.id] ?? 0) < Date.now();
  });

  protected postpone(): void {
    const admin = this.session.admin();
    if (!admin) {
      return;
    }
    const postponed = { ...this.postponed(), [admin.id]: Date.now() + LATER_MS };
    this.postponed.set(postponed);
    try {
      localStorage.setItem(LATER_KEY, JSON.stringify(postponed));
    } catch {
      // Private browsing: put off until the page is reloaded
    }
  }
}
