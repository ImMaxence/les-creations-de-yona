import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { listShopOrders } from '../../../core/api/generated/fn/admin-shop/list-shop-orders';
import { OrderAlerts } from '../../../core/pwa/order-alerts';
import { ORDER_STATUS_LABELS, OrderStatus, orderStatusBadge } from '../../../shared/format/order-status';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatEuros } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { Select, SelectOption } from '../../../shared/ui/select/select';

const PAGE_SIZE = 20;

type StatusFilter = OrderStatus | 'ALL';

/** The orders sent from the shop, the latest first. */
@Component({
  selector: 'yona-admin-orders',
  imports: [Button, Icon, Pagination, ParisDatePipe, RouterLink, Select],
  template: `
    <section class="admin-section" aria-labelledby="orders-title">
      <div class="admin-section__head">
        <h2 id="orders-title">Commandes</h2>
      </div>

      <div class="admin-panel">
        <div class="admin-toolbar">
          <svg yonaIcon="bell" [size]="20"></svg>
          <div class="admin-row__main">
            <span class="admin-row__title">Être prévenu·e sur cet appareil</span>
            <span class="field__hint">
              @switch (alerts.state()) {
                @case ('on') {
                  Cet appareil reçoit une notification à chaque nouvelle commande
                }
                @case ('blocked') {
                  Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur
                }
                @case ('install-first') {
                  Sur iPhone et iPad, installez d'abord le site sur l'écran d'accueil puis ouvrez-le depuis l'icône
                }
                @case ('unsupported') {
                  Cet appareil ou ce navigateur ne peut pas recevoir de notifications
                }
                @default {
                  Une notification à chaque nouvelle commande, même site fermé
                }
              }
            </span>
          </div>
          @if (alerts.state() === 'on') {
            <button yonaButton variant="secondary" type="button" [disabled]="alerts.busy()" (click)="alerts.disable()">Ne plus me prévenir</button>
          } @else if (alerts.state() === 'off') {
            <button yonaButton type="button" [disabled]="alerts.busy()" (click)="alerts.enable()"><svg yonaIcon="bell"></svg>Me prévenir</button>
          }
        </div>
      </div>

      <div class="admin-toolbar">
        <yona-select label="Statut" [options]="statusOptions" [value]="status()" (valueChange)="chooseStatus($event)" />
      </div>

      @if (orders.value(); as result) {
        @if (result.content.length) {
          <ul role="list" class="admin-list">
            @for (order of result.content; track order.id) {
              <li class="admin-row">
                <span class="admin-row__main">
                  <a class="admin-row__title" [routerLink]="['/admin/boutique/commandes', order.id]">N° {{ order.id }} · {{ order.customerName }}</a>
                  <span class="admin-row__meta">
                    <span class="badge" [class]="badge(order.status)">{{ labels[order.status] }}</span>
                    {{ order.itemCount }} article{{ order.itemCount > 1 ? 's' : '' }} · {{ formatEuros(order.amount) }}
                    @if (order.wantedOn; as wanted) {
                      · pour le {{ wanted | parisDate }}
                    }
                    · reçue le {{ order.createdAt | parisDate }}
                  </span>
                </span>
                <div class="admin-row__actions">
                  <a class="icon-button" aria-label="Ouvrir la commande" [routerLink]="['/admin/boutique/commandes', order.id]"><svg yonaIcon="arrow-right" [size]="18"></svg></a>
                </div>
              </li>
            }
          </ul>
          @if (result.totalPages > 1) {
            <yona-pagination buttons [page]="page() + 1" [totalPages]="result.totalPages" (pageChange)="page.set($event - 1)" />
          }
        } @else {
          <p class="admin-empty">Aucune commande pour le moment</p>
        }
      } @else if (orders.isLoading()) {
        <p class="admin-empty">Chargement…</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminOrders {
  /** ?statut=NEW, to come back to a filtered list. */
  readonly statut = input<StatusFilter>();

  private readonly api = inject(Api);
  protected readonly alerts = inject(OrderAlerts);

  protected readonly labels = ORDER_STATUS_LABELS;
  protected readonly badge = orderStatusBadge;
  protected readonly formatEuros = formatEuros;
  protected readonly statusOptions: SelectOption<StatusFilter>[] = [
    { value: 'ALL', label: 'Tous les statuts' },
    ...(Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]).map(([value, label]) => ({ value, label })),
  ];
  protected readonly status = linkedSignal<StatusFilter>(() => this.statut() ?? 'ALL');
  protected readonly page = signal(0);
  protected readonly orders = resource({
    params: () => ({ status: this.status(), page: this.page() }),
    loader: ({ params }) =>
      this.api.invoke(listShopOrders, {
        status: params.status === 'ALL' ? undefined : params.status,
        page: params.page,
        size: PAGE_SIZE,
      }),
  });

  protected chooseStatus(status: StatusFilter | undefined): void {
    this.status.set(status ?? 'ALL');
    this.page.set(0);
  }
}
