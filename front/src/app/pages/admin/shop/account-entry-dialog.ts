import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, resource, signal } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { attachReceipt } from '../../../core/api/generated/fn/admin-accounting/attach-receipt';
import { createAccountEntry } from '../../../core/api/generated/fn/admin-accounting/create-account-entry';
import { listLastPrices } from '../../../core/api/generated/fn/admin-accounting/list-last-prices';
import { removeReceipt } from '../../../core/api/generated/fn/admin-accounting/remove-receipt';
import { updateAccountEntry } from '../../../core/api/generated/fn/admin-accounting/update-account-entry';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { AccountEntryForm } from '../../../core/api/generated/models/account-entry-form';
import { AccountEntryResponse } from '../../../core/api/generated/models/account-entry-response';
import { LastPrice } from '../../../core/api/generated/models/last-price';
import { ImageUploads } from '../../../core/api/image-uploads';
import { Toaster } from '../../../core/notifications/toaster';
import { fold } from '../../../shared/format/glossary';
import { formatEuros } from '../../../shared/format/units';
import { CATEGORY_LABELS, PRICE_UNITS, PurchaseUnit, pricePerText, pricePerUnit, purchasesTotal } from './accounting-format';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { Suggestion, SuggestInput } from '../../../shared/ui/suggest-input/suggest-input';

type Kind = AccountEntryResponse['kind'];
type Category = AccountEntryResponse['category'];
type Unit = PurchaseUnit;

const UNITS: SelectOption<Unit>[] = [
  { value: 'G', label: 'g' },
  { value: 'KG', label: 'kg' },
  { value: 'ML', label: 'ml' },
  { value: 'CL', label: 'cl' },
  { value: 'L', label: 'L' },
  { value: 'PIECE', label: 'pièce(s)' },
];

const MAX_PURCHASES = 60;

/** A line of a purchase, as typed. */
interface PurchaseRow {
  key: number;
  item: string;
  ingredientId?: number;
  quantity: string;
  unit: Unit;
  price: string;
}

let nextKey = 1;

/** Today in Paris, as the date field wants it. */
function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/**
 * Adding or changing a line of the accounts, in a window over the page. An expense for ingredients or
 * packaging may be detailed, line by line, from the ingredients of the site: its amount is then their
 * total, the price by the kilo or the piece is worked out, and the last price paid is recalled. A
 * photo of the receipt goes with an expense.
 */
