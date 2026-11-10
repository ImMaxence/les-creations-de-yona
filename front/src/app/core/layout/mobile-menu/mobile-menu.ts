import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
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
import { themeGroupsOf } from '../../../shared/format/themes';
import {
  ABOUT_PATH,
  FAVORITES_PATH,
  FEEDBACK_PATH,
  GLOSSARY_PATH,
  INSTALL_PATH,
  ACCESSIBILITY_PATH,
  MENUS_PATH,
  CAP_PATH,
  RECIPES_PATH,
  SHOP_PATH,
  SHOPPING_LIST_PATH,
} from '../../../shared/routing/links';
import { BrandIcon, socialPlatformLabel } from '../../../shared/ui/brand-icon/brand-icon';
import { SiteSearch } from '../../../shared/ui/site-search/site-search';
import { ColorSchemeSwitch } from '../color-scheme-switch/color-scheme-switch';
import { NavigationProgress } from '../navigation-progress/navigation-progress';
import { Icon } from '../../../shared/ui/icon/icon';

/** One page: an arrow leads there. */
interface MenuPage {
  label: string;
  path: string;
  /** Marked as current on this very page only, not on the pages under it. */
  exact?: boolean;
}

/** A page inside a section. */
interface MenuLink {
  path: string;
  label: string;
  /** How many it holds, and of what. */
  count?: number;
  unit?: string;
}

/** Several pages under one entry: a plus unfolds them on the spot. */
interface MenuSection {
  id: string;
  label: string;
  links: MenuLink[];
  /** Categories only: Sucré, then Salé. */
  themes: ReturnType<typeof themeGroupsOf>;
  count: number;
}

function page(path: string, label: string, exact = false): MenuPage {
  return { path, label, exact };
}

/**
 * Phone menu: a full screen native <dialog>. showModal() brings focus trapping, Escape to close
 * and an inert page behind, without any extra code.
 *
 * After a tap on a link, the menu stays open while the next page loads, then closes on top of
 * it: the visitor never sees the previous page flash in between.
 */
@Component({
  selector: 'yona-mobile-menu',
  imports: [
    Icon,
    RouterLink,
    RouterLinkActive,
    BrandIcon,
    ColorSchemeSwitch,
    NavigationProgress,
    SiteSearch,
  ],
  templateUrl: './mobile-menu.html',
  styleUrl: './mobile-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileMenu {
  protected readonly siteData = inject(SiteData);
  protected readonly adminSession = inject(AdminSession);
  /** Counts shown next to their link: phones have no header icons for them. */
  private readonly favorites = inject(Favorites);
  private readonly shoppingList = inject(ShoppingList);
  protected readonly recipesPath = RECIPES_PATH;
  /** One tap, one page; all together, for the visitor to know what the arrow does. */
  protected readonly pages = computed(() => {
    const pages = [page('/', 'Accueil', true), page(RECIPES_PATH, 'Recettes')];
    if (this.siteData.menus().length) {
      pages.push(page(MENUS_PATH, 'Menus'));
    }
    if (this.siteData.capPublished()) {
      pages.push(page(CAP_PATH, 'Mon CAP'));
    }
    if (this.siteData.shopOpen()) {
      pages.push(page(SHOP_PATH, 'Boutique'));
    }
    if (this.adminSession.isAdmin()) {
      pages.push(page('/admin', 'Administration'));
    }
    return pages;
  });
  /** Several pages under one entry, after the pages. */
  protected readonly sections = computed(() => {
    const themes = themeGroupsOf(this.siteData.categories());
    const favorites = this.favorites.count();
    const shoppingList = this.shoppingList.count();
    const sections: MenuSection[] = [
      {
        id: 'kitchen',
        label: 'Ma cuisine',
        links: [
          { path: FAVORITES_PATH, label: 'Mes favoris', count: favorites, unit: 'recette' },
          { path: SHOPPING_LIST_PATH, label: 'Ma liste de courses', count: shoppingList, unit: 'élément' },
          { path: GLOSSARY_PATH, label: 'Glossaire' },
        ],
        themes: [],
        count: favorites + shoppingList,
      },
      {
        id: 'site',
        label: 'Le site',
        links: [
          { path: ABOUT_PATH, label: 'À propos de Yona' },
          { path: FEEDBACK_PATH, label: 'Donner mon avis' },
          { path: INSTALL_PATH, label: "Installer l'application" },
          { path: ACCESSIBILITY_PATH, label: 'Accessibilité' },
        ],
        themes: [],
        count: 0,
      },
    ];
    if (themes.some((theme) => theme.categories.length)) {
      sections.unshift({ id: 'categories', label: 'Catégories', links: [], themes, count: 0 });
    }
    return sections;
  });
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
    // The section holding the page shown comes unfolded, for that page to be seen
    dialog.querySelectorAll('details').forEach((section) => (section.open = !!section.querySelector('.sub.is-active')));
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
