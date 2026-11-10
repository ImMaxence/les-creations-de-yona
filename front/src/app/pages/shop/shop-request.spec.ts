import { ShopProductCard } from '../../core/api/generated/models/shop-product-card';
import {
  EMPTY_REQUEST,
  MAX_LINES,
  MAX_QUANTITY,
  ShopRequest,
  afterSending,
  changeQuantity,
  chosenLines,
  filterProducts,
  isComplete,
  isRequest,
  itemCount,
  productCount,
  requestTotal,
  shopFilters,
} from './shop-request';

const DESSERTS = { slug: 'desserts', name: 'Desserts' };
const GIFTS = { slug: 'cadeaux', name: 'Cadeaux' };

function product(id: number, name: string, price: number, categories = [DESSERTS], format = "À l'unité"): ShopProductCard {
  return { id, name, price, categories, format };
}

const COOKIES = product(1, 'Cookies aux pépites', 12, [DESSERTS], 'Boîte de 6');
const FINANCIERS = product(2, 'Financiers', 0.1, [DESSERTS]);
const BOX = product(3, 'Coffret de Noël', 25, [GIFTS, DESSERTS]);
const PRODUCTS = [COOKIES, FINANCIERS, BOX];

function request(quantities: Record<string, number>, fields: Partial<ShopRequest> = {}): ShopRequest {
  return { ...EMPTY_REQUEST, quantities, ...fields };
}

describe('isRequest', () => {
  it('takes back a request as it was kept', () => {
    expect(isRequest(request({ 1: 2 }, { name: 'Léa' }))).toBe(true);
    expect(isRequest(EMPTY_REQUEST)).toBe(true);
  });

  it('refuses what is not one', () => {
    expect(isRequest(null)).toBe(false);
    expect(isRequest('text')).toBe(false);
    expect(isRequest({ quantities: {} })).toBe(false);
    expect(isRequest({ ...EMPTY_REQUEST, quantities: [] })).toBe(false);
    expect(isRequest({ ...EMPTY_REQUEST, quantities: null })).toBe(false);
    expect(isRequest({ ...EMPTY_REQUEST, message: 3 })).toBe(false);
  });

  it('refuses a quantity the shop would not take, which would spoil the total', () => {
    expect(isRequest(request({ 1: 'deux' as unknown as number }))).toBe(false);
    expect(isRequest(request({ 1: 1.5 }))).toBe(false);
    expect(isRequest(request({ 1: 0 }))).toBe(false);
    expect(isRequest(request({ 1: -1 }))).toBe(false);
    expect(isRequest(request({ 1: MAX_QUANTITY + 1 }))).toBe(false);
    expect(isRequest(request({ 1: MAX_QUANTITY }))).toBe(true);
  });
});

describe('shopFilters', () => {
  it('counts the products of each category, by name', () => {
    expect(shopFilters(PRODUCTS)).toEqual([
      { slug: 'cadeaux', name: 'Cadeaux', count: 1 },
      { slug: 'desserts', name: 'Desserts', count: 3 },
    ]);
  });

  it('has none without products', () => {
    expect(shopFilters([])).toEqual([]);
  });
});

describe('filterProducts', () => {
  it('shows all without a search nor a category', () => {
    expect(filterProducts(PRODUCTS, '', '')).toEqual(PRODUCTS);
    expect(filterProducts(PRODUCTS, '   ', '')).toEqual(PRODUCTS);
  });

  it('keeps the products of a category', () => {
    expect(filterProducts(PRODUCTS, '', 'cadeaux')).toEqual([BOX]);
  });

  it('finds every word, whatever the case and accents, in the name, format or categories', () => {
    expect(filterProducts(PRODUCTS, 'PEPITES', '')).toEqual([COOKIES]);
    expect(filterProducts(PRODUCTS, 'boite 6', '')).toEqual([COOKIES]);
    expect(filterProducts(PRODUCTS, 'cadeau noel', '')).toEqual([BOX]);
    expect(filterProducts(PRODUCTS, 'cookies noel', '')).toEqual([]);
  });

  it('searches within the category chosen', () => {
    expect(filterProducts(PRODUCTS, 'cookies', 'cadeaux')).toEqual([]);
  });
});

