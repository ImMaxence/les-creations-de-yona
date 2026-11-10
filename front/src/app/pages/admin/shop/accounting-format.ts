import { AccountEntryResponse } from '../../../core/api/generated/models/account-entry-response';
import { AccountingOverview } from '../../../core/api/generated/models/accounting-overview';
import { LastPrice } from '../../../core/api/generated/models/last-price';
import { fold } from '../../../shared/format/glossary';
import { formatEuros } from '../../../shared/format/units';

type Kind = AccountEntryResponse['kind'];
type Category = AccountEntryResponse['category'];
export type Period = AccountingOverview['period'];
export type PurchaseUnit = 'G' | 'KG' | 'ML' | 'CL' | 'L' | 'PIECE';

export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export const CATEGORY_LABELS: Record<Category, string> = {
  SALE: 'Vente',
  INGREDIENTS: 'Ingrédients',
  PACKAGING: 'Emballages',
  EQUIPMENT: 'Matériel',
  OTHER: 'Autre',
};

export const PRICE_UNITS: Record<LastPrice['priceUnit'], string> = { KG: 'kg', L: 'L', PIECE: 'pièce' };

/** In grams, millilitres or pieces, and what the price is then given for. */
const BASE: Record<PurchaseUnit, { factor: number; per: LastPrice['priceUnit'] }> = {
  G: { factor: 1, per: 'KG' },
  KG: { factor: 1000, per: 'KG' },
  ML: { factor: 1, per: 'L' },
  CL: { factor: 10, per: 'L' },
  L: { factor: 1000, per: 'L' },
  PIECE: { factor: 1, per: 'PIECE' },
};

/** "9,8" or "9.80": a number as typed in a French form; NaN when it is not one. */
export function typedNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text.trim().replace(',', '.'));
}

/** 250 g bought 2,45 € → 9,80 € per kg; null until both are typed and positive. */
export function pricePerUnit(quantity: string, unit: PurchaseUnit, price: string): { value: number; per: LastPrice['priceUnit'] } | null {
  const amount = typedNumber(quantity);
  const paid = typedNumber(price);
  if (!(amount > 0) || !(paid > 0)) {
    return null;
  }
  const base = BASE[unit];
  const perBase = paid / (amount * base.factor);
  return { value: base.per === 'PIECE' ? perBase : perBase * 1000, per: base.per };
}

/** "9,80 € / kg". */
export function pricePerText(price: { value: number; per: LastPrice['priceUnit'] }): string {
  return `${formatEuros(price.value)} / ${PRICE_UNITS[price.per]}`;
}

/** The prices typed added up, to the cent; one not typed yet counts for nothing. */
export function purchasesTotal(prices: readonly string[]): number {
  return Math.round(prices.reduce((sum, price) => sum + (typedNumber(price) || 0), 0) * 100) / 100;
}

/** "2026", "1er trimestre 2026", "Mars 2026". */
export function periodLabel(period: Period, year: number, month: number, quarter: number): string {
  switch (period) {
    case 'MONTH':
      return `${MONTHS[month - 1]} ${year}`;
    case 'QUARTER':
      return `${quarterLabel(quarter)} ${year}`;
    default:
      return String(year);
  }
}

export function quarterLabel(quarter: number): string {
  return `${quarter === 1 ? '1er' : `${quarter}e`} trimestre`;
}

/** +25 % when 100 € became 125 €; null without anything to compare with. */
export function change(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

/** The part of a whole (the expenses of the income); null for a whole of 0. */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** The lines of a kind (or all), of an admin (or all), holding every word searched. */
export function filterEntries(entries: readonly AccountEntryResponse[], kind: Kind | 'ALL', admin: string, search: string): AccountEntryResponse[] {
  const words = fold(search).split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      (kind === 'ALL' || entry.kind === kind) &&
      (!admin || entry.adminEmail === admin) &&
      words.every((word) =>
        fold([entry.label, entry.orderSummary ?? '', CATEGORY_LABELS[entry.category], ...entry.purchases.map((line) => line.item)].join(' ')).includes(word),
      ),
  );
}

/** The lines of a month, under "Mars 2026", with what came in and went out. */
export interface MonthGroup {
  key: string;
  label: string;
  income: number;
  expense: number;
  entries: AccountEntryResponse[];
}

/** By month, in the order of the lines (latest first); the totals to the cent. */
export function groupByMonth(entries: readonly AccountEntryResponse[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const entry of entries) {
    const key = entry.occurredOn.slice(0, 7);
    const group = groups.get(key) ?? { key, label: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, income: 0, expense: 0, entries: [] };
    group.entries.push(entry);
    if (entry.kind === 'INCOME') {
      group.income = Math.round((group.income + entry.amount) * 100) / 100;
    } else {
      group.expense = Math.round((group.expense + entry.amount) * 100) / 100;
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** A round top for a scale: 100, 200, 250, 500, 1 000… at least 1. */
export function roundScale(highest: number): number {
  const top = Math.max(1, highest);
  const power = 10 ** Math.floor(Math.log10(top));
  return [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((round) => round >= top) ?? top;
}

/** A bar standing on the baseline, its top corners rounded (4 px at most), as an SVG path. */
export function barPath(x: number, height: number, width: number, bottom: number): string {
  const radius = Math.min(4, height, width / 2);
  const top = bottom - height;
  return `M${x},${bottom} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + width - radius} Q${x + width},${top} ${x + width},${top + radius} V${bottom} Z`;
}
