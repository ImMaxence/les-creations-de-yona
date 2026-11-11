import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { countUnseenHistory } from '../../../core/api/generated/fn/admin-history/count-unseen-history';
import { listHistory } from '../../../core/api/generated/fn/admin-history/list-history';
import { AuditEventResponse } from '../../../core/api/generated/models/audit-event-response';
import { parisDateTime } from '../../../shared/format/paris-time';
import { Icon } from '../../../shared/ui/icon/icon';
import { InfiniteList } from '../../../shared/ui/infinite-scroll/infinite-list';
import { InfiniteScroll } from '../../../shared/ui/infinite-scroll/infinite-scroll';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { AdminSession } from '../../../core/auth/admin-session';
import { AdminLive } from '../layout/admin-live';
import { AdminWatch } from '../layout/admin-watch';

type Kind = AuditEventResponse['kind'];
type Action = AuditEventResponse['action'];

const PAGE_SIZE = 20;

/** How each kind is named, and the page of the back-office showing it (with its id for a recipe). */
const KINDS: Record<Kind, { label: string; link?: string }> = {
  RECIPE: { label: 'Recette', link: '/admin/recettes' },
  CATEGORY: { label: 'Catégorie', link: '/admin/categories' },
  TAG: { label: 'Tag', link: '/admin/tags' },
  MENU: { label: 'Menu', link: '/admin/menus' },
  INGREDIENT: { label: 'Ingrédient', link: '/admin/ingredients' },
  GLOSSARY_TERM: { label: 'Mot du glossaire', link: '/admin/glossaire' },
  IMAGE: { label: 'Photo', link: '/admin/galerie' },
  TRASH: { label: 'Corbeille', link: '/admin/corbeille' },
  APPEARANCE: { label: 'Apparence', link: '/admin/apparence' },
  SITE_CONTENT: { label: 'Préférences', link: '/admin/preferences' },
  SOCIAL_LINKS: { label: 'Réseaux sociaux', link: '/admin/reseaux-sociaux' },
  BACKUP: { label: 'Sauvegarde', link: '/admin/sauvegarde' },
  GOOGLE_DRIVE: { label: 'Google Drive', link: '/admin/sauvegarde' },
  FEEDBACK: { label: 'Retours', link: '/admin/retours' },
  CAP_ENTRY: { label: 'Mon CAP', link: '/admin/mon-cap' },
  OBSERVATION: { label: 'Observation', link: '/admin/mon-cap' },
  SHOP_SETTINGS: { label: 'Réglages de la boutique', link: '/admin/boutique/produits' },
  SHOP_PRODUCT: { label: 'Produit', link: '/admin/boutique/produits' },
  SHOP_ORDER: { label: 'Commande', link: '/admin/boutique/commandes' },
  ACCOUNT_ENTRY: { label: 'Comptabilité', link: '/admin/boutique/comptabilite' },
  INVOICE: { label: 'Facture', link: '/admin/boutique/comptabilite' },
};

const ACTIONS: Record<Action, string> = {
  CREATED: 'Création',
  UPDATED: 'Modification',
  TRASHED: 'Mise à la corbeille',
  DELETED: 'Suppression',
  RESTORED: 'Restauration',
  ERASED: 'Effacement définitif',
  PUBLISHED: 'Publication',
  PUBLICATION_FAILED: 'Publication en échec',
  MERGED: 'Fusion',
  EXPORTED: 'Sauvegarde',
  IMPORTED: 'Restauration de sauvegarde',
  CONNECTED: 'Connexion',
  DISCONNECTED: 'Déconnexion',
};

/**
 * "Historique": what was done in the back-office, by whom and when, the latest first, over the
 * last 6 months (older lines are erased every night). Filtered by kind, loaded as the admin goes
 * down. An update says what it changed: each field, its value
 * before (struck through) and after; for a list, the lines removed and added.
 */
