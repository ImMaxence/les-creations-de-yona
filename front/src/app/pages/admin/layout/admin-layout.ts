import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AdminSession } from '../../../core/auth/admin-session';
import { ConfirmDialog } from '../../../core/dialog/confirm-dialog';
import { TooltipLayer } from '../../../shared/ui/tooltip/tooltip-layer';
import { Icon } from '../../../shared/ui/icon/icon';
import { UnreadFeedback } from '../feedback/unread-feedback';
import { NewOrders } from '../shop/new-orders';
import { AdminAvatar } from './admin-avatar/admin-avatar';
import { AdminNav } from './admin-nav/admin-nav';

/** From this width, the side panel stays open: `lg` in _variables.scss. */
const WIDE_SCREEN = '(width >= 64rem)';

/**
 * Frame of the back-office, in place of the site's header and footer: a side panel with every
 * section on computers; on phones and tablets a bar, the same panel opening over the page.
 * admin-layout.scss holds the back-office building blocks (fields, panels, rows, badges), shared
 * by every admin page and loaded only with the back-office.
 */
@Component({
  selector: 'yona-admin-layout',
  imports: [AdminAvatar, AdminNav, ConfirmDialog, Icon, RouterOutlet, TooltipLayer],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-frame.scss', './admin-layout.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminLayout {
  protected readonly session = inject(AdminSession);
  private readonly router = inject(Router);
  private readonly unreadFeedback = inject(UnreadFeedback);
  private readonly newOrders = inject(NewOrders);

  /** The back-office is drawn in the browser only: the width is known from the first render. */
  private readonly wideScreen = inject(DOCUMENT).defaultView!.matchMedia(WIDE_SCREEN);
  protected readonly wide = signal(this.wideScreen.matches);
  protected readonly waiting = computed(() => this.unreadFeedback.count() + this.newOrders.count());
  private readonly drawer = viewChild<ElementRef<HTMLDialogElement>>('drawer');

  constructor() {
    const onWidthChange = (event: MediaQueryListEvent): void => this.wide.set(event.matches);
    this.wideScreen.addEventListener('change', onWidthChange);
    inject(DestroyRef).onDestroy(() => this.wideScreen.removeEventListener('change', onWidthChange));

    // The badges of "Retours" and "Commandes": counted when the back-office opens, and at each change of section
    void this.unreadFeedback.refresh();
    void this.newOrders.refresh();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        void this.unreadFeedback.refresh();
        void this.newOrders.refresh();
      });
    // The panel stays open while the next section loads, then gives way to it
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError ||
            // A link to the section already shown: no navigation happens
            event instanceof NavigationSkipped,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeDrawer());
  }

  protected openDrawer(): void {
    const drawer = this.drawer()?.nativeElement;
    drawer?.showModal();
    // showModal() focuses the first link or button, and Safari then shows its focus ring after a tap
    drawer?.focus();
  }

  protected closeDrawer(): void {
    const drawer = this.drawer()?.nativeElement;
    if (drawer?.open) {
      drawer.close();
    }
  }

  /** The panel fills the dialog: a click on the dialog itself is on the dimmed page beside it. */
  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.drawer()?.nativeElement) {
      this.closeDrawer();
    }
  }
}
