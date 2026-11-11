// Ce qui sert aux deux scripts : le navigateur, le site, l'API.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

/** Le site, servi par la passerelle de la pile Docker. « localhost » : le seul hôte accepté par le SSR en local. */
export const BASE = process.env.BASE_URL ?? 'http://localhost:8000';

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1280, height: 900 };

/**
 * Chrome installé sur la machine (aucun navigateur téléchargé), sans fenêtre ; HEADED=1 pour la voir.
 * CHROME_CHANNEL=msedge pour Edge.
 */
export async function launch(options = {}) {
  return chromium.launch({ channel: process.env.CHROME_CHANNEL ?? 'chrome', headless: !process.env.HEADED, ...options });
}

export function folder(name) {
  const path = fileURLToPath(new URL(`./${name}/`, import.meta.url));
  mkdirSync(path, { recursive: true });
  return path;
}

export async function api(path) {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${path} : ${response.status}`);
  }
  return response.json();
}

/**
 * Une page en français, heure de Paris ; ses erreurs JavaScript notées dans `errors`. Sans le
 * service worker de l'application par défaut : il relaierait lui-même les appels à l'API, que
 * page.route() ne pourrait plus simuler (les notifications, elles, en ont besoin : serviceWorkers 'allow').
 */
export async function newPage(browser, viewport, errors = [], serviceWorkers = 'block') {
  const context = await browser.newContext({ viewport, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${page.url()} : ${error.message}`));
  return page;
}

/** Le bandeau des cookies, refusé s'il est là. */
export async function answerCookies(page) {
  const refuse = page.getByRole('button', { name: 'Refuser' });
  if (await refuse.isVisible().catch(() => false)) {
    await refuse.click();
  }
}

/**
 * Le back-office sans connexion Google : l'API « qui est connecté ? » répond dans le navigateur
 * seulement. Les pages s'affichent ; ce qu'elles demandent d'autre à l'API admin reste refusé.
 */
export async function fakeAdmin(page, version = 'locale') {
  await page.route('**/api/admin/me', (route) => route.fulfill({ json: { email: 'yona@example.fr', name: 'Yona' } }));
  await page.route('**/api/admin/version', (route) => route.fulfill({ json: { version } }));
  // Le compteur des retours non lus, demandé par le menu du back-office
  await page.route('**/api/admin/feedback/unread', (route) => route.fulfill({ json: { count: 0 } }));
  // De même pour les nouvelles commandes
  await page.route('**/api/admin/shop/orders/new-count', (route) => route.fulfill({ json: { count: 0 } }));
  // Les badges Historique, Journaux et Nouveautés : rien de nouveau, version lue
  const now = new Date().toISOString();
  await page.route('**/api/admin/history/unseen', (route) => route.fulfill({ json: { count: 0, since: now } }));
  await page.route('**/api/admin/logs/summary', (route) =>
    route.fulfill({ json: { errorsLast24Hours: 0, warningsLast24Hours: 0, lines: 0, unseenErrors: 0, since: now } }),
  );
  await page.route('**/api/admin/changelog/seen', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: { version } }) : route.fulfill({ status: 204 }),
  );
  await page.route('**/api/admin/claude', (route) => route.fulfill({ json: { available: true, model: 'claude-haiku-5-5' } }));
}

/** La recette la plus utile au parcours : des ingrédients et une étape minutée, sinon la première. */
export async function pickRecipe() {
  const { content } = await api('/api/recipes?size=50');
  if (!content.length) {
    throw new Error('Aucune recette publiée : créez-en une dans le back-office.');
  }
  let fallback = null;
  for (const card of content) {
    const recipe = await api(`/api/recipes/${card.slug}`);
    fallback ??= recipe;
    const steps = recipe.parts.flatMap((part) => part.steps);
    const ingredients = recipe.parts.flatMap((part) => part.ingredients);
    const timed = steps.findIndex((step) => step.durationMinutes);
    if (ingredients.length && timed >= 0) {
      return { recipe, steps, ingredients, timed };
    }
  }
  const steps = fallback.parts.flatMap((part) => part.steps);
  return { recipe: fallback, steps, ingredients: fallback.parts.flatMap((part) => part.ingredients), timed: -1 };
}

export function recipeUrl(recipe) {
  const main = recipe.categories[0];
  return `${BASE}/recettes/${main.slug}/${recipe.slug}`;
}

/**
 * Une page de l'application ouverte sans recharger le site, comme un lien suivi : ses données sont
 * alors demandées par le navigateur, que page.route() peut simuler (au premier chargement, le
 * serveur les a déjà lues lui-même, sans passer par le navigateur).
 */
export async function goClient(page, path) {
  await page.evaluate((target) => {
    history.pushState(null, '', target);
    dispatchEvent(new PopStateEvent('popstate', { state: null }));
  }, path);
  await page.waitForURL((url) => url.pathname === path.split('?')[0]);
}

/** reCAPTCHA sans Google : la case se coche d'elle-même, avec un jeton de test. */
export async function fakeRecaptcha(page) {
  await page.route('**/api/feedback/captcha', (route) => route.fulfill({ json: { siteKey: 'cle-e2e' } }));
  await page.route('https://www.google.com/recaptcha/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.grecaptcha = { render(box, options) { setTimeout(() => options.callback('jeton-e2e')); return 1; }, reset() {} };
        window.yonaRecaptchaReady();`,
    }),
  );
}