@Component({
  selector: 'yona-account-entry-dialog',
  imports: [Button, Dialog, Icon, Select, SuggestInput],
  templateUrl: './account-entry-dialog.html',
  styleUrl: './account-entry-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountEntryDialog {
  readonly open = model(false);
  /** Those a line can be counted for. */
  readonly admins = input<string[]>([]);
  readonly defaultAdmin = input('');
  /** Saved: the page reloads its figures. */
  readonly saved = output<void>();

  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly toaster = inject(Toaster);

  protected readonly units = UNITS;
  protected readonly maxPurchases = MAX_PURCHASES;
  protected readonly formatEuros = formatEuros;
  protected readonly priceUnits = PRICE_UNITS;
  protected readonly kindOptions: SelectOption<Kind>[] = [
    { value: 'EXPENSE', label: 'Dépense' },
    { value: 'INCOME', label: 'Entrée' },
  ];

  private readonly ingredients = resource({
    params: () => (this.open() ? true : undefined),
    loader: () => this.api.invoke(searchIngredients, {}),
  });
  private readonly lastPrices = resource({
    params: () => (this.open() ? true : undefined),
    loader: () => this.api.invoke(listLastPrices),
  });
  protected readonly itemSuggestions = computed<Suggestion[]>(() =>
    (this.ingredients.value() ?? []).map((ingredient) => ({ value: ingredient.name })),
  );
  private readonly lastPriceByItem = computed(() => new Map((this.lastPrices.value() ?? []).map((price) => [fold(price.item), price])));

  /** The line being changed; null for a new one. */
  protected readonly editing = signal<AccountEntryResponse | null>(null);
  protected readonly fromOrder = computed(() => !!this.editing()?.orderId);
  protected readonly kind = signal<Kind>('EXPENSE');
  protected readonly category = signal<Category>('INGREDIENTS');
  protected readonly date = signal(today());
  protected readonly amount = signal('');
  protected readonly label = signal('');
  protected readonly admin = signal('');
  protected readonly purchases = signal<PurchaseRow[]>([]);
  /** A receipt chosen before the line is saved: sent once it is. */
  protected readonly receiptFile = signal<File | null>(null);
  protected readonly receiptPreview = signal<string | null>(null);
  protected readonly hasReceipt = signal(false);
  protected readonly receiptVersion = signal(0);
  protected readonly saving = signal(false);

  protected readonly categoryOptions = computed<SelectOption<Category>[]>(() =>
    (Object.entries(CATEGORY_LABELS) as [Category, string][])
      .filter(([value]) => value !== 'SALE' || this.kind() === 'INCOME')
      .map(([value, label]) => ({ value, label })),
  );
  protected readonly adminOptions = computed<SelectOption<string>[]>(() => this.admins().map((email) => ({ value: email, label: email })));
  protected readonly canDetail = computed(
    () => !this.fromOrder() && this.kind() === 'EXPENSE' && (this.category() === 'INGREDIENTS' || this.category() === 'PACKAGING'),
  );
  protected readonly detailed = computed(() => this.canDetail() && this.purchases().length > 0);
  protected readonly purchasesTotal = computed(() => purchasesTotal(this.purchases().map((row) => row.price)));

  /** A new line. */
  start(): void {
    this.editing.set(null);
    this.kind.set('EXPENSE');
    this.category.set('INGREDIENTS');
    this.date.set(today());
    this.amount.set('');
    this.label.set('');
    this.admin.set(this.defaultAdmin() || this.admins()[0] || '');
    this.purchases.set([]);
    this.resetReceipt(false);
    this.open.set(true);
  }

  edit(entry: AccountEntryResponse): void {
    this.editing.set(entry);
    this.kind.set(entry.kind);
    this.category.set(entry.category);
    this.date.set(entry.occurredOn);
    this.amount.set(String(entry.amount));
    this.label.set(entry.label);
    this.admin.set(entry.adminEmail);
    this.purchases.set(
      entry.purchases.map((line) => ({
        key: nextKey++,
        item: line.item,
        ingredientId: line.ingredientId,
        quantity: String(line.quantity),
        unit: line.unit,
        price: String(line.price),
      })),
    );
    this.resetReceipt(entry.receipt);
    this.open.set(true);
  }

  protected chooseKind(kind: Kind | undefined): void {
    this.kind.set(kind ?? this.kind());
    if (this.kind() === 'EXPENSE' && this.category() === 'SALE') {
      this.category.set('INGREDIENTS');
    }
  }

  // Purchases

  protected addPurchase(): void {
    this.purchases.update((rows) => [...rows, { key: nextKey++, item: '', quantity: '', unit: this.category() === 'PACKAGING' ? 'PIECE' : 'KG', price: '' }]);
  }

  protected removePurchase(key: number): void {
    this.purchases.update((rows) => rows.filter((row) => row.key !== key));
  }

  protected patchPurchase(key: number, changes: Partial<PurchaseRow>): void {
    this.purchases.update((rows) => rows.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  /** Typed or picked: an ingredient of the site when it is one. */
  protected setItem(row: PurchaseRow, item: string): void {
    const ingredient = (this.ingredients.value() ?? []).find((known) => fold(known.name) === fold(item));
    this.patchPurchase(row.key, { item, ingredientId: ingredient?.id });
  }

  /** "9,80 € / kg", worked out from what was typed. */
  protected pricePer(row: PurchaseRow): string | null {
    const price = pricePerUnit(row.quantity, row.unit, row.price);
    return price ? pricePerText(price) : null;
  }

  protected lastPrice(row: PurchaseRow): LastPrice | undefined {
    return row.item.trim() ? this.lastPriceByItem().get(fold(row.item)) : undefined;
  }

  // Receipt

  protected chooseReceipt(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      this.toaster.error('Seules les photos JPEG et PNG sont acceptées');
      return;
    }
    this.receiptFile.set(file);
    const previous = this.receiptPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.receiptPreview.set(URL.createObjectURL(file));
  }

  protected receiptUrl(): string | null {
    const entry = this.editing();
    return entry && this.hasReceipt() ? `/api/admin/accounting/${entry.id}/receipt?v=${this.receiptVersion()}` : null;
  }

  protected async dropReceipt(): Promise<void> {
    const entry = this.editing();
    if (this.receiptFile()) {
      this.resetReceipt(this.hasReceipt());
      return;
    }
    if (entry && this.hasReceipt() && (await attempt(this.api.invoke(removeReceipt, { id: entry.id }))).ok) {
      this.hasReceipt.set(false);
      this.toaster.success('Ticket retiré');
      this.saved.emit();
    }
  }

  private resetReceipt(attached: boolean): void {
    const previous = this.receiptPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.receiptFile.set(null);
    this.receiptPreview.set(null);
    this.hasReceipt.set(attached);
  }

  // Saving

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const detailed = this.detailed();
    const rows = this.purchases();
    if (detailed && rows.some((row) => !row.item.trim() || !(Number(row.quantity.replace(',', '.')) > 0) || !(Number(row.price.replace(',', '.')) > 0))) {
      this.toaster.error('Chaque achat a un nom, une quantité et un prix payé');
      return;
    }
    const amount = detailed ? Math.round(this.purchasesTotal() * 100) / 100 : Number(this.amount().replace(',', '.'));
    if (!this.label().trim() || !this.date() || !Number.isFinite(amount) || amount <= 0 || !this.admin()) {
      this.toaster.error('Indiquez un libellé, une date, un montant positif et un admin');
      return;
    }
    const body: AccountEntryForm = {
      kind: this.kind(),
      category: this.category(),
      occurredOn: this.date(),
      label: this.label().trim(),
      amount,
      adminEmail: this.admin(),
      purchases: detailed
        ? rows.map((row) => ({
            ingredientId: row.ingredientId,
            item: row.item.trim(),
            quantity: Number(row.quantity.replace(',', '.')),
            unit: row.unit,
            price: Number(row.price.replace(',', '.')),
          }))
        : [],
    };
    const editing = this.editing();
    this.saving.set(true);
    const saved = await attempt(
      editing ? this.api.invoke(updateAccountEntry, { id: editing.id, body }) : this.api.invoke(createAccountEntry, { body }),
    );
    if (saved.ok && this.receiptFile() && saved.value.kind === 'EXPENSE') {
      const file = this.receiptFile()!;
      const sent = await attempt(this.imageUploads.send(attachReceipt.PATH.replace('{id}', String(saved.value.id)), file, () => undefined));
      if (!sent.ok) {
        this.toaster.error('La ligne est enregistrée, mais pas la photo du ticket : réessayez depuis la ligne');
      }
    }
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success(editing ? 'Ligne enregistrée' : 'Ligne ajoutée');
      this.resetReceipt(false);
      this.open.set(false);
      this.saved.emit();
    }
  }
}
