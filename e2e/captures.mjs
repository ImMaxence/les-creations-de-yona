// Captures d'écran du ReadMe, dans docs/captures/ : `npm run captures` dans e2e/, le site lancé en local.
// Elles montrent les données de la base locale : à refaire (ou remplacer à la main) avec de vraies recettes,
// par exemple celles du site en ligne (pages publiques seulement, rien n'y est écrit) :
//   BASE_URL=https://les-creations-de-yona.fr RECIPE=tarte-aux-pommes-creme-d-amandes ONLY=telephone-recette npm run captures
// ONLY : les captures à refaire, séparées par des virgules (sans « .png ») ; toutes par défaut.
// RECIPE : l'adresse (slug) de la recette à montrer ; sinon celle que choisit le parcours.
import { fileURLToPath } from 'node:url';
import { BASE, DESKTOP, PHONE, answerCookies, api, fakeAdmin, goClient, launch, newPage, pickRecipe, recipeUrl } from './outils.mjs';

const OUT = fileURLToPath(new URL('../docs/captures/', import.meta.url));
const ONLY = process.env.ONLY?.split(',').map((name) => name.trim());

/** Faut-il refaire l'une de ces captures ? */
function wanted(...files) {
  return !ONLY || files.some((file) => ONLY.includes(file));
}