describe('chosenLines', () => {
  it('lists the products asked for, in the order of the shop', () => {
    expect(chosenLines(PRODUCTS, { 3: 1, 1: 2 })).toEqual([
      { product: COOKIES, quantity: 2 },
      { product: BOX, quantity: 1 },
    ]);
  });

  it('leaves out a product no longer sold', () => {
    expect(chosenLines(PRODUCTS, { 99: 4, 2: 3 })).toEqual([{ product: FINANCIERS, quantity: 3 }]);
  });
});

describe('itemCount and requestTotal', () => {
  it('add up the products and their prices, to the cent', () => {
    const lines = chosenLines(PRODUCTS, { 1: 2, 2: 3 });
    expect(itemCount(lines)).toBe(5);
    // 3 × 0,10 € is 0,30 €, not 0,30000000000000004 €
    expect(requestTotal(lines)).toBe(24.3);
    expect(requestTotal([])).toBe(0);
  });
});

describe('changeQuantity', () => {
  it('adds and removes one', () => {
    const added = changeQuantity(EMPTY_REQUEST, PRODUCTS, 1, 1);
    expect(added.request.quantities).toEqual({ 1: 1 });
    expect(changeQuantity(added.request, PRODUCTS, 1, 1).request.quantities).toEqual({ 1: 2 });
  });

  it('forgets a product brought back to 0, and never goes below', () => {
    expect(changeQuantity(request({ 1: 1 }), PRODUCTS, 1, -1).request.quantities).toEqual({});
    expect(changeQuantity(EMPTY_REQUEST, PRODUCTS, 1, -1).request.quantities).toEqual({});
  });

  it('stops at the most the shop takes', () => {
    expect(changeQuantity(request({ 1: MAX_QUANTITY }), PRODUCTS, 1, 1).request.quantities).toEqual({ 1: MAX_QUANTITY });
  });

  it('refuses a new product once the request holds the most different ones', () => {
    const many = Array.from({ length: MAX_LINES }, (_, index) => product(index + 10, `Produit ${index}`, 1));
    const full = request(Object.fromEntries(many.map((known) => [known.id, 1])));
    const refused = changeQuantity(full, [...many, COOKIES], COOKIES.id, 1);

    expect(refused.error).toBe(`Une demande compte ${MAX_LINES} produits différents au plus`);
    expect(refused.request).toBe(full);
    // One already there can still change
    expect(changeQuantity(full, many, many[0]!.id, 1).error).toBeUndefined();
  });

  it('keeps the rest of the request', () => {
    expect(changeQuantity(request({}, { name: 'Léa', message: 'Sans noix' }), PRODUCTS, 2, 1).request).toEqual(
      request({ 2: 1 }, { name: 'Léa', message: 'Sans noix' }),
    );
  });
});

describe('productCount', () => {
  it('agrees with the number', () => {
    expect(productCount(1)).toBe('1 produit');
    expect(productCount(3)).toBe('3 produits');
  });
});

describe('afterSending', () => {
  it('starts a new request empty, the contact kept', () => {
    const sent = request({ 1: 2 }, { name: 'Léa', email: 'lea@example.fr', phone: '0600000000', wantedOn: '2026-12-24', message: 'Merci' });

    expect(afterSending(sent)).toEqual(request({}, { name: 'Léa', email: 'lea@example.fr', phone: '0600000000' }));
  });
});

describe('isComplete', () => {
  const lines = chosenLines(PRODUCTS, { 1: 1 });

  it('wants a name, a way to answer and something asked', () => {
    expect(isComplete(request({ 1: 1 }, { name: 'Léa', email: 'lea@example.fr' }), lines)).toBe(true);
    expect(isComplete(request({}, { name: 'Léa', phone: '0600000000', message: 'Un gâteau pour 8' }), [])).toBe(true);
  });

  it('is not complete without one of them', () => {
    expect(isComplete(request({ 1: 1 }, { name: '  ', email: 'lea@example.fr' }), lines)).toBe(false);
    expect(isComplete(request({ 1: 1 }, { name: 'Léa', email: ' ', phone: '' }), lines)).toBe(false);
    expect(isComplete(request({}, { name: 'Léa', email: 'lea@example.fr', message: '  ' }), [])).toBe(false);
  });
});
