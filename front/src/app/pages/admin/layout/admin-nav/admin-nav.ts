import { ChangeDetectionStrategy, Component, ElementRef, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { Icon } from '../../../../shared/ui/icon/icon';
import { IconName } from '../../../../shared/ui/icon/icons';
import { UnreadFeedback } from '../../feedback/unread-feedback';
import { NewOrders } from '../../shop/new-orders';

interface AdminLink {
  path: string;
  label: string;
  /** Under its name, from tablets up. */
  hint: string;
  icon: IconName;
  /** What waits there: unread messages, new orders. */
  count?: Signal<number>;
}

interface AdminGroup {
  id: string;
  label: string;
  links: AdminLink[];
}

/** The sections of the back-office: one bar of three entries, each opening its panel over the page. */
@Component({
  selector: 'yona-admin-nav',
  imports: [Icon, RouterLink, RouterLinkActive],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'navigation',
    'aria-label': 'Sections du back-office',
    // Hidden when printing (styles/_print.scss)
    class: 'admin__nav',
    '(document:click)': 'closeOnOutsideClick($event)',
    '(keydown.escape)': 'closeAndFocusTrigger()',
  },
})
export class AdminNav {
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  protected readonly groups: AdminGroup[] = [
    {
      id: 'blog',
      label: 'Blog',
      links: [
        { path: 'recettes', label: 'Recettes', hint: 'Écrire et publier', icon: 'book-open' },
        { path: 'categories', label: 'Catégories', hint: 'Ranger les recettes', icon: 'tags' },
        { path: 'tags', label: 'Tags', hint: 'Végétarien, de saison…', icon: 'tag' },
        { path: 'menus', label: 'Menus', hint: 'Des recettes pour une occasion', icon: 'list' },
        { path: 'ingredients', label: 'Ingrédients', hint: 'Doublons, rayons, équivalents', icon: 'carrot' },
        { path: 'glossaire', label: 'Glossaire', hint: 'Les mots de la pâtisserie', icon: 'book-a' },
        { path: 'mon-cap', label: 'Mon CAP', hint: 'Les étapes du diplôme', icon: 'graduation-cap' },
        { path: 'observations', label: 'Observations', hint: 'Les notes en cuisinant', icon: 'notebook-pen' },
      ],
    },
    {
      id: 'boutique',
      label: 'Boutique',
      links: [
        { path: 'boutique/commandes', label: 'Commandes', hint: 'Suivre et traiter', icon: 'package', count: inject(NewOrders).count },
        { path: 'boutique/produits', label: 'Produits', hint: 'Prix, ouverture de la boutique', icon: 'store' },
        { path: 'boutique/comptabilite', label: 'Comptabilité', hint: 'Entrées, dépenses, export', icon: 'receipt' },
      ],
    },
    {
      id: 'site',
      label: 'Site',
      links: [
        { path: 'statistiques', label: 'Statistiques', hint: 'Vues, stockage, à compléter', icon: 'chart-column' },
        { path: 'galerie', label: 'Galerie', hint: 'Toutes les photos', icon: 'images' },
        { path: 'retours', label: 'Retours', hint: 'Les messages des visiteurs', icon: 'message-square', count: inject(UnreadFeedback).count },
        { path: 'reseaux-sociaux', label: 'Réseaux sociaux', hint: 'Les liens du pied de page', icon: 'share-2' },
        { path: 'apparence', label: 'Apparence', hint: 'Thèmes et polices', icon: 'palette' },
        { path: 'preferences', label: 'Préférences', hint: "Les textes de l'accueil", icon: 'sliders-horizontal' },
        { path: 'sauvegarde', label: 'Sauvegarde', hint: 'Archive, Drive, restauration', icon: 'database-backup' },
        { path: 'corbeille', label: 'Corbeille', hint: 'Restaurer sous 30 jours', icon: 'trash' },
        { path: 'historique', label: 'Historique', hint: 'Qui a fait quoi', icon: 'history' },
        { path: 'nouveautes', label: 'Nouveautés', hint: 'Les dernières versions', icon: 'sparkles' },
      ],
    },
  ];
  /** The entry whose panel is open; null when they are all closed. */
  protected readonly openGroup = signal<string | null>(null);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
  }

  protected toggleGroup(id: string): void {
    this.openGroup.update((open) => (open === id ? null : id));
  }

  protected close(): void {
    this.openGroup.set(null);
  }

  /** What waits in all the sections of an entry, shown while it is closed. */
  protected groupCount(group: AdminGroup): number {
    return group.links.reduce((sum, link) => sum + (link.count?.() ?? 0), 0);
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.openGroup() && !this.host.contains(event.target as Node)) {
      this.close();
    }
  }

  protected closeAndFocusTrigger(): void {
    if (this.openGroup()) {
      this.host.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus();
      this.close();
    }
  }
}
