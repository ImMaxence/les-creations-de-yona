import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, resource } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { getInvoice } from '../../../core/api/generated/fn/admin-invoices/get-invoice';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatEuros } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { adjustment, formatSiret, invoiceTitle } from './invoice-format';

/**
 * An invoice as issued: a sheet to print, or to save as PDF from the print dialog (under its
 * number). It never changes: the seller's details and the lines were copied when it was issued.
 */
@Component({
  selector: 'yona-admin-invoice',
  imports: [Button, Icon, ParisDatePipe, RouterLink],
  template: `
    <section class="admin-section" aria-labelledby="invoice-title">
      @if (invoice.value(); as current) {
        <div class="admin-section__head no-print">
          <h2 id="invoice-title">Facture n° {{ current.number }}</h2>
          <div class="admin-section__actions">
            <a yonaButton variant="ghost" [routerLink]="['/admin/boutique/commandes', current.orderId]"><svg yonaIcon="arrow-left"></svg>Commande n° {{ current.orderId }}</a>
            <button yonaButton type="button" (click)="print()"><svg yonaIcon="printer"></svg>Imprimer ou enregistrer en PDF</button>
          </div>
        </div>

        <article class="sheet" aria-label="Facture">
          <header class="sheet__head">
            <div class="sheet__seller">
              <strong class="sheet__name">{{ current.sellerName }}</strong>
              @if (current.sellerAddress; as address) {
                <span class="sheet__address">{{ address }}</span>
              }
              @if (current.sellerSiret; as siret) {
                <span>SIRET {{ formatSiret(siret) }}</span>
              }
              @if (current.sellerContact; as contact) {
                <span>{{ contact }}</span>
              }
            </div>
            <div class="sheet__title">
              <p class="sheet__kind">Facture</p>
              <dl class="sheet__facts">
                <dt>Numéro</dt>
                <dd>{{ current.number }}</dd>
                <dt>Date</dt>
                <dd>{{ current.issuedOn | parisDate }}</dd>
                <dt>Commande</dt>
                <dd>n° {{ current.orderId }}</dd>
              </dl>
            </div>
          </header>

          <div class="sheet__customer">
            <p class="sheet__label">Client</p>
            <strong>{{ current.customerName }}</strong>
            @if (current.customerEmail; as email) {
              <span>{{ email }}</span>
            }
            @if (current.customerPhone; as phone) {
              <span>{{ phone }}</span>
            }
          </div>

          <table class="sheet__lines">
            <thead>
              <tr>
                <th scope="col">Désignation</th>
                <th scope="col" class="is-number">Quantité</th>
                <th scope="col" class="is-number">Prix unitaire</th>
                <th scope="col" class="is-number">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (line of current.lines; track $index) {
                <tr>
                  <td>
                    {{ line.label }}
                    @if (line.detail; as detail) {
                      <span class="sheet__detail">{{ detail }}</span>
                    }
                  </td>
                  <td class="is-number">{{ line.quantity }}</td>
                  <td class="is-number">{{ formatEuros(line.unitPrice) }}</td>
                  <td class="is-number">{{ formatEuros(line.total) }}</td>
                </tr>
              }
            </tbody>
          </table>

          <dl class="sheet__totals">
            @if (change(); as difference) {
              <div>
                <dt>Total des articles</dt>
                <dd>{{ formatEuros(current.linesTotal) }}</dd>
              </div>
              <div>
                <dt>{{ difference.label }}</dt>
                <dd>{{ formatEuros(difference.value) }}</dd>
              </div>
            }
            <div class="sheet__total">
              <dt>Total à payer</dt>
              <dd>{{ formatEuros(current.amount) }}</dd>
            </div>
          </dl>

          <footer class="sheet__foot">
            <p>{{ current.vatMention }}</p>
            <p>Réglée à la remise de la commande</p>
          </footer>
        </article>
      } @else if (invoice.isLoading()) {
        <p class="admin-empty">Chargement…</p>
      } @else {
        <p class="admin-empty">Cette facture n'existe pas</p>
      }
    </section>
  `,
  styles: `
    .sheet {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      max-width: 52rem;
      padding: clamp(var(--space-5), 5vw, var(--space-7));
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);
      font-size: var(--text-sm);
      line-height: 1.5;
    }

    .sheet__head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--space-5);
    }

    .sheet__seller,
    .sheet__customer {
      display: flex;
      flex-direction: column;
    }

    .sheet__name {
      font-size: var(--text-base);
    }

    .sheet__address {
      white-space: pre-line;
    }

    .sheet__kind {
      margin: 0 0 var(--space-2);
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      line-height: 1;
    }

    .sheet__facts {
      display: grid;
      grid-template-columns: auto auto;
      gap: var(--space-1) var(--space-4);
      margin: 0;

      dt {
        color: var(--color-text-muted);
      }

      dd {
        margin: 0;
        font-weight: 600;
      }
    }

    .sheet__label {
      margin: 0 0 var(--space-1);
      color: var(--color-text-muted);
      font-size: var(--text-xs);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sheet__lines {
      width: 100%;
      border-collapse: collapse;

      th,
      td {
        padding: var(--space-2) var(--space-2);
        border-bottom: 1px solid var(--color-line);
        text-align: left;
        vertical-align: top;
      }

      th {
        color: var(--color-text-muted);
        font-size: var(--text-xs);
        font-weight: 600;
      }

      .is-number {
        text-align: right;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
    }

    .sheet__detail {
      display: block;
      color: var(--color-text-muted);
      font-size: var(--text-xs);
    }

    .sheet__totals {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      align-self: flex-end;
      min-width: min(18rem, 100%);
      margin: 0;

      div {
        display: flex;
        justify-content: space-between;
        gap: var(--space-6);
      }

      dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
    }

    .sheet__total {
      padding-top: var(--space-2);
      border-top: 2px solid var(--color-text);
      font-size: var(--text-base);
      font-weight: 700;
    }

    .sheet__foot {
      color: var(--color-text-muted);

      p {
        margin: 0;
      }
    }

    @media print {
      .sheet {
        max-width: none;
        padding: 0;
        border: 0;
        font-size: 10.5pt;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminInvoice {
  readonly id = input.required({ transform: numberAttribute });

  private readonly api = inject(Api);
  private readonly title = inject(Title);

  protected readonly formatEuros = formatEuros;
  protected readonly formatSiret = formatSiret;
  protected readonly invoice = resource({
    params: () => this.id(),
    loader: ({ params }) => this.api.invoke(getInvoice, { id: params }),
  });
  protected readonly change = computed(() => {
    const invoice = this.invoice.value();
    return invoice ? adjustment(invoice.amount, invoice.linesTotal) : null;
  });

  constructor() {
    effect(() => {
      const invoice = this.invoice.value();
      if (invoice) {
        this.title.setTitle(invoiceTitle(invoice.number));
      }
    });
  }

  protected print(): void {
    window.print();
  }
}
