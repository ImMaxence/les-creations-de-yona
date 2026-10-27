// Captures d'écran du ReadMe, dans docs/captures/ : `npm run captures` dans e2e/, le site lancé en local.
// Elles montrent les données de la base locale : à refaire (ou remplacer à la main) avec de vraies recettes.
import { fileURLToPath } from 'node:url';
import { BASE, DESKTOP, PHONE, answerCookies, fakeAdmin, launch, newPage } from './outils.mjs';

const OUT = fileURLToPath(new URL('../docs/captures/', import.meta.url));

/** Après les animations d'arrivée, sans le bandeau des cookies. */
async function shoot(page, file, prepare = async () => {}) {
  await answerCookies(page);
  await prepare();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + file });
  console.log(file);
}

const browser = await launch();

const desktop = await newPage(browser, DESKTOP);
await desktop.goto(BASE + '/', { waitUntil: 'networkidle' });
await shoot(desktop, 'pc-accueil.png');
await desktop.goto(BASE + '/recettes', { waitUntil: 'networkidle' });
await shoot(desktop, 'pc-recettes.png');
await desktop.context().close();

// Le back-office sans connexion Google : la page « Nouveautés », la seule sans données de l'API admin
const admin = await newPage(browser, DESKTOP);
await fakeAdmin(admin, '3.4.0');
await admin.goto(BASE + '/admin/nouveautes', { waitUntil: 'load' });
await admin.locator('details.changelog__version').first().waitFor();
await shoot(admin, 'pc-administration.png');
await admin.context().close();

// Les notifications ont besoin du service worker de l'application (qui empêche d'attendre le calme du réseau)
const phone = await newPage(browser, PHONE, [], 'allow');
await phone.goto(BASE + '/installer', { waitUntil: 'load' });
await shoot(phone, 'telephone-installer.png');
await phone.goto(BASE + '/', { waitUntil: 'load' });
await shoot(phone, 'telephone-notifications.png', () => phone.locator('section.notify').scrollIntoViewIfNeeded());
await phone.goto(BASE + '/glossaire', { waitUntil: 'load' });
await shoot(phone, 'telephone-glossaire.png');
await phone.context().close();

await browser.close();