@Component({
  selector: 'yona-admin-history',
  imports: [Icon, InfiniteScroll, RouterLink, Select, Skeleton],
  template: `
    <section class="admin-section" aria-labelledby="history-title">
      <div class="admin-section__head">
        <h2 id="history-title">Historique</h2>
      </div>
      <p class="field__hint">
        Ce qui a été fait dans le back-office, par qui et quand, les 6 derniers mois. Les publications programmées sont
        faites par le site lui-même. « Nouveau » : ce que les autres ont fait depuis votre dernière visite
      </p>
      <div class="admin-toolbar">
        <yona-select label="Type" [options]="kindOptions" [value]="kind()" (valueChange)="changeKind($event)" />
      </div>

      @if (events.items().length) {
          <p class="admin-row__meta" aria-live="polite">
            {{ events.totalElements() }} action{{ events.totalElements() > 1 ? 's' : '' }}, les plus récentes d'abord
          </p>
          <ul role="list" class="admin-list admin-list--infinite" [class.is-busy]="events.isLoading()">
            @for (event of events.items(); track event.id) {
              <li class="admin-row" [class.is-new]="isNew(event)">
                <div class="admin-row__main">
                  <span class="admin-row__title">
                    @if (isNew(event)) {
                      <span class="badge badge--featured">Nouveau</span>
                    }
                    <span class="admin-label">{{ kinds[event.kind].label }}</span>
                    @if (linkOf(event); as link) {
                      <a class="link-button" [routerLink]="link">{{ event.label }}</a>
                    } @else {
                      {{ event.label }}
                    }
                  </span>
                  <span class="admin-row__meta">
                    {{ actions[event.action] }} · {{ dateTime(event.happenedAt) }} · {{ actorOf(event) }}
                  </span>
                  @if (event.changes; as changes) {
                    @if (changes.length) {
                      <details class="changes" [open]="changes.length <= openedUpTo">
                        <summary class="changes__summary">
                          {{ changes.length }} champ{{ changes.length > 1 ? 's' : '' }} modifié{{ changes.length > 1 ? 's' : '' }}
                        </summary>
                        <dl class="changes__list">
                          @for (change of changes; track $index) {
                            <div class="change">
                              <dt class="change__field">{{ change.field }}</dt>
                              <dd class="change__values">
                                <span class="change__before" [class.is-empty]="!change.before">
                                  <span class="visually-hidden">Avant : </span>{{ change.before || 'vide' }}
                                </span>
                                <svg yonaIcon="arrow-right" class="change__arrow" [size]="14"></svg>
                                <span class="change__after" [class.is-empty]="!change.after">
                                  <span class="visually-hidden">Après : </span>{{ change.after || 'vide' }}
                                </span>
                              </dd>
                            </div>
                          }
                        </dl>
                      </details>
                    } @else if (event.action === 'UPDATED') {
                      <span class="admin-row__meta">Enregistré sans changement</span>
                    }
                  }
                </div>
              </li>
            }
          </ul>
      } @else if (events.isEmpty()) {
        <p class="admin-empty">Rien pour le moment</p>
      } @else if (events.isLoading()) {
        <yona-skeleton kind="rows" [count]="6" />
      }
      <yona-infinite-scroll skeleton="rows" [list]="events" />
    </section>
  `,
  styles: `
    /* Done by the others since the last visit: a line of the accent colour on its left */
    .admin-row.is-new {
      box-shadow:
        inset 3px 0 0 var(--color-accent),
        0 0 0 1px var(--color-line);
    }

    .changes {
      margin-top: var(--space-1);
      font-size: var(--text-sm);
    }

    .changes__summary {
      width: fit-content;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-accent-strong);
      cursor: pointer;
    }

    .changes__list {
      display: grid;
      gap: var(--space-2);
      margin-top: var(--space-2);
      padding-left: var(--space-3);
      border-left: 2px solid var(--color-line);
    }

    .change__field {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-text-muted);
    }

    .change__values {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-1) var(--space-2);
      margin: 0;
    }

    /* Lists keep one line per ingredient or step; long texts wrap */
    .change__before,
    .change__after {
      min-width: 0;
      overflow-wrap: anywhere;
      white-space: pre-line;
    }

    .change__before {
      color: var(--color-text-muted);
      text-decoration: line-through;
      text-decoration-color: color-mix(in srgb, var(--color-danger) 60%, transparent);
    }

    .change__after {
      color: var(--color-text);
    }

    .is-empty {
      font-style: italic;
      text-decoration: none;
      color: var(--color-text-muted);
    }

    .change__arrow {
      flex: none;
      align-self: center;
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminHistory {
  private readonly api = inject(Api);
  private readonly session = inject(AdminSession);
  private readonly watch = inject(AdminWatch);
  /** The last visit: what the others did after it is new. Null until known. */
  private readonly since = signal<string | null>(null);

  constructor() {
    void this.markSeen();
    inject(AdminLive).on('HISTORY', () => {
      this.events.reload();
      void this.watch.historySeen();
    });
  }

  /** Read before being marked seen: the rows new at this visit stay so until the next one. */
  private async markSeen(): Promise<void> {
    try {
      this.since.set((await this.api.invoke(countUnseenHistory)).since);
    } catch {
      return;
    }
    await this.watch.historySeen();
  }

  protected isNew(event: AuditEventResponse): boolean {
    const since = this.since();
    return !!since && Date.parse(event.happenedAt) > Date.parse(since) && event.actor !== this.session.admin()?.email;
  }

  /** A few changes show at once; more, folded under their count. */
  protected readonly openedUpTo = 4;
  protected readonly kinds = KINDS;
  protected readonly actions = ACTIONS;
  protected readonly dateTime = parisDateTime;
  protected readonly kindOptions: SelectOption<Kind | 'ALL'>[] = [
    { value: 'ALL', label: 'Tout' },
    ...(Object.keys(KINDS) as Kind[]).map((kind) => ({ value: kind, label: KINDS[kind].label })),
  ];
  protected readonly kind = signal<Kind | 'ALL'>('ALL');
  protected readonly events = new InfiniteList({
    params: () => ({ kind: this.kind() }),
    load: (page, { kind }) => this.api.invoke(listHistory, { kind: kind === 'ALL' ? undefined : kind, page, size: PAGE_SIZE }),
    key: (event) => event.id,
  });

  protected changeKind(kind: Kind | 'ALL' | undefined): void {
    this.kind.set(kind ?? 'ALL');
  }

  /** A recipe opens in the editor, while it exists; the others on their page. Erased things lead nowhere. */
  protected linkOf(event: AuditEventResponse): string[] | null {
    if (event.action === 'ERASED' || event.action === 'DELETED') {
      return null;
    }
    const link = KINDS[event.kind].link;
    if (!link) {
      return null;
    }
    return event.kind === 'RECIPE' && event.targetId && event.action !== 'TRASHED' ? [link, String(event.targetId)] : [link];
  }

  protected actorOf(event: AuditEventResponse): string {
    return event.actor === 'site' ? 'le site' : event.actor;
  }
}