/** Après les animations d'arrivée, sans le bandeau des cookies. */
async function shoot(page, file, prepare = async () => {}) {
  if (!wanted(file)) {
    return;
  }
  await answerCookies(page);
  await prepare();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${file}.png` });
  console.log(`${file}.png`);
}

const browser = await launch();
const recipe = process.env.RECIPE ? await api(`/api/recipes/${process.env.RECIPE}`) : (await pickRecipe()).recipe;

if (wanted('pc-accueil', 'pc-recettes', 'pc-recette')) {
  const desktop = await newPage(browser, DESKTOP);
  await desktop.goto(BASE + '/', { waitUntil: 'networkidle' });
  await shoot(desktop, 'pc-accueil');
  await desktop.goto(BASE + '/recettes', { waitUntil: 'networkidle' });
  await shoot(desktop, 'pc-recettes');
  await desktop.goto(recipeUrl(recipe), { waitUntil: 'networkidle' });
  await shoot(desktop, 'pc-recette');
  await desktop.context().close();
}

// Le back-office sans connexion Google : la page « Nouveautés », la seule sans données de l'API admin
if (wanted('pc-administration')) {
  const admin = await newPage(browser, DESKTOP);
  await fakeAdmin(admin, '2.14.0');
  await admin.goto(BASE + '/admin/nouveautes', { waitUntil: 'load' });
  await admin.locator('details.changelog__version').first().waitFor();
  await shoot(admin, 'pc-administration');
  await admin.context().close();
}

// Les IA du back-office, sans connexion Google : les listes de l'API admin sont vides
if (wanted('pc-ia-recette', 'pc-ia-image')) {
  const admin = await newPage(browser, DESKTOP);
  await admin.route('**/api/admin/**', (route) => route.fulfill({ json: [] }));
  await fakeAdmin(admin, '2.14.0');
  await admin.route('**/api/admin/recipe-ai', (route) => route.fulfill({ json: { available: true } }));
  const open = async () => {
    await admin.goto(BASE + '/admin/recettes/nouvelle', { waitUntil: 'load' });
    await admin.getByRole('button', { name: "Remplir avec l'IA" }).first().waitFor();
    await answerCookies(admin);
  };
  await open();
  await shoot(admin, 'pc-ia-recette', async () => {
    await admin.getByRole('button', { name: "Remplir avec l'IA" }).first().click();
    const dialog = admin.locator('yona-recipe-ai-dialog');
    await dialog.getByRole('button', { name: /IA locale/ }).click();
    await dialog.getByRole('button', { name: 'Essayer avec un exemple' }).click();
  });
  await open();
  await shoot(admin, 'pc-ia-image', () => admin.getByRole('button', { name: "Générer avec l'IA" }).first().click());
  await admin.context().close();
}

// Une recette, son mode cuisine et la liste de courses, sur téléphone
if (wanted('telephone-recette', 'telephone-ingredients', 'telephone-mode-cuisine', 'telephone-liste-de-courses')) {
  const phone = await newPage(browser, PHONE);
  await phone.goto(recipeUrl(recipe), { waitUntil: 'networkidle' });
  await shoot(phone, 'telephone-recette');
  await shoot(phone, 'telephone-ingredients', () => phone.locator('#ingredients-title, h2:has-text("Ingrédients")').first().scrollIntoViewIfNeeded());
  if (wanted('telephone-mode-cuisine')) {
    await answerCookies(phone);
    await phone.getByRole('button', { name: 'Mode cuisine' }).click();
    const dialog = phone.getByRole('dialog', { name: 'Mode cuisine' });
    await dialog.waitFor();
    if (await dialog.getByRole('button', { name: "C'est parti" }).isVisible()) {
      await dialog.getByRole('button', { name: "C'est parti" }).click();
    }
    await shoot(phone, 'telephone-mode-cuisine');
    await dialog.getByRole('button', { name: 'Fermer' }).click();
  }
  if (wanted('telephone-liste-de-courses')) {
    await answerCookies(phone);
    await phone.getByRole('button', { name: /ma liste de courses/i }).click();
    await phone.getByRole('link', { name: 'Voir ma liste' }).click();
    await phone.waitForURL('**/liste-de-courses');
    await phone.waitForLoadState('networkidle');
    // Sans le message « Ingrédients ajoutés » de la recette
    await phone.locator('.toast__close').click();
    await shoot(phone, 'telephone-liste-de-courses');
  }
  await phone.context().close();
}

// Le thème sombre, choisi par le système du téléphone (« Auto »)
if (wanted('telephone-sombre')) {
  const dark = await browser.newContext({ viewport: PHONE, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'dark', serviceWorkers: 'block' });
  const page = await dark.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await shoot(page, 'telephone-sombre');
  await dark.close();
}

// Les notifications ont besoin du service worker de l'application (qui empêche d'attendre le calme du réseau)
if (wanted('telephone-installer', 'telephone-notifications', 'telephone-glossaire')) {
  const phone = await newPage(browser, PHONE, [], 'allow');
  await phone.goto(BASE + '/installer', { waitUntil: 'load' });
  await shoot(phone, 'telephone-installer');
  await phone.goto(BASE + '/', { waitUntil: 'load' });
  await shoot(phone, 'telephone-notifications', () => phone.locator('section.notify').scrollIntoViewIfNeeded());
  await phone.goto(BASE + '/glossaire', { waitUntil: 'load' });
  await shoot(phone, 'telephone-glossaire');
  await phone.context().close();
}

// Les nouveautés de la 2.4 : boutique, Mon CAP en articles, comptabilité et factures. La base locale n'en a
// souvent pas : données simulées (les photos, elles, sont celles des recettes du site)
// Les photos des recettes sucrées : la boutique vend des pâtisseries ; au-delà, le visuel par défaut
const photos = (await api('/api/recipes?theme=SWEET&size=12')).content.map((card) => card.imageId).filter(Boolean);
const photo = (index) => photos[index];

if (wanted('pc-boutique', 'telephone-boutique')) {
  const shop = {
    mode: 'FRIENDS',
    open: true,
    pickupInfo: 'Retrait le samedi matin, ou livré en main propre',
    products: [
      { id: 1, name: 'Cookies aux pépites de chocolat', format: 'Boîte de 6', batchSize: 6, price: 12, unitPrice: 2, imageId: photo(0), categories: [{ slug: 'biscuits', name: 'Biscuits' }] },
      { id: 2, name: 'Tarte au citron meringuée', format: "À l'unité", price: 24, portionLabel: 'la tarte, 8 parts', imageId: photo(1), categories: [{ slug: 'tartes', name: 'Tartes' }] },
      { id: 3, name: 'Sablés de Noël', format: 'Boîte de 12', batchSize: 12, price: 9.5, unitPrice: 0.79, imageId: photo(2), categories: [{ slug: 'biscuits', name: 'Biscuits' }] },
      { id: 4, name: 'Cake marbré', format: "À l'unité", price: 14, portionLabel: 'le cake, 10 tranches', imageId: photo(3), categories: [{ slug: 'gateaux', name: 'Gâteaux' }] },
      { id: 5, name: 'Financiers aux amandes', format: 'Boîte de 8', batchSize: 8, price: 10, unitPrice: 1.25, imageId: photo(4), categories: [{ slug: 'biscuits', name: 'Biscuits' }] },
      { id: 6, name: 'Tarte aux pommes', format: "À l'unité", price: 20, portionLabel: 'la tarte, 6 parts', imageId: photo(5), categories: [{ slug: 'tartes', name: 'Tartes' }] },
    ],
  };
  const request = JSON.stringify({ quantities: { 1: 2, 2: 1 }, name: '', email: '', phone: '', wantedOn: '', message: '' });
  for (const [file, viewport] of [['pc-boutique', DESKTOP], ['telephone-boutique', PHONE]]) {
    if (!wanted(file)) {
      continue;
    }
    const page = await newPage(browser, viewport);
    await page.route('**/api/shop', (route) => route.fulfill({ json: shop }));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await answerCookies(page);
    await page.evaluate((kept) => localStorage.setItem('yona-shop-request', kept), request);
    await goClient(page, '/boutique');
    await page.locator('.product').first().waitFor();
    await page.waitForLoadState('networkidle');
    await shoot(page, file, async () => {
      if (viewport === PHONE) {
        await page.locator('.request-bar').click();
        await page.locator('dialog.panel[open]').waitFor();
      }
    });
    await page.context().close();
  }
}

if (wanted('pc-mon-cap', 'telephone-mon-cap')) {
  const cards = [
    { id: 3, slug: 'mon-premier-examen-blanc', title: 'Mon premier examen blanc', subtitle: 'Une pâte feuilletée récalcitrante', happenedOn: '2026-11-01', style: 'NOTEBOOK', imageId: photo(6), excerpt: 'Cinq heures pour une tarte, un entremets et des choux : le récit de la journée, ce qui a marché et ce que je referai autrement' },
    { id: 2, slug: 'les-choux', title: 'Les choux, enfin réussis', subtitle: 'Pas à pas', happenedOn: '2026-10-12', style: 'CLASSIC', imageId: photo(7), excerpt: 'Dessécher la panade plus longtemps, et ne plus ouvrir le four : les deux gestes qui ont tout changé' },
    { id: 1, slug: 'inscription', title: 'Inscription au CAP', happenedOn: '2026-09-03', style: 'CLASSIC', excerpt: 'Le dossier est parti : candidate libre, examen en juin' },
  ];
  const article = {
    ...cards[0],
    updatedAt: '2026-11-02T08:00:00Z',
    blocks: [
      { type: 'TEXT', text: 'Lever à 6 h, plan de travail nettoyé, balance tarée : **cinq heures** pour une tarte, un entremets et des choux.\n\n## Le matin\nLa pâte feuilletée a résisté : beurre trop froid, il a cassé au premier tour.' },
      { type: 'STEPS', photos: [{ imageId: photo(8), caption: 'Détrempe' }, { imageId: photo(9), caption: 'Premier tour' }, { imageId: photo(10), caption: 'Cuisson' }] },
      { type: 'TIP', text: 'Sortir le beurre 15 minutes avant de tourer : souple comme la détrempe' },
    ],
  };
  if (wanted('pc-mon-cap')) {
    const page = await newPage(browser, DESKTOP);
    await page.route('**/api/cap/entries', (route) => route.fulfill({ json: cards }));
    await page.route(`**/api/cap/entries/${article.slug}`, (route) => route.fulfill({ json: article }));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await answerCookies(page);
    await goClient(page, `/mon-cap/${article.slug}`);
    await page.locator('yona-cap-article-view h1').waitFor();
    await page.waitForLoadState('networkidle');
    await shoot(page, 'pc-mon-cap');
    await page.context().close();
  }
  if (wanted('telephone-mon-cap')) {
    const page = await newPage(browser, PHONE);
    await page.route('**/api/cap/entries', (route) => route.fulfill({ json: cards }));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await answerCookies(page);
    await goClient(page, '/mon-cap');
    await page.locator('.timeline .card').first().waitFor();
    await page.waitForLoadState('networkidle');
    await shoot(page, 'telephone-mon-cap');
    await page.context().close();
  }
}

if (wanted('pc-comptabilite', 'pc-facture')) {
  const month = (income, expense) => ({ income, expense, balance: Math.round((income - expense) * 100) / 100 });
  const months = [
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [96, 64.3], [148, 91.2], [214, 118.6], [0, 0],
  ].map(([income, expense], index) => ({ month: index + 1, totals: month(income, expense) }));
  const entry = (id, occurredOn, kind, category, label, amount, more = {}) => ({
    id, occurredOn, kind, category, label, amount, adminEmail: 'yona@example.fr', purchases: [], receipt: false, ...more,
  });
  const overview = {
    year: 2026, period: 'YEAR', number: 1, from: '2026-01-01', to: '2026-12-31', years: [2026], admins: ['yona@example.fr'],
    totals: month(458, 274.1), previousTotals: month(0, 0),
    figures: { orders: 21, offeredOrders: 2, averageBasket: 24.1, marginRate: 0.4 },
    months,
    expensesByCategory: [
      { category: 'INGREDIENTS', amount: 186.4 }, { category: 'PACKAGING', amount: 48.2 }, { category: 'EQUIPMENT', amount: 39.5 },
    ],
    bestSellers: [
      { productId: 1, name: 'Cookies aux pépites de chocolat', quantity: 14, revenue: 168, margin: 92.4 },
      { productId: 2, name: 'Tarte au citron meringuée', quantity: 6, revenue: 144, margin: 70.2 },
      { productId: 3, name: 'Sablés de Noël', quantity: 9, revenue: 85.5 },
    ],
    entries: [
      entry(8, '2026-11-09', 'INCOME', 'SALE', 'Commande n° 21', 24, { orderId: 21, orderSummary: '1 × Tarte au citron meringuée', margin: 11.7 }),
      entry(7, '2026-11-06', 'EXPENSE', 'INGREDIENTS', 'Courses du marché', 31.4, {
        receipt: true,
        purchases: [
          { item: 'Beurre doux', ingredientId: 1, quantity: 1, unit: 'KG', price: 9.8, pricePerUnit: 9.8, priceUnit: 'KG' },
          { item: 'Farine T55', ingredientId: 2, quantity: 5, unit: 'KG', price: 6.5, pricePerUnit: 1.3, priceUnit: 'KG' },
          { item: 'Œufs', ingredientId: 3, quantity: 30, unit: 'PIECE', price: 15.1, pricePerUnit: 0.5, priceUnit: 'PIECE' },
        ],
      }),
      entry(6, '2026-11-02', 'INCOME', 'SALE', 'Commande n° 20', 24, { orderId: 20, orderSummary: '2 × Cookies aux pépites de chocolat', margin: 13.2 }),
      entry(5, '2026-10-28', 'EXPENSE', 'PACKAGING', 'Boîtes kraft', 12),
    ],
    byAdmin: [],
  };
  const costs = [{
    productId: 2, name: 'Tarte au citron meringuée', recipeTitle: 'Tarte au citron meringuée', recipeShare: 1, price: 24, cost: 12.3, margin: 11.7, marginRate: 0.4875, complete: true,
    lines: [
      { name: 'Farine T55', quantity: 250, unit: 'g', pricePerUnit: 1.3, priceUnit: 'KG', cost: 0.33 },
      { name: 'Beurre doux', quantity: 125, unit: 'g', pricePerUnit: 9.8, priceUnit: 'KG', cost: 1.23 },
      { name: 'Citrons', quantity: 4, pricePerUnit: 0.6, priceUnit: 'PIECE', cost: 2.4 },
      { name: 'Œufs', quantity: 6, pricePerUnit: 0.5, priceUnit: 'PIECE', cost: 3 },
    ],
    packaging: { name: 'Boîte à tarte', quantity: 1, pricePerUnit: 1.2, priceUnit: 'PIECE', cost: 1.2 },
  }];
  const invoice = {
    id: 3, number: '2026-0003', orderId: 21, issuedOn: '2026-11-09', customerName: 'Léa Martin', customerEmail: 'lea.martin@example.fr',
    sellerName: 'Yona, Les créations de Yona', sellerAddress: '12 rue des Lilas\n69003 Lyon', sellerSiret: '12345678900012', sellerContact: 'bonjour@les-creations-de-yona.fr',
    vatMention: 'TVA non applicable, art. 293 B du CGI', amount: 22, linesTotal: 24, adminEmail: 'yona@example.fr',
    lines: [{ label: 'Tarte au citron meringuée', detail: 'la tarte, 8 parts', quantity: 1, unitPrice: 24, total: 24 }],
  };
  const admin = await newPage(browser, DESKTOP);
  await fakeAdmin(admin, '2.14.0');
  await admin.route('**/api/admin/accounting?**', (route) => route.fulfill({ json: overview }));
  await admin.route('**/api/admin/accounting/costs', (route) => route.fulfill({ json: costs }));
  await admin.route('**/api/admin/invoices?**', (route) => route.fulfill({ json: [{ id: 3, number: '2026-0003', orderId: 21, issuedOn: '2026-11-09', customerName: 'Léa Martin', amount: 22 }] }));
  await admin.route('**/api/admin/invoices/3', (route) => route.fulfill({ json: invoice }));
  if (wanted('pc-comptabilite')) {
    await admin.goto(BASE + '/admin/boutique/comptabilite', { waitUntil: 'load' });
    await admin.locator('yona-accounting-chart').waitFor();
    await shoot(admin, 'pc-comptabilite');
  }
  if (wanted('pc-facture')) {
    await admin.goto(BASE + '/admin/boutique/factures/3', { waitUntil: 'load' });
    await admin.locator('.sheet').waitFor();
    await shoot(admin, 'pc-facture');
  }
  await admin.context().close();
}

await browser.close();
