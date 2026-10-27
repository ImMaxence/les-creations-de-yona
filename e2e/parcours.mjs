// Parcours dans Chrome contre le site lancé en local : `npm test` dans e2e/ (voir docs/developpement.md).
// Il choisit lui-même une recette publiée (avec des ingrédients et une étape minutée) : aucune donnée à préparer.
// Captures d'écran dans e2e/resultats/. Code de sortie 1 si une vérification échoue.
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';
import { BASE, DESKTOP, PHONE, answerCookies, api, fakeAdmin, folder, launch, newPage, pickRecipe, recipeUrl } from './outils.mjs';

const SHOTS = folder('resultats');
/** Règles d'axe vérifiées : WCAG 2.1 niveaux A et AA, et ses bonnes pratiques. Aucun écart toléré. */
const AXE_RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
/**
 * Scores minimaux de Lighthouse (sur 100), téléphone simulé en 4G lente. La performance varie de
 * quelques points d'une mesure à l'autre : un seuil sous le score habituel (78 à 90 en 3.4), pour
 * ne signaler que les vraies régressions ; les autres catégories sont stables.
 */
const LIGHTHOUSE_MIN = { performance: 70, accessibility: 100, 'best-practices': 95, seo: 100 };
const LIGHTHOUSE_NAMES = { performance: 'performance', accessibility: 'accessibilité', 'best-practices': 'bonnes pratiques', seo: 'SEO' };
const LIGHTHOUSE_PORT = 9333;
const results = [];
const errors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ' — ' + detail : ''}`);
}

/** Une partie du parcours : une erreur inattendue la marque en échec, la suite continue. */
async function part(title, run) {
  console.log(`\n${title}`);
  try {
    await run();
  } catch (error) {
    check(`${title} : terminé sans erreur`, false, error.message.split('\n')[0]);
  }
}

const { recipe, steps, ingredients, timed } = await pickRecipe();
const menus = await api('/api/menus');
console.log(`Recette utilisée : ${recipe.title} (${ingredients.length} ingrédients, ${steps.length} étapes)`);
const browser = await launch();

await part('API', async () => {
  const malformed = await fetch(`${BASE}/api/recipes?ingredient=Cr%E8me`);
  check('Adresse mal encodée : 400, pas 500', malformed.status === 400, String(malformed.status));
  const aisles = await fetch(`${BASE}/api/ingredients/aisles`);
  check('Rayons des ingrédients publics', aisles.status === 200, String(aisles.status));
  const names = ingredients.slice(0, 2).map((line) => `ingredient=${encodeURIComponent(line.name)}`).join('&');
  const both = await api(`/api/recipes?${names}`);
  check('Recherche à plusieurs ingrédients : la recette en fait partie', both.content.some((card) => card.slug === recipe.slug));
  const tooMany = await fetch(`${BASE}/api/recipes?${'ingredient=a&'.repeat(6)}`);
  check('Plus de 5 ingrédients refusés', tooMany.status === 400, String(tooMany.status));
});

await part('Accueil (ordinateur)', async () => {
  const page = await newPage(browser, DESKTOP, errors, 'allow');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await answerCookies(page);
  const order = await page.$$eval('main section', (sections) =>
    sections
      .map((section) =>
        ['hero', 'latest', 'menus', 'about', 'notify', 'categories'].find((name) => section.classList.contains(name)),
      )
      .filter(Boolean),
  );
  const expected = `hero > latest${menus.length ? ' > menus' : ''} > about > notify > categories`;
  check('Ordre des sections', order.join(' > ') === expected, order.join(' > '));
  check(
    menus.length ? '« Menus » dans la barre du haut' : 'Pas de « Menus » sans menu publié',
    (await page.locator('yona-header nav.nav').getByRole('link', { name: 'Menus' }).count()) === (menus.length ? 1 : 0),
  );
  check('Barre du haut sans « Installer l’application »', (await page.locator('yona-header nav.nav').getByText("Installer l'application").count()) === 0);
  check('Pied de page avec « Installer l’application »', (await page.locator('footer').getByRole('link', { name: "Installer l'application" }).count()) === 1);
  check('Encart des notifications', await page.locator('section.notify button').isVisible());

  // Le navigateur annonce qu'il peut installer l'application
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt');
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
  });
  const banner = page.getByRole('region', { name: 'Les recettes à portée de main' });
  await banner.waitFor({ timeout: 3000 }).catch(() => {});
  check('Bandeau d’installation', await banner.isVisible());
  await banner.getByRole('button', { name: 'Plus tard' }).click();
  const dismissed = await page.evaluate(() => localStorage.getItem('yona-install-banner-dismissed'));
  check('« Plus tard » le cache et note la date', !(await banner.isVisible()) && !!dismissed);
  await page.context().close();
});

await part('Recherche (téléphone)', async () => {
  const page = await newPage(browser, PHONE, errors);
  await page.goto(BASE + '/recettes', { waitUntil: 'networkidle' });
  await answerCookies(page);
  // Les résultats ralentis : ce qui s'affiche en attendant se voit
  await page.route('**/api/recipes?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  const [first, second] = ingredients.map((line) => line.name);
  const trigger = page.getByRole('combobox', { name: /ingrédient/i });
  await trigger.click();
  await page.getByRole('option', { name: first, exact: true }).click();
  const labels = [];
  for (let i = 0; i < 8; i++) {
    labels.push((await trigger.textContent()).trim());
    await page.waitForTimeout(150);
  }
  check('Le menu ne montre jamais l’ingrédient choisi', !labels.includes(first) && labels[0] === 'Et aussi…', [...new Set(labels)].join(' → '));
  check('Puce affichée sans attendre', (await page.locator('.chosen-ingredients__chip').count()) === 1);
  if (second) {
    await page.waitForTimeout(1500);
    await trigger.click();
    await page.getByRole('option', { name: second, exact: true }).click();
    await page.locator('.recipes__count').filter({ hasText: '»  et «' }).or(page.locator('.recipes__count').filter({ hasText: second })).first().waitFor();
    const count = (await page.locator('.recipes__count').textContent()).replace(/\s+/g, ' ').trim();
    check('Deux ingrédients : compteur', count.includes(`« ${first} » et « ${second} »`), count);
    await page.screenshot({ path: SHOTS + 'recherche-2-ingredients.png' });
    await page.getByRole('button', { name: `Retirer ${first}` }).click();
    await page.waitForURL((url) => !decodeURIComponent(url.search).includes(first));
    check('Puce retirée', (await page.locator('.chosen-ingredients__chip').count()) === 1);
  }
  await page.getByRole('link', { name: 'Effacer tous les filtres' }).click();
  await page.waitForURL((url) => !url.search.includes('ingredient'));
  check('« Effacer tous les filtres »', (await page.locator('.chosen-ingredients').count()) === 0);
  await page.context().close();
});

await part('Recette et mode cuisine (téléphone, horloge maîtrisée)', async () => {
  const page = await newPage(browser, PHONE, errors);
  await page.clock.install();
  await page.goto(recipeUrl(recipe), { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Mode cuisine' }).waitFor();
  await page.waitForTimeout(1000);
  await answerCookies(page);

  const notes = page.getByRole('textbox', { name: 'Mes notes' });
  await notes.fill('10 min de plus dans mon four');
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  check('Mes notes gardées au rechargement', (await notes.inputValue()) === '10 min de plus dans mon four');
  const equipment = page.getByRole('region', { name: 'Matériel' });
  check(
    recipe.equipment.length ? 'Matériel affiché' : 'Pas de bloc « Matériel » sans matériel',
    (await equipment.count()) === (recipe.equipment.length ? 1 : 0),
  );

  await page.getByRole('button', { name: 'Mode cuisine' }).click();
  const dialog = page.getByRole('dialog', { name: 'Mode cuisine' });
  const miseEnPlace = dialog.getByRole('region', { name: 'Mise en place' });
  check('Ouvert sur la mise en place', await miseEnPlace.isVisible());
  check('Mise en place : mes notes', (await miseEnPlace.textContent()).includes('10 min de plus dans mon four'));
  await miseEnPlace.locator('li').first().click();
  await page.screenshot({ path: SHOTS + 'mise-en-place.png' });
  await dialog.getByRole('button', { name: "C'est parti" }).click();
  check('« C’est parti » : étape 1', (await dialog.locator('.cooking__where').textContent()).includes(`Étape 1 sur ${steps.length}`));
  await dialog.getByRole('button', { name: 'Précédente' }).click();
  check('Retour à la mise en place, case cochée gardée', await miseEnPlace.locator('li').first().evaluate((li) => !!li.querySelector('input:checked')));
  await dialog.getByRole('button', { name: "C'est parti" }).click();

  // Un minuteur libre, sur une étape sans durée
  const free = steps.findIndex((step) => !step.durationMinutes);
  if (free >= 0) {
    for (let i = 0; i < free; i++) {
      await dialog.getByRole('button', { name: 'Suivante' }).click();
    }
    await dialog.getByRole('button', { name: 'Une minute de plus' }).click();
    await dialog.getByRole('button', { name: /Lancer un minuteur de 6 min/ }).click();
    check('Minuteur libre de 6 min', (await dialog.locator('.timer__clock').textContent()).trim() === '6:00');
    await dialog.getByRole('button', { name: 'Remettre le minuteur à zéro' }).click();
    for (let i = 0; i < free; i++) {
      await dialog.getByRole('button', { name: 'Précédente' }).click();
    }
  }

  if (timed < 0) {
    check('Une recette avec une étape minutée, pour la suite', false, 'aucune');
    return;
  }
  for (let i = 0; i < timed; i++) {
    await dialog.getByRole('button', { name: 'Suivante' }).click();
  }
  const minutes = steps[timed].durationMinutes;
  const start = `${minutes}:00`;
  const clock = dialog.locator('.timer__clock');
  await page.clock.runFor(4300);
  await dialog.getByRole('button', { name: /Lancer le minuteur/ }).click();
  check(`Minuteur au lancement : ${start}`, (await clock.textContent()).trim() === start, (await clock.textContent()).trim());
  await page.clock.runFor(minutes * 60_000 + 500);
  const ringing = dialog.locator('.ringing');
  check('Fin : « c’est prêt »', await ringing.isVisible());
  check('Un seul « + 1 min » pendant la sonnerie', (await dialog.getByRole('button', { name: /1 min|Ajouter une minute/ }).count()) === 1);
  await ringing.getByRole('button', { name: '+ 1 min' }).click();
  check('« + 1 min » : 1:00', (await clock.textContent()).trim() === '1:00');

  // Le mode fermé, puis une autre page : le minuteur continue
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  const bar = page.getByRole('complementary', { name: 'Minuteurs du mode cuisine' });
  check('Mode fermé : barre des minuteurs', await bar.isVisible());
  await page.evaluate(() => window.scrollTo(0, 0));
  // Le logo, toujours visible (sur téléphone, les liens de la barre sont dans le menu)
  await page.locator('yona-header').getByRole('link', { name: 'Les créations de Yona, accueil' }).click();
  await page.waitForURL(`${BASE}/`);
  await page.clock.runFor(1000);
  check('Sur une autre page : la barre et la recette', (await bar.textContent()).includes(recipe.title), (await bar.textContent()).replace(/\s+/g, ' ').trim());
  await page.screenshot({ path: SHOTS + 'barre-autre-page.png' });
  await bar.getByRole('button', { name: /Reprendre/ }).click();
  await page.waitForURL(recipeUrl(recipe));
  await dialog.waitFor();
  check('« Reprendre » : la recette, le mode ouvert à l’étape', (await dialog.locator('.cooking__where').textContent()).includes(`Étape ${timed + 1}`));
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await page.clock.runFor(60_000);
  check('Fin, mode fermé : « c’est prêt » dans la barre', await bar.getByRole('alert').isVisible());
  await bar.getByRole('button', { name: 'Arrêter' }).click();
  check('« Arrêter » : plus de barre', !(await bar.isVisible()));

  // Liste de courses rangée par rayon (les rayons simulés : ils se choisissent dans le back-office)
  await page.getByRole('button', { name: /ma liste de courses/i }).click();
  const shelved = ingredients.slice(0, 2).map((line, index) => ({ name: line.name, aisle: index ? 'DAIRY_EGGS' : 'FRUITS_VEGETABLES' }));
  await page.route('**/api/ingredients/aisles', (route) => route.fulfill({ json: shelved }));
  await page.getByRole('link', { name: 'Voir ma liste' }).click();
  await page.locator('.aisle').first().waitFor();
  const headings = await page.locator('.aisle').allTextContents();
  const expected = ['Fruits et légumes', ...(shelved.length > 1 ? ['Crèmerie, œufs'] : []), ...(ingredients.length > 2 ? ['Autres'] : [])];
  check('Liste de courses par rayon', headings.join(' | ') === expected.join(' | '), headings.join(' | '));
  await page.screenshot({ path: SHOTS + 'liste-par-rayon.png', fullPage: true });
  await page.context().close();
});

await part('Menus (téléphone)', async () => {
  if (!menus.length) {
    check('Un menu publié, pour cette partie', false, 'aucun : créez-en un dans le back-office');
    return;
  }
  const page = await newPage(browser, PHONE, errors);
  await page.goto(BASE + '/menus', { waitUntil: 'networkidle' });
  await answerCookies(page);
  const cards = page.locator('yona-menu-card');
  check('Page des menus : un par menu publié', (await cards.count()) === menus.length, String(await cards.count()));
  await cards.first().click();
  await page.waitForURL(`${BASE}/menus/${menus[0].slug}`);
  const detail = await api(`/api/menus/${menus[0].slug}`);
  const titles = (await page.locator('yona-recipe-card .card__title').allTextContents()).map((title) => title.trim());
  check('Ses recettes, dans l’ordre choisi', titles.join(' | ') === detail.recipes.map((card) => card.title).join(' | '), titles.join(' | '));
  await page.getByRole('button', { name: 'Tout ajouter à ma liste de courses' }).click();
  await page.getByRole('link', { name: 'Voir ma liste' }).click();
  await page.waitForURL(`${BASE}/liste-de-courses`);
  await page.locator('.items').first().waitFor();
  const listed = await page.evaluate(() => JSON.parse(localStorage.getItem('yona-shopping-list')).recipes.map((r) => r.slug));
  check('« Tout ajouter » : toutes ses recettes dans la liste', detail.recipes.every((card) => listed.includes(card.slug)), listed.join(', '));
  await page.screenshot({ path: SHOTS + 'menu-liste.png' });
  await page.context().close();
});

await part('Minuteurs après un rechargement (horloge maîtrisée)', async () => {
  if (timed < 0) {
    return;
  }
  const page = await newPage(browser, PHONE, errors);
  await page.clock.install();
  await page.goto(recipeUrl(recipe), { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Mode cuisine' }).waitFor();
  await page.waitForTimeout(1000);
  await answerCookies(page);
  await page.getByRole('button', { name: 'Mode cuisine' }).click();
  const dialog = page.getByRole('dialog', { name: 'Mode cuisine' });
  await dialog.getByRole('button', { name: "C'est parti" }).click();
  for (let i = 0; i < timed; i++) {
    await dialog.getByRole('button', { name: 'Suivante' }).click();
  }
  await dialog.getByRole('button', { name: /Lancer le minuteur/ }).click();
  await page.clock.runFor(60_000);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const bar = page.getByRole('complementary', { name: 'Minuteurs du mode cuisine' });
  const minutes = steps[timed].durationMinutes;
  // Une minute et quelques secondes (le rechargement) écoulées
  const shown = Number(/Étape \d+ : (\d+):/.exec(await bar.textContent())?.[1]);
  check('Rechargée : le minuteur continue', shown === minutes - 1 || shown === minutes - 2, (await bar.textContent()).replace(/\s+/g, ' ').trim());
  const wake = bar.getByRole('button', { name: 'Touchez pour réactiver la sonnerie' });
  check('« Touchez pour réactiver la sonnerie »', await wake.isVisible());
  await page.screenshot({ path: SHOTS + 'minuteur-apres-rechargement.png' });
  // Un appui sur la page, hors de la barre
  await page.mouse.click(PHONE.width / 2, 300);
  // Horloge simulée : la page ne se redessine qu'en avançant le temps
  await page.clock.runFor(500);
  check('Un appui n’importe où réactive la sonnerie', !(await wake.isVisible()));
  await page.context().close();
});

await part('Accessibilité (axe, téléphone)', async () => {
  const paths = ['/', '/recettes', new URL(recipeUrl(recipe)).pathname, '/glossaire', '/installer', '/liste-de-courses', '/favoris'];
  if (menus.length) {
    paths.push('/menus', `/menus/${menus[0].slug}`);
  }
  for (const path of paths) {
    const page = await newPage(browser, PHONE, errors);
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await answerCookies(page);
    await page.waitForTimeout(800);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_RULES).analyze();
    check(
      `${path} : aucun problème d’accessibilité`,
      violations.length === 0,
      violations.map((v) => `[${v.impact}] ${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' | ')})`).join(' ; '),
    );
    await page.context().close();
  }
});

await part('Vitesse et qualité (Lighthouse, téléphone simulé)', async () => {
  // Un navigateur à part : Lighthouse le pilote par son port de débogage
  const audited = await launch({ args: [`--remote-debugging-port=${LIGHTHOUSE_PORT}`] });
  const paths = ['/', new URL(recipeUrl(recipe)).pathname, ...(menus.length ? [`/menus/${menus[0].slug}`] : [])];
  for (const path of paths) {
    const { lhr } = await lighthouse(BASE + path, { port: LIGHTHOUSE_PORT, output: 'json', logLevel: 'error', onlyCategories: Object.keys(LIGHTHOUSE_MIN) });
    const scores = Object.fromEntries(Object.values(lhr.categories).map((category) => [category.id, Math.round((category.score ?? 0) * 100)]));
    const low = Object.entries(LIGHTHOUSE_MIN).filter(([id, min]) => scores[id] < min);
    check(
      `${path} : ${Object.entries(scores).map(([id, score]) => `${LIGHTHOUSE_NAMES[id]} ${score}`).join(', ')}`,
      !lhr.runtimeError && low.length === 0,
      lhr.runtimeError?.message ?? (low.length ? `sous le seuil : ${low.map(([id, min]) => `${LIGHTHOUSE_NAMES[id]} < ${min}`).join(', ')}` : `LCP ${lhr.audits['largest-contentful-paint'].displayValue}`),
    );
  }
  await audited.close();
});

await part('Back-office (session simulée)', async () => {
  const page = await newPage(browser, PHONE, errors);
  await fakeAdmin(page);
  await page.goto(BASE + '/admin/nouveautes', { waitUntil: 'load' });
  const folds = page.locator('details.changelog__version');
  await folds.first().waitFor();
  await answerCookies(page);
  check('Nouveautés : une section par version, la dernière ouverte', (await folds.count()) >= 1 && (await folds.nth(0).evaluate((d) => d.open)));
  if ((await folds.count()) > 1) {
    check('Les autres fermées, sans texte rendu', (await folds.nth(1).locator('.changelog__body').count()) === 0);
    await folds.nth(1).locator('summary').click();
    const rendered = await folds.nth(1).locator('.changelog__body').waitFor({ timeout: 2000 }).then(() => true, () => false);
    check('Une section ouverte : son texte rendu', rendered);
  }

    await page.route('**/api/admin/ingredients', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: [{ id: 1, name: 'Beurre', aisle: 'DAIRY_EGGS', recipeCount: 2 }, { id: 2, name: 'Sel', recipeCount: 1 }] }) : route.fallback(),
  );
  await page.goto(BASE + '/admin/ingredients', { waitUntil: 'load' });
  await page.getByRole('combobox', { name: 'Rayon de Beurre' }).waitFor();
  check('Ingrédients : rayon de chaque ingrédient', (await page.getByRole('combobox', { name: 'Rayon de Beurre' }).textContent()).includes('Crèmerie'));
  await page.getByRole('button', { name: '1 sans rayon' }).click();
  check('« 1 sans rayon » : ceux à ranger', (await page.locator('.admin-row__title').allTextContents()).join('|') === 'Sel');
  await page.context().close();
});

await browser.close();
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications OK. Captures : ${SHOTS}`);
if (errors.length) {
  console.log('\nErreurs JavaScript des pages :\n' + [...new Set(errors)].join('\n'));
}
process.exitCode = failed.length || errors.length ? 1 : 0;
