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
import { Icon } from '../../../shared/ui/icon/icon';
import { SKELETON_DELAY } from '../../../shared/ui/skeleton/skeleton';
import { UnreadFeedback } from '../feedback/unread-feedback';
import { NewOrders } from '../shop/new-orders';
import { AdminLive } from './admin-live';
import { AdminWatch } from './admin-watch';
import { AdminAvatar } from './admin-avatar/admin-avatar';
import { AdminNav } from './admin-nav/admin-nav';

const RAIL_KEY = 'admin-side-rail';

/** Read at once: the panel must not fold before the eyes. */
function readRail(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch {
    return false;
  }
}

/** The API of the back-office answers fast: its skeletons show only when an answer takes longer than this. */
const ADMIN_SKELETON_DELAY_MS = 500;

/** From this width, the side panel stays open: `lg` in _variables.scss. */
const WIDE_SCREEN = '(width >= 64rem)';

/**
 * Frame of the back-office, in place of the site's header and footer: a side panel with every
 * section on computers; on phones and tablets a bar, the same panel opening over the page.
 * admin-layout.scss holds the back-office building blocks (fields, panels, rows, badges), shared
 * by every admin page and loaded only with the back-office; admin-publication.scss those of a
 * publication (scheduled, failed), shared by the recipes and the articles.
 */
@Component({
  selector: 'yona-admin-layout',
  imports: [AdminAvatar, AdminNav, ConfirmDialog, Icon, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-frame.scss', './admin-layout.scss', './admin-publication.scss'],
  encapsulation: ViewEncapsulation.None,
  // Reaches every page of the back-office, drawn inside this frame
  providers: [{ provide: SKELETON_DELAY, useValue: ADMIN_SKELETON_DELAY_MS }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminLayout {
  protected readonly session = inject(AdminSession);
  private readonly router = inject(Router);
  private readonly unreadFeedback = inject(UnreadFeedback);
  private readonly newOrders = inject(NewOrders);
  private readonly watch = inject(AdminWatch);
  private readonly live = inject(AdminLive);

  /** The back-office is drawn in the browser only: the width is known from the first render. */
  private readonly wideScreen = inject(DOCUMENT).defaultView!.matchMedia(WIDE_SCREEN);
  protected readonly wide = signal(this.wideScreen.matches);
  protected readonly waiting = computed(
    () =>
      this.unreadFeedback.count() +
      this.newOrders.count() +
      this.watch.messagesCount() +
      this.watch.historyCount() +
      this.watch.trashCount() +
      this.watch.logsCount(),
  );
  /** Computers: the panel folded into a column of icons, remembered in this browser. */
  protected readonly rail = signal(readRail());
  private readonly drawer = viewChild<ElementRef<HTMLDialogElement>>('drawer');

  constructor() {
    const onWidthChange = (event: MediaQueryListEvent): void => this.wide.set(event.matches);
    this.wideScreen.addEventListener('change', onWidthChange);
    inject(DestroyRef).onDestroy(() => this.wideScreen.removeEventListener('change', onWidthChange));

    // The badges of the menu: counted when the back-office opens, at each change of section, and as soon as
    // another admin, a visitor or the site changes what they count (AdminLive)
    void this.unreadFeedback.refresh();
    void this.newOrders.refresh();
    void this.watch.refresh();
    this.live.on('FEEDBACK', () => void this.unreadFeedback.refresh());
    this.live.on('ORDERS', () => void this.newOrders.refresh());
    this.live.on('HISTORY', () => void this.watch.refreshHistory());
    this.live.on('TRASH', () => void this.watch.refreshTrash());
    this.live.on('LOGS', () => void this.watch.refreshLogs());
    this.live.on('MESSAGES', () => void this.watch.refreshMessages());
    this.live.start();
    inject(DestroyRef).onDestroy(() => this.live.stop());
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        void this.unreadFeedback.refresh();
        void this.newOrders.refresh();
        void this.watch.refresh();
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

  protected toggleRail(): void {
    this.rail.update((rail) => !rail);
    try {
      localStorage.setItem(RAIL_KEY, this.rail() ? '1' : '0');
    } catch {
      // Storage blocked: kept for this visit only
    }
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
