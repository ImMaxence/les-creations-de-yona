// Captures d'écran du ReadMe, dans docs/captures/ : `npm run captures` dans e2e/, le site lancé en local.
// Elles montrent les données de la base locale : à refaire (ou remplacer à la main) avec de vraies recettes,
// par exemple celles du site en ligne (pages publiques seulement, rien n'y est écrit) :
//   BASE_URL=https://les-creations-de-yona.fr RECIPE=tarte-aux-pommes-creme-d-amandes ONLY=telephone-recette npm run captures
// ONLY : les captures à refaire, séparées par des virgules (sans « .png ») ; toutes par défaut.
// RECIPE : l'adresse (slug) de la recette à montrer ; sinon celle que choisit le parcours.
import { fileURLToPath } from 'node:url';
import { BASE, DESKTOP, PHONE, answerCookies, api, fakeAdmin, launch, newPage, pickRecipe, recipeUrl } from './outils.mjs';

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
  await fakeAdmin(admin, '1.12.0');
  await admin.goto(BASE + '/admin/nouveautes', { waitUntil: 'load' });
  await admin.locator('details.changelog__version').first().waitFor();
  await shoot(admin, 'pc-administration');
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

await browser.close();
