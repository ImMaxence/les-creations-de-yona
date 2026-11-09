import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { createAccountEntry } from '../../../core/api/generated/fn/admin-accounting/create-account-entry';
import { deleteAccountEntry } from '../../../core/api/generated/fn/admin-accounting/delete-account-entry';
import { exportAccounting } from '../../../core/api/generated/fn/admin-accounting/export-accounting';
import { getAccounting } from '../../../core/api/generated/fn/admin-accounting/get-accounting';
import { updateAccountEntry } from '../../../core/api/generated/fn/admin-accounting/update-account-entry';
import { AccountEntryResponse } from '../../../core/api/generated/models/account-entry-response';
import { AdminSession } from '../../../core/auth/admin-session';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatEuros } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { Select, SelectOption } from '../../../shared/ui/select/select';

type Kind = AccountEntryResponse['kind'];
type Category = AccountEntryResponse['category'];

const CATEGORY_LABELS: Record<Category, string> = {
  SALE: 'Vente',
  INGREDIENTS: 'Ingrédients',
  PACKAGING: 'Emballages',
  EQUIPMENT: 'Matériel',
  OTHER: 'Autre',
};

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** Today in Paris, as the date field wants it. */
function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/**
 * The accounts of the shop: the orders handed over come in by themselves, the rest is typed here,
 * each line counted for an admin. Totals by month and by admin, CSV for a spreadsheet.
 */
