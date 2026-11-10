import { ShopProductCard } from '../../core/api/generated/models/shop-product-card';
import { fold } from '../../shared/format/glossary';

export const MAX_QUANTITY = 50;
export const MAX_LINES = 20;

/** The request being written, kept in the browser: it is still there when the visitor comes back. */
export interface ShopRequest {
  /** By product id; a product at 0 is not asked for. */
  quantities: Record<string, number>;
  name: string;
  email: string;
  phone: string;
  wantedOn: string;
  message: string;
}

export const EMPTY_REQUEST: ShopRequest = { quantities: {}, name: '', email: '', phone: '', wantedOn: '', message: '' };

const TEXT_FIELDS = ['name', 'email', 'phone', 'wantedOn', 'message'] as const;

/** What the browser gave back is a request, each quantity a whole number the shop accepts. */
export function isRequest(value: unknown): value is ShopRequest {
  const request = value as ShopRequest | null;
  return (
    !!request &&
    typeof request === 'object' &&
    typeof request.quantities === 'object' &&
    request.quantities !== null &&
    !Array.isArray(request.quantities) &&
    Object.values(request.quantities).every((quantity) => Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY) &&
    TEXT_FIELDS.every((field) => typeof request[field] === 'string')
  );
}

/** A category of the products, with how many are in it. */
export interface ShopFilter {
  slug: string;
  name: string;
  count: number;
}

/** The categories having a product at least, by name. */
export function shopFilters(products: readonly ShopProductCard[]): ShopFilter[] {
  const counts = new Map<string, ShopFilter>();
  for (const product of products) {
    for (const category of product.categories) {
      const known = counts.get(category.slug) ?? { slug: category.slug, name: category.name, count: 0 };
      known.count++;
      counts.set(category.slug, known);
    }
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/**
 * The products of a category (all for ''), holding every word searched in their name, format or
 * categories, whatever the case and accents.
 */
export function filterProducts(products: readonly ShopProductCard[], search: string, category: string): ShopProductCard[] {
  const words = fold(search).split(/\s+/).filter(Boolean);
  return products.filter(
    (product) =>
      (!category || product.categories.some((known) => known.slug === category)) &&
      words.every((word) => fold([product.name, product.format, ...product.categories.map((known) => known.name)].join(' ')).includes(word)),
  );
}

export interface ChosenLine {
  product: ShopProductCard;
  quantity: number;
}

/** The products asked for, in the order of the shop; one no longer sold is left out. */
export function chosenLines(products: readonly ShopProductCard[], quantities: Readonly<Record<string, number>>): ChosenLine[] {
  return products.flatMap((product) => {
    const quantity = quantities[product.id] ?? 0;
    return quantity ? [{ product, quantity }] : [];
  });
}

export function itemCount(lines: readonly ChosenLine[]): number {
  return lines.reduce((sum, { quantity }) => sum + quantity, 0);
}

/** To the cent, so that 3 × 0,10 € makes 0,30 €. */
export function requestTotal(lines: readonly ChosenLine[]): number {
  return Math.round(lines.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0) * 100) / 100;
}

/**
 * One more or one less of a product, between 0 and 50; a new product refused once the request
 * holds 20 different ones (the error says so).
 */
export function changeQuantity(
  request: ShopRequest,
  products: readonly ShopProductCard[],
  productId: number,
  delta: number,
): { request: ShopRequest; error?: string } {
  const current = request.quantities[productId] ?? 0;
  const quantity = Math.min(MAX_QUANTITY, Math.max(0, current + delta));
  if (quantity > 0 && current === 0 && chosenLines(products, request.quantities).length >= MAX_LINES) {
    return { request, error: `Une demande compte ${MAX_LINES} produits différents au plus` };
  }
  const quantities: Record<string, number> = { ...request.quantities, [productId]: quantity };
  if (!quantity) {
    delete quantities[String(productId)];
  }
  return { request: { ...request, quantities } };
}

/** "1 produit", "3 produits". */
export function productCount(count: number): string {
  return `${count} produit${count > 1 ? 's' : ''}`;
}

/** Sent: the next request starts empty, the contact kept. */
export function afterSending(request: ShopRequest): ShopRequest {
  return { ...EMPTY_REQUEST, name: request.name, email: request.email, phone: request.phone };
}

/** A name, a way to answer, and something asked: products, or a message. */
export function isComplete(request: ShopRequest, lines: readonly ChosenLine[]): boolean {
  return (
    (lines.length > 0 || !!request.message.trim()) && !!request.name.trim() && (!!request.email.trim() || !!request.phone.trim())
  );
}
