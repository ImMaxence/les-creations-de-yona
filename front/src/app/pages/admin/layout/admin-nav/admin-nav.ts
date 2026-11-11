import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Signal,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { Api } from '../../../../core/api/generated/api';
import { getVersion } from '../../../../core/api/generated/fn/admin-version/get-version';
import { AdminSession } from '../../../../core/auth/admin-session';
import { ColorSchemeSwitch } from '../../../../core/layout/color-scheme-switch/color-scheme-switch';
import { Toaster } from '../../../../core/notifications/toaster';
import { FRONT_VERSION } from '../../../../core/version';
import { ADMIN_PATH } from '../../../../shared/routing/links';
import { BrandLogo } from '../../../../shared/ui/brand-logo/brand-logo';
import { Icon } from '../../../../shared/ui/icon/icon';
import { IconName } from '../../../../shared/ui/icon/icons';
import { UnreadFeedback } from '../../feedback/unread-feedback';
import { NewOrders } from '../../shop/new-orders';
import { AdminAvatar } from '../admin-avatar/admin-avatar';
import { AdminWatch } from '../admin-watch';


interface AdminLink {
  path: string;
  label: string;
  icon: IconName;
  /** What waits there: unread messages, new orders, changes of the others, new errors. */
  count?: Signal<number>;
  /** Read after the count: "3 en attente", "3 nouvelles erreurs". */
  countLabel?: string;
  /** A word rather than a number: "Nouveau" on a changelog not read yet. */
  badge?: Signal<string | null>;
}

interface AdminGroup {
  id: string;
  label: string;
  icon: IconName;
  links: AdminLink[];
}

const CLOSED_GROUPS_KEY = 'admin-closed-groups';

/** Read at once, the panel must not fold before the eyes: the back-office is not rendered by the server. */
function readClosedGroups(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CLOSED_GROUPS_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/**
 * What the back-office panel holds: every section, grouped, then the account of the admin. A
 * compact side panel on computers, its groups opened and closed at will and remembered; with
 * `drawer`, large rows and one group open at a time, for the thumb.
 */
@Component({
  selector: 'yona-admin-nav',
  imports: [AdminAvatar, BrandLogo, ColorSchemeSwitch, Icon, RouterLink, RouterLinkActive],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-drawer]': 'drawer()' },
})
export class AdminNav {
  readonly drawer = input(false, { transform: booleanAttribute });
  /** Folded into a column of icons (computers): every section in sight, each named on hover. */
  readonly rail = input(false, { transform: booleanAttribute });
  /** "Replier le menu" or "Déplier le menu". */
  readonly railToggled = output();
  /** "Fermer le menu", in the drawer. */
  readonly closed = output();

  protected readonly session = inject(AdminSession);
  private readonly toaster = inject(Toaster);
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  private readonly watch = inject(AdminWatch);

  protected readonly frontVersion = FRONT_VERSION;
  /** Loaded once with the back-office; shown as "…" until then. */
  protected readonly backVersion = resource({ loader: () => this.api.invoke(getVersion) });