@Component({
  selector: 'yona-admin-accounting',
  imports: [Button, Icon, ParisDatePipe, RouterLink, Select],
  template: `
    <section class="admin-section" aria-labelledby="accounting-title">
      <div class="admin-section__head">
        <h2 id="accounting-title">Comptabilité</h2>
        <div class="admin-section__actions">
          <yona-select label="Année" [options]="yearOptions()" [value]="year()" (valueChange)="year.set($event ?? year())" />
          <a yonaButton variant="secondary" [href]="exportLink()" download><svg yonaIcon="download"></svg>Exporter en CSV</a>
        </div>
      </div>

      @if (overview.value(); as data) {
        <div class="totals">
          <div class="total">
            <span class="total__label">Entrées</span>
            <strong class="total__value">{{ formatEuros(data.totals.income) }}</strong>
          </div>
          <div class="total">
            <span class="total__label">Dépenses</span>
            <strong class="total__value">{{ formatEuros(data.totals.expense) }}</strong>
          </div>
          <div class="total">
            <span class="total__label">Solde</span>
            <strong class="total__value" [class.is-negative]="data.totals.balance < 0">{{ formatEuros(data.totals.balance) }}</strong>
          </div>
        </div>

        @if (data.byAdmin.length) {
          <div class="admin-panel">
            <h3>Par admin</h3>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th scope="col">Admin</th><th scope="col">Entrées</th><th scope="col">Dépenses</th><th scope="col">Solde</th></tr>
                </thead>
                <tbody>
                  @for (admin of data.byAdmin; track admin.adminEmail) {
                    <tr>
                      <th scope="row">{{ admin.adminEmail }}</th>
                      <td>{{ formatEuros(admin.totals.income) }}</td>
                      <td>{{ formatEuros(admin.totals.expense) }}</td>
                      <td>{{ formatEuros(admin.totals.balance) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel">
            <h3>Par mois</h3>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th scope="col">Mois</th><th scope="col">Entrées</th><th scope="col">Dépenses</th><th scope="col">Solde</th></tr>
                </thead>
                <tbody>
                  @for (month of data.months; track month.month) {
                    <tr>
                      <th scope="row">{{ monthName(month.month) }}</th>
                      <td>{{ formatEuros(month.totals.income) }}</td>
                      <td>{{ formatEuros(month.totals.expense) }}</td>
                      <td>{{ formatEuros(month.totals.balance) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <form class="admin-panel" (submit)="save($event)">
          <h3>{{ editing() ? 'Modifier la ligne' : 'Ajouter une ligne' }}</h3>
          @if (editing()?.orderId; as orderId) {
            <p class="field__hint">Elle vient de la commande n° {{ orderId }} : son type, sa catégorie et son montant se changent depuis la commande</p>
          }
          <div class="form-grid">
            <div class="field">
              <span class="field__label">Type</span>
              <yona-select label="Type" [options]="kindOptions" [disabled]="fromOrder()" [value]="kind()" (valueChange)="chooseKind($event)" />
            </div>
            <div class="field">
              <span class="field__label">Catégorie</span>
              <yona-select label="Catégorie" [options]="categoryOptions()" [disabled]="fromOrder()" [value]="category()" (valueChange)="category.set($event ?? category())" />
            </div>
            <div class="field">
              <label class="field__label" for="entry-date">Date</label>
              <input id="entry-date" class="input" type="date" [value]="date()" (input)="date.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label class="field__label" for="entry-amount">Montant (€)</label>
              <input id="entry-amount" class="input" type="number" inputmode="decimal" min="0.01" step="0.01" [disabled]="fromOrder()" [value]="amount()" (input)="amount.set($any($event.target).value)" />
            </div>
          </div>
          <!-- On a line of their own: an email needs the room -->
          <div class="form-row">
            <div class="field">
              <label class="field__label" for="entry-label">Libellé</label>
              <input id="entry-label" class="input" maxlength="200" placeholder="Farine et beurre, marché du 12" [value]="label()" (input)="label.set($any($event.target).value)" />
            </div>
            <div class="field">
              <span class="field__label">Pour</span>
              <yona-select label="Admin" [options]="adminOptions()" [value]="admin()" (valueChange)="admin.set($event ?? admin())" />
            </div>
          </div>
          <div class="admin-toolbar">
            <button yonaButton type="submit" [disabled]="saving()"><svg yonaIcon="save"></svg>{{ editing() ? 'Enregistrer' : 'Ajouter' }}</button>
            @if (editing()) {
              <button yonaButton variant="ghost" type="button" (click)="cancel()">Annuler</button>
            }
          </div>
        </form>

        <div class="admin-toolbar">
          <yona-select class="filter-admin" label="Filtrer par admin" [options]="adminFilterOptions()" [value]="adminFilter()" (valueChange)="adminFilter.set($event ?? '')" />
          <yona-select label="Filtrer par type" [options]="kindFilterOptions" [value]="kindFilter()" (valueChange)="kindFilter.set($event ?? 'ALL')" />
          <span class="admin-row__meta">{{ shown().length }} ligne{{ shown().length > 1 ? 's' : '' }}</span>
        </div>

        @if (shown().length) {
          <ul role="list" class="admin-list">
            @for (entry of shown(); track entry.id) {
              <li class="admin-row">
                <span class="admin-row__main">
                  <span class="admin-row__title">{{ entry.label }}</span>
                  <span class="admin-row__meta">
                    {{ entry.occurredOn | parisDate }} · {{ categoryLabels[entry.category] }} · {{ entry.adminEmail }}
                    @if (entry.orderId; as orderId) {
                      · <a class="link-button" [routerLink]="['/admin/boutique/commandes', orderId]">Commande n° {{ orderId }}</a>
                    }
                  </span>
                </span>
                <strong class="amount" [class.is-negative]="entry.kind === 'EXPENSE'">{{ entry.kind === 'EXPENSE' ? '−' : '+' }}{{ formatEuros(entry.amount) }}</strong>
                <div class="admin-row__actions">
                  <button type="button" class="icon-button" [attr.aria-label]="'Modifier ' + entry.label" (click)="edit(entry)"><svg yonaIcon="pencil" [size]="18"></svg></button>
                  <button type="button" class="icon-button icon-button--danger" [attr.aria-label]="'Supprimer ' + entry.label" [disabled]="!!entry.orderId" (click)="remove(entry)"><svg yonaIcon="trash" [size]="18"></svg></button>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="admin-empty">Aucune ligne pour cette sélection</p>
        }
      } @else if (overview.isLoading()) {
        <p class="admin-empty">Chargement…</p>
      }
    </section>
  `,
  styles: `
    h3 {
      font-size: var(--text-lg);
    }

    .totals {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: var(--space-3);
    }

    .total {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      background-color: var(--color-surface);
    }

    .total__label {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .total__value {
      font-size: var(--text-2xl);
      font-variant-numeric: tabular-nums;
    }

    .is-negative {
      color: var(--color-danger);
    }

    .table-wrap {
      overflow-x: auto;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;

      th,
      td {
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--color-line);
        text-align: right;
        white-space: nowrap;
      }

      th:first-child {
        font-weight: 600;
        text-align: left;
      }

      thead th {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--space-3);
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
      gap: var(--space-3);
    }

    // As wide as an email, in the button and in its list
    .filter-admin {
      flex: 0 1 22rem;
    }

    .amount {
      font-variant-numeric: tabular-nums;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminAccounting {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly session = inject(AdminSession);

  protected readonly formatEuros = formatEuros;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly kindOptions: SelectOption<Kind>[] = [
    { value: 'EXPENSE', label: 'Dépense' },
    { value: 'INCOME', label: 'Entrée' },
  ];
  protected readonly kindFilterOptions: SelectOption<Kind | 'ALL'>[] = [
    { value: 'ALL', label: 'Entrées et dépenses' },
    { value: 'INCOME', label: 'Entrées' },
    { value: 'EXPENSE', label: 'Dépenses' },
  ];

  protected readonly year = signal(new Date().getFullYear());
  protected readonly overview = resource({
    params: () => this.year(),
    loader: ({ params }) => this.api.invoke(getAccounting, { year: params }),
  });
  protected readonly yearOptions = computed<SelectOption<number>[]>(() =>
    (this.overview.value()?.years ?? [this.year()]).map((year) => ({ value: year, label: String(year) })),
  );
  protected readonly adminOptions = computed<SelectOption<string>[]>(() =>
    (this.overview.value()?.admins ?? []).map((email) => ({ value: email, label: email })),
  );
  protected readonly adminFilterOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Tous les admins' },
    ...this.adminOptions(),
  ]);
  protected readonly exportLink = computed(() => `${exportAccounting.PATH}?year=${this.year()}`);

  protected readonly adminFilter = signal('');
  protected readonly kindFilter = signal<Kind | 'ALL'>('ALL');
  protected readonly shown = computed(() =>
    (this.overview.value()?.entries ?? []).filter(
      (entry) =>
        (!this.adminFilter() || entry.adminEmail === this.adminFilter()) &&
        (this.kindFilter() === 'ALL' || entry.kind === this.kindFilter()),
    ),
  );

  /** The line being changed; null while adding a new one. */
  protected readonly editing = signal<AccountEntryResponse | null>(null);
  protected readonly fromOrder = computed(() => !!this.editing()?.orderId);
  protected readonly kind = signal<Kind>('EXPENSE');
  protected readonly category = signal<Category>('INGREDIENTS');
  protected readonly date = signal(today());
  /** As typed in the field. */
  protected readonly amount = signal('');
  protected readonly label = signal('');
  protected readonly admin = signal(this.session.admin()?.email ?? '');
  protected readonly saving = signal(false);
  /** "Vente" is money in only. */
  protected readonly categoryOptions = computed<SelectOption<Category>[]>(() =>
    (Object.entries(CATEGORY_LABELS) as [Category, string][])
      .filter(([value]) => value !== 'SALE' || this.kind() === 'INCOME')
      .map(([value, label]) => ({ value, label })),
  );

  protected monthName(month: number): string {
    return MONTHS[month - 1] ?? String(month);
  }

  protected chooseKind(kind: Kind | undefined): void {
    this.kind.set(kind ?? this.kind());
    if (this.kind() === 'EXPENSE' && this.category() === 'SALE') {
      this.category.set('INGREDIENTS');
    }
  }

  protected edit(entry: AccountEntryResponse): void {
    this.editing.set(entry);
    this.kind.set(entry.kind);
    this.category.set(entry.category);
    this.date.set(entry.occurredOn);
    this.amount.set(String(entry.amount));
    this.label.set(entry.label);
    this.admin.set(entry.adminEmail);
  }

  protected cancel(): void {
    this.editing.set(null);
    this.kind.set('EXPENSE');
    this.category.set('INGREDIENTS');
    this.date.set(today());
    this.amount.set('');
    this.label.set('');
    this.admin.set(this.session.admin()?.email ?? '');
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const amount = Number(this.amount());
    if (!this.label().trim() || !this.date() || !Number.isFinite(amount) || amount <= 0 || !this.admin()) {
      this.toaster.error('Indiquez un libellé, une date, un montant positif et un admin');
      return;
    }
    const body = { kind: this.kind(), category: this.category(), occurredOn: this.date(), label: this.label().trim(), amount, adminEmail: this.admin() };
    const editing = this.editing();
    this.saving.set(true);
    const saved = await attempt(
      editing ? this.api.invoke(updateAccountEntry, { id: editing.id, body }) : this.api.invoke(createAccountEntry, { body }),
    );
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success(editing ? 'Ligne enregistrée' : 'Ligne ajoutée');
      this.cancel();
      this.overview.reload();
    }
  }

  protected async remove(entry: AccountEntryResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer cette ligne ?',
      message: `« ${entry.label} » sera effacée pour de bon de la comptabilité`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteAccountEntry, { id: entry.id }))).ok) {
      this.toaster.success('Ligne supprimée');
      if (this.editing()?.id === entry.id) {
        this.cancel();
      }
      this.overview.reload();
    }
  }
}
