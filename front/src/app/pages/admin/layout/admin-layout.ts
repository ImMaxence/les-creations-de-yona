import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, resource } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { getVersion } from '../../../core/api/generated/fn/admin-version/get-version';
import { AdminSession } from '../../../core/auth/admin-session';
import { ConfirmDialog } from '../../../core/dialog/confirm-dialog';
import { Toaster } from '../../../core/notifications/toaster';
import { FRONT_VERSION } from '../../../core/version';
import { Button } from '../../../shared/ui/button/button';
import { TooltipLayer } from '../../../shared/ui/tooltip/tooltip-layer';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Frame of the back-office: greeting, sign-out and section tabs. Its stylesheet holds the
 * back-office building blocks (fields, panels, rows, badges), shared by every admin page and
 * loaded only with the back-office.
 */
@Component({
  selector: 'yona-admin-layout',
  imports: [
    Icon,
    ConfirmDialog,
    TooltipLayer,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Button,
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminLayout {
  private readonly session = inject(AdminSession);
  private readonly toaster = inject(Toaster);
  private readonly router = inject(Router);
  private readonly api = inject(Api);

  protected readonly firstName = computed(() => this.session.admin()?.name.split(' ')[0] ?? '');
  protected readonly email = computed(() => this.session.admin()?.email ?? '');
  protected readonly frontVersion = FRONT_VERSION;
  /** Loaded once with the back-office; shown as "…" until then. */
  protected readonly backVersion = resource({ loader: () => this.api.invoke(getVersion) });

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    this.toaster.success('Vous êtes déconnecté.');
    await this.router.navigateByUrl('/');
  }
}
