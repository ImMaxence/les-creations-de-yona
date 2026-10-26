import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminSession } from '../../auth/admin-session';
import { SiteData } from '../../site/site-data';
import { INSTALL_PATH, RECIPES_PATH } from '../../../shared/routing/links';
import { BrandLogo } from '../../../shared/ui/brand-logo/brand-logo';
import { CategoryMenu } from '../category-menu/category-menu';
import { ColorSchemeSwitch } from '../color-scheme-switch/color-scheme-switch';
import { KitchenLinks } from '../kitchen-links/kitchen-links';
import { MobileMenu } from '../mobile-menu/mobile-menu';

/** Below this scroll position, the header always stays visible. */
const ALWAYS_VISIBLE_UNTIL_PX = 160;
/** Ignores the small jitters of touch scrolling. */
const SCROLL_DIRECTION_THRESHOLD_PX = 6;

@Component({
  selector: 'yona-header',
  imports: [RouterLink, RouterLinkActive, BrandLogo, CategoryMenu, ColorSchemeSwitch, KitchenLinks, MobileMenu],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-scrolled]': 'scrolled()',
    '[class.is-hidden]': 'hidden()',
    '(window:scroll)': 'onScroll()',
  },
})
export class Header {
  protected readonly siteData = inject(SiteData);
  protected readonly adminSession = inject(AdminSession);
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly installPath = INSTALL_PATH;

  protected readonly scrolled = signal(false);
  /** Hidden while reading down the page, back as soon as the reader scrolls up. */
  protected readonly hidden = signal(false);
  private lastScrollY = 0;

  protected onScroll(): void {
    const scrollY = window.scrollY;
    this.scrolled.set(scrollY > 8);
    if (Math.abs(scrollY - this.lastScrollY) < SCROLL_DIRECTION_THRESHOLD_PX) {
      return;
    }
    this.hidden.set(scrollY > this.lastScrollY && scrollY > ALWAYS_VISIBLE_UNTIL_PX);
    this.lastScrollY = scrollY;
  }
}
