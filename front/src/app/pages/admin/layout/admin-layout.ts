import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBookOpen,
  LucideCarrot,
  LucideDatabaseBackup,
  LucideImages,
  LucideLogOut,
  LucidePalette,
  LucideShare2,
  LucideTags,
} from '@lucide/angular';
import { AdminSession } from '../../../core/auth/admin-session';
import { Toaster } from '../../../core/notifications/toaster';
import { Button } from '../../../shared/ui/button/button';

/**
 * Frame of the back-office: greeting, sign-out and section tabs. Its stylesheet holds the
 * back-office building blocks (fields, panels, rows, badges), shared by every admin page and
 * loaded only with the back-office.
 */
@Component({
  selector: 'yona-admin-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Button,
    LucideBookOpen,
    LucideCarrot,
    LucideDatabaseBackup,
    LucideImages,
    LucideLogOut,
    LucidePalette,
    LucideShare2,
    LucideTags,
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

  protected readonly firstName = computed(() => this.session.admin()?.name.split(' ')[0] ?? '');
  protected readonly email = computed(() => this.session.admin()?.email ?? '');

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    this.toaster.success('Vous êtes déconnecté.');
    await this.router.navigateByUrl('/');
  }
}
