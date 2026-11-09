import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Signal,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
  output,
  resource,
  signal,
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


interface AdminLink {
  path: string;
  label: string;
  icon: IconName;
  /** What waits there: unread messages, new orders. */
  count?: Signal<number>;
}

interface AdminGroup {
  id: string;
  label: string;
  /** In the drawer, where each group is a card. */
  icon: IconName;
  links: AdminLink[];
}

/**
 * What the back-office panel holds: every section, grouped, then the account of the admin. A
 * compact side panel on computers; with `drawer`, large rows and groups that unfold, for the thumb.
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
  /** "Fermer le menu", in the drawer. */
  readonly closed = output();

  protected readonly session = inject(AdminSession);
  private readonly toaster = inject(Toaster);
  private readonly router = inject(Router);
  private readonly api = inject(Api);

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
        { path: 'observations', label: 'Observations', icon: 'notebook-pen' },
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
        { path: 'historique', label: 'Historique', icon: 'history' },
        { path: 'nouveautes', label: 'Nouveautés', icon: 'sparkles' },
      ],
    },
  ];
  /** In the drawer: the group unfolded, the one holding the page shown to start with. */
  protected readonly openGroup = signal(this.currentGroup());

  constructor() {
    // The list scrolls: on arrival, the section shown must not be below the fold
    const host: HTMLElement = inject(ElementRef).nativeElement;
    afterNextRender(() => requestAnimationFrame(() => host.querySelector('.link.is-active')?.scrollIntoView({ block: 'nearest' })));

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.openGroup.set(this.currentGroup()));
  }

  protected toggleGroup(id: string): void {
    this.openGroup.update((open) => (open === id ? null : id));
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
