import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter } from 'rxjs';
import { AdminSession } from '../../auth/admin-session';
import { Favorites } from '../../kitchen/favorites';
import { ShoppingList } from '../../kitchen/shopping-list';
import { SiteData } from '../../site/site-data';
import {
  FAVORITES_PATH,
  FEEDBACK_PATH,
  GLOSSARY_PATH,
  INSTALL_PATH,
  MENUS_PATH,
  RECIPES_PATH,
  SHOPPING_LIST_PATH,
  categoryQueryParams,
} from '../../../shared/routing/links';
import { BrandIcon, socialPlatformLabel } from '../../../shared/ui/brand-icon/brand-icon';
import { BrandLogo } from '../../../shared/ui/brand-logo/brand-logo';
import { ColorSchemeSwitch } from '../color-scheme-switch/color-scheme-switch';
import { NavigationProgress } from '../navigation-progress/navigation-progress';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Phone menu: a full screen native <dialog>. showModal() brings focus trapping, Escape to close
 * and an inert page behind, without any extra code.
 *
 * After a tap on a link, the menu stays open while the next page loads, then fades out on top
 * of it: the visitor never sees the previous page flash in between.
 */
@Component({
  selector: 'yona-mobile-menu',
  imports: [
    Icon,
    RouterLink,
    RouterLinkActive,
    BrandIcon,
    BrandLogo,
    ColorSchemeSwitch,
    NavigationProgress,
  ],
  templateUrl: './mobile-menu.html',
  styleUrl: './mobile-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileMenu {
  protected readonly siteData = inject(SiteData);
  protected readonly adminSession = inject(AdminSession);
  /** Counts shown next to their link: phones have no header icons for them. */
  protected readonly favorites = inject(Favorites);
  protected readonly shoppingList = inject(ShoppingList);
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly menusPath = MENUS_PATH;
  protected readonly installPath = INSTALL_PATH;
  protected readonly glossaryPath = GLOSSARY_PATH;
  protected readonly feedbackPath = FEEDBACK_PATH;
  protected readonly favoritesPath = FAVORITES_PATH;
  protected readonly shoppingListPath = SHOPPING_LIST_PATH;
  protected readonly categoryQueryParams = categoryQueryParams;
  protected readonly socialPlatformLabel = socialPlatformLabel;

  protected readonly isOpen = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    inject(Router)
      .events.pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError ||
            // A link to the current page: no navigation happens
            event instanceof NavigationSkipped,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
  }

  protected open(): void {
    const dialog = this.dialog().nativeElement;
    dialog.showModal();
    // showModal() focuses the first link or button, and Safari then shows its focus ring after a tap
    dialog.focus();
    this.isOpen.set(true);
  }

  protected close(): void {
    if (this.isOpen()) {
      this.dialog().nativeElement.close();
    }
  }

  /** Called on every close, including Escape. */
  protected onClosed(): void {
    this.isOpen.set(false);
  }
}
