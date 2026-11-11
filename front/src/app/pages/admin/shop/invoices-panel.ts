import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { listInvoices } from '../../../core/api/generated/fn/admin-invoices/list-invoices';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatEuros } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { InvoiceSettingsDialog } from './invoice-settings-dialog';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';

/** The invoices issued in a year, latest first, and the seller's details they carry. */
@Component({
  selector: 'yona-invoices-panel',
  imports: [Button, Icon, InvoiceSettingsDialog, ParisDatePipe, RouterLink, Skeleton],
  template: `
    <div class="admin-panel">
      <div class="head">
        <h3>Factures · {{ year() }}</h3>
        <button yonaButton variant="secondary" type="button" (click)="settingsOpen.set(true)"><svg yonaIcon="pencil"></svg>Informations de facturation</button>
      </div>
      @if (invoices.value(); as list) {
        @if (list.length) {
          <ul role="list" class="admin-list">
            @for (invoice of list; track invoice.id) {
              <li class="admin-row">
                <span class="admin-row__main">
                  <a class="admin-row__title" [routerLink]="['/admin/boutique/factures', invoice.id]">N° {{ invoice.number }}</a>
                  <span class="admin-row__meta">{{ invoice.issuedOn | parisDate }} · {{ invoice.customerName }} · commande n° {{ invoice.orderId }}</span>
                </span>
                <span>{{ formatEuros(invoice.amount) }}</span>
              </li>
            }
          </ul>
          <p class="field__hint">{{ list.length }} facture{{ list.length > 1 ? 's' : '' }} pour {{ formatEuros(total()) }}</p>
        } @else {
          <p class="admin-empty">Aucune facture en {{ year() }}. Elle se génère depuis une commande récupérée</p>
        }
      } @else if (invoices.isLoading()) {
        <yona-skeleton kind="rows" [count]="3" />
      }
    </div>
    <yona-invoice-settings-dialog [(open)]="settingsOpen" />
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesPanel {
  readonly year = input.required<number>();

  private readonly api = inject(Api);

  protected readonly formatEuros = formatEuros;
  protected readonly settingsOpen = signal(false);
  protected readonly invoices = resource({
    params: () => this.year(),
    loader: ({ params }) => this.api.invoke(listInvoices, { year: params }),
  });
  protected readonly total = computed(() => Math.round((this.invoices.value() ?? []).reduce((sum, invoice) => sum + invoice.amount, 0) * 100) / 100);
}
