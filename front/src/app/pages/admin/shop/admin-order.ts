import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteShopOrder } from '../../../core/api/generated/fn/admin-shop/delete-shop-order';
import { issueInvoice } from '../../../core/api/generated/fn/admin-invoices/issue-invoice';
import { getShopOrder } from '../../../core/api/generated/fn/admin-shop/get-shop-order';
import { updateShopOrder } from '../../../core/api/generated/fn/admin-shop/update-shop-order';
import { AdminOrder as Order } from '../../../core/api/generated/models/admin-order';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { ORDER_STATUS_LABELS, OrderStatus } from '../../../shared/format/order-status';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatEuros } from '../../../shared/format/units';
import { orderTrackingLink } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { NewOrders } from './new-orders';

/** An order: what was asked, how to answer, and its status, amount and admin in charge. */
@Component({
  selector: 'yona-admin-order',
  imports: [Button, Icon, ParisDatePipe, RouterLink, Select],
  template: `
    <section class="admin-section" aria-labelledby="order-title">
      <div class="admin-section__head">
        <h2 id="order-title">Commande n° {{ id() }}</h2>
        <a yonaButton variant="ghost" routerLink="/admin/boutique/commandes"><svg yonaIcon="arrow-left"></svg>Toutes les commandes</a>
      </div>

      @if (order.value(); as current) {
        <div class="admin-panel">
          <h3>Client</h3>
          <p class="admin-row__title">{{ current.customerName }}</p>
          @if (current.customerEmail; as email) {
            <a class="link-button" [href]="'mailto:' + email"><svg yonaIcon="mail" [size]="16"></svg>{{ email }}</a>
          }
          @if (current.customerPhone; as phone) {
            <a class="link-button" [href]="'tel:' + phone"><svg yonaIcon="phone" [size]="16"></svg>{{ phone }}</a>
          }
          <p class="admin-row__meta">
            Reçue le {{ current.createdAt | parisDate }}
            @if (current.wantedOn; as wanted) {
              · souhaitée pour le {{ wanted | parisDate }}
            }
          </p>
          @if (current.message; as message) {
            <p class="message">{{ message }}</p>
          }
          <a class="link-button" target="_blank" [routerLink]="trackingLink(current)"><svg yonaIcon="external-link" [size]="16"></svg>Voir la page de suivi du client</a>
        </div>

        <div class="admin-panel">
          <h3>Contenu</h3>
          <ul role="list" class="admin-list">
            @for (line of current.lines; track $index) {
              <li class="admin-row">
                <span class="admin-row__main">
                  <span class="admin-row__title">{{ line.quantity }} × {{ line.title }}</span>
                  @if (line.portionLabel; as portions) {
                    <span class="admin-row__meta">{{ portions }}</span>
                  }
                </span>
                <span>{{ formatEuros(line.unitPrice * line.quantity) }}</span>
              </li>
            }
          </ul>
        </div>

        <div class="admin-panel">
          <h3>Facture</h3>
          @if (current.invoice; as invoice) {
            <p class="admin-row__title">N° {{ invoice.number }} du {{ invoice.issuedOn | parisDate }}</p>
            <p class="field__hint">La commande reste récupérée, à son montant, et ne se supprime plus</p>
            <a yonaButton variant="secondary" [routerLink]="['/admin/boutique/factures', invoice.id]"><svg yonaIcon="receipt"></svg>Voir la facture</a>
          } @else if (current.status !== 'PICKED_UP') {
            <p class="admin-empty">Elle se génère une fois la commande récupérée et enregistrée</p>
          } @else if (current.amount <= 0) {
            <p class="admin-empty">Une commande offerte n'a pas de facture</p>
          } @else {
            <p class="field__hint">Pour le client qui en demande une ; son numéro suit celui de la précédente</p>
            <button yonaButton variant="secondary" type="button" [disabled]="issuing()" (click)="issue(current)"><svg yonaIcon="receipt"></svg>Générer la facture</button>
          }
        </div>

        <form class="admin-panel" (submit)="save($event, current)">
          <h3>Suivi</h3>
          <div class="field">
            <span class="field__label">Statut</span>
            <yona-select label="Statut" [options]="statusOptions" [disabled]="!!current.invoice" [value]="status()" (valueChange)="status.set($event ?? status())" />
            @if (current.invoice) {
              <span class="field__hint">Facturée : elle reste récupérée</span>
            } @else if (status() === 'PICKED_UP') {
              <span class="field__hint">Une fois enregistré, le montant entre dans la comptabilité de l'admin en charge</span>
            }
          </div>
          <div class="field">
            <label class="field__label" for="order-amount">Montant (€)</label>
            <input id="order-amount" class="input" type="number" inputmode="decimal" min="0" step="0.01" [disabled]="!!current.invoice" [value]="amount()" (input)="amount.set($any($event.target).value)" />
            <span class="field__hint">Le total calculé à la commande ; à changer pour une remise ou un ajout</span>
          </div>
          <div class="field">
            <span class="field__label">En charge</span>
            <yona-select label="Admin en charge" placeholder="La personne qui enregistre" [options]="adminOptions()" [value]="handledBy()" (valueChange)="handledBy.set($event ?? null)" />
          </div>
          <div class="field">
            <label class="field__label" for="order-note">Note (visible des admins seulement)</label>
            <textarea id="order-note" class="input" rows="3" maxlength="2000" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
          </div>
          <div class="admin-toolbar">
            <button yonaButton type="submit" [disabled]="saving()"><svg yonaIcon="save"></svg>Enregistrer</button>
            @if (!current.invoice) {
              <button yonaButton variant="ghost" type="button" (click)="remove(current)"><svg yonaIcon="trash"></svg>Supprimer</button>
            }
          </div>
        </form>
      } @else if (order.isLoading()) {
        <p class="admin-empty">Chargement…</p>
      } @else {
        <p class="admin-empty">Cette commande n'existe plus</p>
      }
    </section>
  `,
  styles: `
    .message {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background-color: var(--color-bg);
      white-space: pre-line;
    }

    h3 {
      font-size: var(--text-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminOrder {
  readonly id = input.required({ transform: numberAttribute });

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly newOrders = inject(NewOrders);

  protected readonly formatEuros = formatEuros;
  protected readonly trackingLink = (order: Order) => orderTrackingLink(order.trackingToken);
  protected readonly statusOptions: SelectOption<OrderStatus>[] = (Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]).map(
    ([value, label]) => ({ value, label }),
  );
  protected readonly order = resource({
    params: () => this.id(),
    loader: ({ params }) => this.api.invoke(getShopOrder, { id: params }),
  });
  protected readonly adminOptions = computed<SelectOption<string>[]>(() => {
    const order = this.order.value();
    const admins = new Set(order?.admins ?? []);
    if (order?.handledBy) {
      admins.add(order.handledBy);
    }
    return [...admins].map((email) => ({ value: email, label: email }));
  });

  protected readonly status = signal<OrderStatus>('NEW');
  /** As typed in the field. */
  protected readonly amount = signal('');
  protected readonly handledBy = signal<string | null>(null);
  protected readonly note = signal('');
  protected readonly saving = signal(false);
  protected readonly issuing = signal(false);

  constructor() {
    effect(() => {
      const order = this.order.value();
      if (order) {
        this.status.set(order.status);
        this.amount.set(String(order.amount));
        this.handledBy.set(order.handledBy ?? null);
        this.note.set(order.adminNote ?? '');
      }
    });
  }

  protected async save(event: Event, order: Order): Promise<void> {
    event.preventDefault();
    const amount = Number(this.amount());
    if (this.amount().trim() === '' || !Number.isFinite(amount) || amount < 0) {
      this.toaster.error('Indiquez un montant positif, ou 0 pour une commande offerte');
      return;
    }
    this.saving.set(true);
    const saved = await attempt(
      this.api.invoke(updateShopOrder, {
        id: order.id,
        body: { status: this.status(), amount, adminNote: this.note().trim() || undefined, handledBy: this.handledBy() ?? undefined },
      }),
    );
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success('Commande enregistrée');
      this.order.reload();
      void this.newOrders.refresh();
    }
  }

  protected async issue(order: Order): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Générer la facture ?',
      message: `Elle sera au nom de ${order.customerName}, pour ${formatEuros(order.amount)}. Ensuite, la commande reste récupérée, à son montant, et ne se supprime plus`,
      confirmLabel: 'Générer',
    });
    if (!confirmed) {
      return;
    }
    this.issuing.set(true);
    const issued = await attempt(this.api.invoke(issueInvoice, { orderId: order.id }));
    this.issuing.set(false);
    if (issued.ok) {
      this.toaster.success(`Facture n° ${issued.value.number} générée`);
      await this.router.navigate(['/admin/boutique/factures', issued.value.id]);
    }
  }

  protected async remove(order: Order): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer cette commande ?',
      message: `La commande n° ${order.id} de ${order.customerName} sera effacée pour de bon, avec sa ligne dans la comptabilité`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteShopOrder, { id: order.id }))).ok) {
      this.toaster.success('Commande supprimée');
      void this.newOrders.refresh();
      await this.router.navigateByUrl('/admin/boutique/commandes');
    }
  }
}