  protected readonly groups: AdminGroup[] = [
    {
      id: 'blog',
      label: 'Blog',
      icon: 'book-open',
      links: [
        { path: 'recettes', label: 'Recettes', icon: 'book-open' },
        { path: 'categories', label: 'Catégories', icon: 'tags' },
        { path: 'tags', label: 'Tags', icon: 'tag' },
        { path: 'menus', label: 'Menus', icon: 'list' },
        { path: 'ingredients', label: 'Ingrédients', icon: 'carrot' },
        { path: 'glossaire', label: 'Glossaire', icon: 'book-a' },
        { path: 'mon-cap', label: 'Mon CAP', icon: 'graduation-cap' },
      ],
    },
    {
      id: 'boutique',
      label: 'Boutique',
      icon: 'store',
      links: [
        { path: 'boutique/commandes', label: 'Commandes', icon: 'package', count: inject(NewOrders).count },
        { path: 'boutique/produits', label: 'Produits', icon: 'store' },
        { path: 'boutique/comptabilite', label: 'Comptabilité', icon: 'receipt' },
      ],
    },
    {
      id: 'site',
      label: 'Site',
      icon: 'sliders-horizontal',
      links: [
        { path: 'statistiques', label: 'Statistiques', icon: 'chart-column' },
        { path: 'galerie', label: 'Galerie', icon: 'images' },
        { path: 'retours', label: 'Retours', icon: 'message-square', count: inject(UnreadFeedback).count },
        { path: 'reseaux-sociaux', label: 'Réseaux sociaux', icon: 'share-2' },
        { path: 'apparence', label: 'Apparence', icon: 'palette' },
        { path: 'preferences', label: 'Préférences', icon: 'sliders-horizontal' },
        { path: 'sauvegarde', label: 'Sauvegarde', icon: 'database-backup' },
        { path: 'corbeille', label: 'Corbeille', icon: 'trash' },
        { path: 'historique', label: 'Historique', icon: 'history', count: this.watch.historyCount, countLabel: 'changements à voir' },
        { path: 'journaux', label: 'Journaux', icon: 'scroll-text', count: this.watch.logsCount, countLabel: 'nouvelles erreurs' },
        {
          path: 'nouveautes',
          label: 'Nouveautés',
          icon: 'sparkles',
          badge: computed(() => (this.watch.changelogNew() ? 'Nouveau' : null)),
        },
      ],
    },
  ];
  /** The one holding the page shown is always open on arrival. */
  protected readonly openGroups = linkedSignal<ReadonlySet<string>>(() => {
    const current = this.currentGroup();
    if (this.drawer()) {
      return new Set(current ? [current] : []);
    }
    const closed = readClosedGroups();
    return new Set(this.groups.map((group) => group.id).filter((id) => id === current || !closed.includes(id)));
  });

  constructor() {
    // The list scrolls: on arrival, the section shown must not be below the fold
    const host: HTMLElement = inject(ElementRef).nativeElement;
    afterNextRender(() => requestAnimationFrame(() => host.querySelector('.link.is-active')?.scrollIntoView({ block: 'nearest' })));

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const current = this.currentGroup();
        if (current) {
          this.openGroups.update((open) => (this.drawer() ? new Set([current]) : new Set(open).add(current)));
        }
      });
  }

  protected isOpen(id: string): boolean {
    return this.openGroups().has(id);
  }

  protected toggleGroup(id: string): void {
    const open = new Set(this.openGroups());
    if (!open.delete(id)) {
      if (this.drawer()) {
        open.clear();
      }
      open.add(id);
    }
    this.openGroups.set(open);
    if (!this.drawer()) {
      this.rememberClosedGroups(open);
    }
  }

  private rememberClosedGroups(open: ReadonlySet<string>): void {
    try {
      localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify(this.groups.map((group) => group.id).filter((id) => !open.has(id))));
    } catch {
      // Storage blocked or full: kept for this visit only
    }
  }

  /** Without a number, a dot: a section has something new ("Nouveautés"). */
  protected groupHasNews(group: AdminGroup): boolean {
    return group.links.some((link) => !!link.badge?.());
  }

  /** Folded, the name of a section says what waits there too. */
  protected railLabel(link: AdminLink): string {
    const count = link.count?.() ?? 0;
    const badge = link.badge?.();
    return count ? `${link.label} (${count} ${link.countLabel ?? 'en attente'})` : badge ? `${link.label} (${badge.toLowerCase()})` : link.label;
  }

  /** What waits in all the sections of an entry, shown while it is closed. */
  protected groupCount(group: AdminGroup): number {
    return group.links.reduce((sum, link) => sum + (link.count?.() ?? 0), 0);
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    this.toaster.success('Vous êtes déconnecté');
    await this.router.navigateByUrl('/');
  }

  private currentGroup(): string | null {
    const url = this.router.url;
    return this.groups.find((group) => group.links.some((link) => url.startsWith(`${ADMIN_PATH}/${link.path}`)))?.id ?? null;
  }
}
