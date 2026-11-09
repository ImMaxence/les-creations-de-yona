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
  MENUS_PATH,
  CAP_PATH,
  RECIPES_PATH,
  SHOP_PATH,
  SHOPPING_LIST_PATH,
} from '../../../shared/routing/links';
import { BrandIcon, socialPlatformLabel } from '../../../shared/ui/brand-icon/brand-icon';
import { BrandLogo } from '../../../shared/ui/brand-logo/brand-logo';
import { SiteSearch } from '../../../shared/ui/site-search/site-search';
import { ColorSchemeSwitch } from '../color-scheme-switch/color-scheme-switch';
import { NavigationProgress } from '../navigation-progress/navigation-progress';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icons';

interface MenuLink {
  path: string;
  label: string;
  icon: IconName;
  /** Marked as current on this very page only, not on the pages under it. */
  exact?: boolean;
  /** How many it holds, and of what. */
  count?: number;
  unit?: string;
}

/** Several pages under one entry, unfolded on the spot. */
interface MenuSection {
  id: string;
  label: string;
  /** What is inside, while it is folded. */
  hint: string;
  icon: IconName;
  links: MenuLink[];
  /** Categories only: Salé, then Sucré. */
  themes: ReturnType<typeof themeGroupsOf>;
  count: number;
}

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
  /** One tap, one page. */
  protected readonly pages = computed(() => {
    const pages: MenuLink[] = [
      { path: '/', label: 'Accueil', icon: 'house', exact: true },
      { path: RECIPES_PATH, label: 'Toutes les recettes', icon: 'book-open', exact: true },
    ];
    if (this.siteData.menus().length) {
      pages.push({ path: MENUS_PATH, label: 'Menus', icon: 'utensils-crossed' });
    }
    if (this.siteData.capPublished()) {
      pages.push({ path: CAP_PATH, label: 'Mon CAP', icon: 'graduation-cap' });
    }
    if (this.siteData.shopOpen()) {
      pages.push({ path: SHOP_PATH, label: 'Boutique', icon: 'store' });
    }
    if (this.adminSession.isAdmin()) {
      pages.push({ path: '/admin', label: 'Administration', icon: 'lock' });
    }
    return pages;
  });
  protected readonly sections = computed(() => {
    const sections: MenuSection[] = [];
    const themes = themeGroupsOf(this.siteData.categories());
    if (themes.some((theme) => theme.categories.length)) {
      sections.push({ id: 'categories', label: 'Catégories', hint: 'Salé et sucré', icon: 'layout-grid', links: [], themes, count: 0 });
    }
    const favorites = this.favorites.count();
    const shoppingList = this.shoppingList.count();
    sections.push(
      {
        id: 'kitchen',
        label: 'Ma cuisine',
        hint: 'Favoris, courses, glossaire',
        icon: 'cooking-pot',
        links: [
          { path: FAVORITES_PATH, label: 'Mes favoris', icon: 'heart', count: favorites, unit: 'recette' },
          { path: SHOPPING_LIST_PATH, label: 'Ma liste de courses', icon: 'shopping-basket', count: shoppingList, unit: 'élément' },
          { path: GLOSSARY_PATH, label: 'Glossaire', icon: 'book-a' },
        ],
        themes: [],
        count: favorites + shoppingList,
      },
      {
        id: 'site',
        label: 'Le site',
        hint: 'À propos, avis, application',
        icon: 'info',
        links: [
          { path: ABOUT_PATH, label: 'À propos de Yona', icon: 'chef-hat' },
          { path: FEEDBACK_PATH, label: 'Donner mon avis', icon: 'message-square' },
          { path: INSTALL_PATH, label: "Installer l'application", icon: 'smartphone' },
        ],
        themes: [],
        count: 0,
      },
    );
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

  /** A section unfolded near the bottom of the screen would run past it. */
  protected reveal(event: Event): void {
    const section = event.target as HTMLDetailsElement;
    if (section.open) {
      section.scrollIntoView({ block: 'nearest' });
    }
  }

  /** Called on every close, including Escape. */
  protected onClosed(): void {
    this.isOpen.set(false);
  }
}
