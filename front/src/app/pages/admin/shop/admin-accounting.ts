import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, resource, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteAccountEntry } from '../../../core/api/generated/fn/admin-accounting/delete-account-entry';
import { exportAccounting } from '../../../core/api/generated/fn/admin-accounting/export-accounting';
import { getAccounting } from '../../../core/api/generated/fn/admin-accounting/get-accounting';
import { listProductCosts } from '../../../core/api/generated/fn/admin-accounting/list-product-costs';
import { AccountEntryResponse } from '../../../core/api/generated/models/account-entry-response';
import { CostLine } from '../../../core/api/generated/models/cost-line';
import { AdminSession } from '../../../core/auth/admin-session';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { formatEuros } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { AccountEntryDialog } from './account-entry-dialog';
import { CATEGORY_LABELS, MONTHS, MonthGroup, PRICE_UNITS, Period, change, filterEntries, groupByMonth, periodLabel, quarterLabel, share } from './accounting-format';
import { InvoicesPanel } from './invoices-panel';
import { AccountingChart } from './accounting-chart';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';

type Kind = AccountEntryResponse['kind'];

const PERCENT = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });
const SIGNED_PERCENT = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });

/**
 * The accounts of the shop: the orders handed over come in by themselves, the rest is added in a
 * window, each line counted for an admin. A month, a quarter or a year at once: key figures, money in
 * and out by month, where the money goes, the best sales, the cost price of each product, then the
 * lines by month. CSV for a spreadsheet.
 */
@Component({
  selector: 'yona-admin-accounting',
  imports: [AccountEntryDialog, AccountingChart, Button, Icon, InvoicesPanel, NgTemplateOutlet, ParisDatePipe, RouterLink, Select, Skeleton],
  templateUrl: './admin-accounting.html',
  styleUrl: './admin-accounting.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminAccounting {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  protected readonly session = inject(AdminSession);

  protected readonly formatEuros = formatEuros;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly priceUnits = PRICE_UNITS;
  protected readonly percent = (share: number) => PERCENT.format(share);
  protected readonly periods: { value: Period; label: string }[] = [
    { value: 'MONTH', label: 'Mois' },
    { value: 'QUARTER', label: 'Trimestre' },
    { value: 'YEAR', label: 'Année' },
  ];
  protected readonly monthOptions: SelectOption<number>[] = MONTHS.map((label, index) => ({ value: index + 1, label }));
  protected readonly quarterOptions: SelectOption<number>[] = [1, 2, 3, 4].map((quarter) => ({
    value: quarter,
    label: quarterLabel(quarter),
  }));

  private readonly now = new Date();
  protected readonly year = signal(this.now.getFullYear());
  protected readonly period = signal<Period>('YEAR');
  protected readonly month = signal(this.now.getMonth() + 1);
  protected readonly quarter = signal(Math.floor(this.now.getMonth() / 3) + 1);
  protected readonly overview = resource({
    params: () => ({
      year: this.year(),
      period: this.period(),
      number: this.period() === 'MONTH' ? this.month() : this.period() === 'QUARTER' ? this.quarter() : 1,
    }),
    loader: ({ params }) => this.api.invoke(getAccounting, params),
  });
  protected readonly costs = resource({ loader: () => this.api.invoke(listProductCosts) });
  protected readonly yearOptions = computed<SelectOption<number>[]>(() =>
    (this.overview.value()?.years ?? [this.year()]).map((year) => ({ value: year, label: String(year) })),
  );
  protected readonly adminFilterOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Tous les admins' },
    ...(this.overview.value()?.admins ?? []).map((email) => ({ value: email, label: email })),
  ]);
  protected readonly exportLink = computed(() => `${exportAccounting.PATH}?year=${this.year()}`);
  /** "2026", "1er trimestre 2026", "Mars 2026". */
  protected readonly periodLabel = computed(() => periodLabel(this.period(), this.year(), this.month(), this.quarter()));

  // Key figures, compared with the same period a year before
  protected readonly incomeChange = computed(() => {
    const data = this.overview.value();
    return data ? change(data.totals.income, data.previousTotals.income) : null;
  });
  protected readonly expenseShare = computed(() => {
    const data = this.overview.value();
    return data ? share(data.totals.expense, data.totals.income) : null;
  });
  protected readonly signedPercent = (share: number) => SIGNED_PERCENT.format(share);
  /** The longest bar of "Où part l'argent". */
  protected readonly largestExpense = computed(() => Math.max(1, ...(this.overview.value()?.expensesByCategory ?? []).map((total) => total.amount)));

  // Lines
  protected readonly kindFilter = signal<Kind | 'ALL'>('ALL');
  protected readonly adminFilter = signal('');
  protected readonly search = signal('');
  protected readonly shown = computed(() =>
    filterEntries(this.overview.value()?.entries ?? [], this.kindFilter(), this.adminFilter(), this.search()),
  );
  protected readonly groups = computed<MonthGroup[]>(() => groupByMonth(this.shown()));

  // Cost price
  protected readonly costProductId = signal<number | null>(null);
  protected readonly costOptions = computed<SelectOption<number>[]>(() =>
    (this.costs.value() ?? []).map((cost) => ({ value: cost.productId, label: cost.name })),
  );
  protected readonly cost = computed(() => {
    const costs = this.costs.value() ?? [];
    return costs.find((cost) => cost.productId === this.costProductId()) ?? costs[0] ?? null;
  });

  private readonly dialog = viewChild.required(AccountEntryDialog);

  protected choosePeriod(period: Period): void {
    this.period.set(period);
  }

  protected add(): void {
    this.dialog().start();
  }

  protected edit(entry: AccountEntryResponse): void {
    this.dialog().edit(entry);
  }

  protected reload(): void {
    this.overview.reload();
    this.costs.reload();
  }

  protected quantity(line: CostLine): string {
    if (line.quantity === undefined || line.quantity === null) {
      return '—';
    }
    return `${line.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${line.unit ? ' ' + line.unit : ''}`;
  }

  protected purchaseSummary(entry: AccountEntryResponse): string {
    const count = entry.purchases.length;
    return `${count} article${count > 1 ? 's' : ''}`;
  }

  /** "9,80 € / kg", the last price paid; "—" when never bought. */
  protected paidText(line: CostLine): string {
    return line.pricePerUnit !== undefined && line.pricePerUnit !== null && line.priceUnit
      ? `${formatEuros(line.pricePerUnit)} / ${PRICE_UNITS[line.priceUnit]}`
      : '—';
  }

  protected async remove(entry: AccountEntryResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer cette ligne ?',
      message: `« ${entry.label} » sera effacée pour de bon de la comptabilité, avec sa photo de ticket`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteAccountEntry, { id: entry.id }))).ok) {
      this.toaster.success('Ligne supprimée');
      this.reload();
    }
  }
}
