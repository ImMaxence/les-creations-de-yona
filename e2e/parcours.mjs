// Parcours dans Chrome contre le site lancé en local : `npm test` dans e2e/ (voir docs/developpement.md).
// Il choisit lui-même une recette publiée (avec des ingrédients et une étape minutée) : aucune donnée à préparer.
// Captures d'écran dans e2e/resultats/. Code de sortie 1 si une vérification échoue.
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';
import { BASE, DESKTOP, PHONE, answerCookies, api, fakeAdmin, fakeRecaptcha, folder, goClient, launch, newPage, pickRecipe, recipeUrl } from './outils.mjs';

const SHOTS = folder('resultats');
/** Règles d'axe vérifiées : WCAG 2.1 niveaux A et AA, et ses bonnes pratiques. Aucun écart toléré. */
const AXE_RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
/**
 * Scores minimaux de Lighthouse (sur 100), téléphone simulé en 4G lente. La performance varie de
 * quelques points d'une mesure à l'autre : un seuil sous le score habituel (78 à 90 en 1.4), pour
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
const capArticles = await api('/api/cap/entries');
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
  const themed = await api('/api/categories');
  check('Catégories : leur thème, et les thèmes de leurs recettes publiées', themed.every((category) => 'publishedThemes' in category && (category.theme == null || ['SWEET', 'SAVORY'].includes(category.theme))));
  const sweet = await api('/api/recipes?theme=SWEET&size=50');
  check('Filtre par thème : des recettes sucrées seulement', sweet.content.every((card) => card.theme === 'SWEET'), `${sweet.totalElements} recette(s)`);
  const featured = await fetch(`${BASE}/api/featured-recipe`);
  check('Une recette à la une', featured.status === 200, String(featured.status));
  const timed = await api(`/api/recipes?q=${encodeURIComponent('en 30 min')}&size=50`);
  const quick = await api('/api/recipes?maxMinutes=30&size=1');
  check('Recherche : « en 30 min » donne les recettes prêtes en 30 minutes au plus', timed.totalElements === quick.totalElements, `${timed.totalElements} pour ${quick.totalElements}`);
  const themes = await api(`/api/search-suggestions?q=${encodeURIComponent('cake salé')}`);
  check('Suggestions : « cake salé » propose le thème salé', themes.themes.includes('SAVORY'), themes.themes.join(', '));
  const yogurt = ingredients[0].name;
  const named = await api(`/api/search-suggestions?q=${encodeURIComponent(`gâteau au ${yogurt}`)}`);
  check('Suggestions : l’ingrédient nommé parmi les mots', named.ingredients.includes(yogurt), `« gâteau au ${yogurt} » → ${named.ingredients.join(', ')}`);
  const number = await api(`/api/recipes?q=${encodeURIComponent(`${recipe.title} 8`)}`);
  // Le titre peut dire « salé » (« caramel au beurre salé ») : la recette sort quel que soit son thème
  check('Un nombre seul n’est pas cherché (« titre 8 »)', number.content.some((card) => card.slug === recipe.slug));
});

await part('Robots et assistants IA', async () => {
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  check('robots.txt : les robots d’IA nommés, aucun refusé partout', robots.includes('User-agent: GPTBot') && robots.includes('User-agent: ClaudeBot') && !/^Disallow: \/\s*$/m.test(robots));
  const pages = ['/', recipeUrl(recipe).slice(BASE.length), '/robots.txt', '/llms.txt', '/llms-full.txt', '/sitemap.xml', '/index.md'];
  const refused = [];
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot', 'Google-Extended', 'CCBot']) {
    for (const path of pages) {
      const response = await fetch(BASE + path, { headers: { 'User-Agent': `Mozilla/5.0 (compatible; ${bot}/1.0)` } });
      if (response.status !== 200) {
        refused.push(`${bot} ${path} ${response.status}`);
      }
    }
  }
  check('Robots d’IA : 200 sur les pages, robots.txt, llms.txt, llms-full.txt, sitemap et Markdown', refused.length === 0, refused.join(', '));
  const full = await (await fetch(`${BASE}/llms-full.txt`)).text();
  check('llms-full.txt : la recette en entier', full.includes(`# ${recipe.title}\n`) && full.includes('## Préparation'));
  const asked = await fetch(recipeUrl(recipe), { headers: { Accept: 'text/markdown' } });
  const markdown = await asked.text();
  check('Accept: text/markdown : la recette en Markdown, à son adresse', asked.headers.get('content-type')?.startsWith('text/markdown') && markdown.startsWith(`# ${recipe.title}\n`) && asked.headers.get('vary')?.includes('Accept'), asked.headers.get('content-type'));
  const page = await fetch(recipeUrl(recipe), { headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } });
  const html = await page.text();
  check('Navigateur : la page en HTML, qui annonce son Markdown', page.headers.get('content-type')?.startsWith('text/html') && html.includes('type="text/markdown"'));
  for (const path of ['/index.md', '/recettes.md', '/a-propos.md', '/a-propos/index.md', '/menus.md', '/installer.md', '/mentions-legales.md']) {
    const response = await fetch(BASE + path);
    check(`${path} en Markdown`, response.status === 200 && response.headers.get('content-type')?.startsWith('text/markdown'), String(response.status));
  }
  const install = await (await fetch(`${BASE}/installer`)).text();
  check('Installation : les étapes de chaque appareil dans la page, sans JavaScript', ['panel-ios', 'panel-android', 'panel-desktop'].every((id) => install.includes(`id="${id}"`)) && install.includes('Ajouter au Dock') && install.includes('Samsung Internet'));
});

await part('Recherche intelligente (ordinateur)', async () => {
  const page = await newPage(browser, DESKTOP, errors);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await answerCookies(page);
  const box = page.locator('.home-search').getByRole('combobox', { name: 'Rechercher sur le site' });
  await box.fill(`${recipe.title} 8`);
  const servings = page.locator('.home-search').getByRole('group', { name: 'Pour 8 personnes' });
  await servings.waitFor({ timeout: 3000 });
  check('« titre 8 » : « 8 pers. » à droite du champ', await servings.isVisible());
  await servings.getByRole('button', { name: 'Une personne de plus' }).click();
  await page.waitForFunction(() => document.querySelector('.home-search input')?.value.endsWith(' 9'), null, { timeout: 2000 }).catch(() => {});
  check('« + » : 9 dans la recherche', (await box.inputValue()).endsWith(' 9'), await box.inputValue());
  await page.locator('.home-search .suggestion').first().waitFor({ timeout: 3000 });
  await page.screenshot({ path: SHOTS + 'recherche-personnes.png' });
  await page.locator('.home-search .suggestion').first().click();
  await page.waitForURL((url) => url.searchParams.get('portions') === '9');
  check('Une suggestion ouverte pour 9 personnes', new URL(page.url()).searchParams.get('portions') === '9', page.url());
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await box.fill('zzqqxwv');
  const empty = page.locator('.home-search .suggestions__empty');
  await empty.waitFor({ timeout: 3000 }).catch(() => {});
  check('Rien trouvé : « Aucun résultat » avec une icône', (await empty.isVisible()) && (await empty.locator('svg').count()) === 1);
  await page.screenshot({ path: SHOTS + 'recherche-aucun-resultat.png' });
  await page.context().close();
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
  // « Recettes » : un seul menu pour toutes les recettes, les menus, le glossaire et les catégories de chaque thème
  const categories = await api('/api/categories');
  const nav = page.locator('yona-header nav.nav');
  check('Menu « Recettes » dans la barre du haut', (await nav.locator('yona-recipes-menu .trigger').allTextContents()).map((text) => text.trim()).join(' | ') === 'Recettes');
  check('Barre du haut sans « Salé » ni « Sucré »', (await nav.getByRole('button', { name: 'Salé' }).count()) === 0);
  await nav.getByRole('button', { name: 'Recettes' }).click();
  const panel = page.locator('#recipes-menu');
  await panel.waitFor();
  check(
    menus.length ? '« Menus » dans le menu Recettes' : 'Pas de « Menus » sans menu publié',
    (await panel.getByRole('link', { name: 'Menus', exact: true }).count()) === (menus.length ? 1 : 0),
  );
  const themeTitles = (await panel.locator('.panel__title').allTextContents()).map((text) => text.trim());
  check('Menu « Recettes » : « Sucré » avant « Salé »', themeTitles.join(' | ') === 'Sucré | Salé', themeTitles.join(' | '));
  const savory = categories.find((category) => category.theme === 'SAVORY');
  if (savory) {
    const column = panel.locator('.panel__theme').filter({ hasText: 'Salé' });
    check('« Salé » : ses catégories, et toutes les recettes salées', (await column.getByRole('link', { name: savory.name }).count()) === 1 && (await column.getByRole('link', { name: 'Toutes les recettes salées' }).count()) === 1);
    check('« Salé » sans catégorie sucrée', (await column.getByRole('link').allTextContents()).every((name) => !categories.some((category) => category.theme === 'SWEET' && category.name === name.trim())));
  }
  await page.keyboard.press('Escape');
  check('Barre du haut sans « Installer l’application »', (await page.locator('yona-header nav.nav').getByText("Installer l'application").count()) === 0);
  check('Pied de page avec « Installer l’application »', (await page.locator('footer').getByRole('link', { name: "Installer l'application" }).count()) === 1);
  check('Encart des notifications', await page.locator('section.notify button').isVisible());
  check('Zone « À propos » encadrée de ses quatre coins', (await page.locator('yona-about-zone .corner').count()) === 4);
  if (capArticles.length) {
    check('Un article de Mon CAP à lire sous « À propos »', await page.locator('yona-about-zone .reading__card').isVisible());
  }

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
  // Caché au rendu suivant, pas dans l'instant
  await banner.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
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
  // Sur téléphone, les filtres sont repliés derrière un bouton
  check('Filtres repliés sur téléphone', !(await page.locator('#recipe-filters').isVisible()));
  await page.locator('.filters-toggle').click();
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
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  // Sucré ou salé, et le nombre de personnes porté jusqu'aux recettes
  await page.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Salé' }).click();
  await page.waitForURL((url) => url.searchParams.get('theme') === 'sale');
  check('« Salé » : le thème dans l’adresse', true);
  await page.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Tout' }).click();
  await page.waitForURL((url) => !url.searchParams.has('theme'));
  // Le compteur : + depuis rien donne 2, chaque appui une personne de plus, l'adresse suit après une pause
  const more = page.getByRole('button', { name: 'Une personne de plus' });
  for (let tap = 0; tap < 5; tap++) {
    await more.click();
  }
  check('Compteur de personnes : 6 après cinq appuis sur +', (await page.getByLabel('Nombre de personnes').inputValue()) === '6');
  await page.waitForURL((url) => url.searchParams.get('portions') === '6');
  const link = await page.locator('yona-recipe-card a').first().getAttribute('href');
  check('6 personnes : les recettes s’ouvrent pour 6', link?.includes('portions=6') ?? false, link ?? '');
  await page.getByRole('button', { name: 'Revenir aux quantités de chaque recette' }).click();
  await page.waitForURL((url) => !url.searchParams.has('portions'));
  check('× : retour aux quantités de chaque recette', (await page.getByLabel('Nombre de personnes').inputValue()) === '');
  await page.context().close();
});

await part('Menu (téléphone)', async () => {
  const page = await newPage(browser, PHONE, errors);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await answerCookies(page);
  check('Barre du haut sans recherche', !(await page.locator('yona-header .search-toggle').isVisible()));
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await menu.waitFor();
  check('Menu : la recherche du site', await menu.getByRole('combobox').first().isVisible());
  const field = menu.getByRole('combobox').first();
  await field.fill('tarte');
  const [typed, ground] = await field.evaluate((input) => [getComputedStyle(input).color, getComputedStyle(input.closest('.search')).backgroundColor]);
  check('Menu : le texte tapé se lit', typed !== ground, `${typed} sur ${ground}`);
  await field.fill('');
  const current = menu.locator('a.entry[aria-current="page"]');
  check('Menu : la page en cours ressort', (await current.count()) === 1 && (await current.evaluate((row) => getComputedStyle(row).backgroundColor)) !== 'rgba(0, 0, 0, 0)');
  const [currentGround, searchGround] = await Promise.all([
    current.evaluate((row) => getComputedStyle(row).backgroundColor),
    menu.locator('.search').first().evaluate((search) => getComputedStyle(search).backgroundColor),
  ]);
  check('Menu : la page en cours sur un voile, pas du blanc du champ de recherche', currentGround !== searchGround, `${currentGround} / ${searchGround}`);
  const currentBox = await current.boundingBox();
  const listBox = await menu.locator('nav ul').first().boundingBox();
  check('Menu : la page en cours dans les marges du menu', currentBox.x >= listBox.x - 0.5 && currentBox.x + currentBox.width <= listBox.x + listBox.width + 0.5, `${Math.round(currentBox.x)} / ${Math.round(listBox.x)}`);
  // Once the rows have finished rising into place
  await menu.evaluate((dialog) => Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  const gap = await menu.evaluate((dialog) => dialog.querySelector('.menu__sections').getBoundingClientRect().top - [...dialog.querySelectorAll('nav > ul:first-child > li')].at(-1).getBoundingClientRect().bottom);
  check('Menu : un vrai espace entre les pages et les sections', gap >= 40, `${Math.round(gap)} px`);
  check('Menu : pas de cercle autour de la croix', (await menu.locator('.menu__close').evaluate((close) => getComputedStyle(close).boxShadow)) === 'none');
  const heights = await menu.locator('.entry').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  check('Menu : des lignes assez hautes pour le pouce', heights.length > 0 && heights.every((height) => height >= 44), heights.map(Math.round).join(', '));
  check('Menu : une page a sa flèche, une section son plus', (await menu.locator('a.entry .entry__mark').count()) === (await menu.locator('a.entry').count()) && (await menu.locator('summary .entry__mark').count()) === (await menu.locator('summary').count()));
  const mark = menu.locator('summary .entry__mark').last();
  const markBefore = await mark.boundingBox();
  const scrollBefore = await menu.evaluate((dialog) => dialog.scrollTop);
  await menu.locator('summary').last().click();
  await page.waitForTimeout(700);
  const markAfter = await mark.boundingBox();
  check('Menu : le + devient × sur place', Math.abs(markAfter.x + markAfter.width / 2 - (markBefore.x + markBefore.width / 2)) < 1, `${markBefore.x} → ${markAfter.x}`);
  check('Menu : une section s’ouvre sans faire défiler le menu', (await menu.evaluate((dialog) => dialog.scrollTop)) === scrollBefore);
  await menu.locator('summary').first().click();
  await menu.locator('summary').nth(1).click();
  check('Menu : une section ouverte à la fois', (await menu.locator('details[open]').count()) === 1);
  const kinds = await menu.locator('.entry').evaluateAll((rows) => rows.map((row) => row.tagName));
  check('Menu : les pages d’abord, les sections ensuite', kinds.lastIndexOf('A') < kinds.indexOf('SUMMARY'), kinds.join(' '));
  await menu.getByRole('link', { name: 'Recettes', exact: true }).click();
  await page.waitForURL('**/recettes');
  await menu.waitFor({ state: 'hidden' });
  check('Menu : se ferme en arrivant sur la page', true);
  await page.goto(BASE + '/glossaire', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await menu.waitFor();
  check('Menu : la section de la page en cours est dépliée', (await menu.locator('details[open] a[aria-current="page"]').count()) === 1);
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
  const expected = ['Fruits et légumes', ...(shelved.length > 1 ? ['Crèmerie et œufs'] : []), ...(ingredients.length > 2 ? ['Autres'] : [])];
  check('Liste de courses par rayon', headings.join(' | ') === expected.join(' | '), headings.join(' | '));
  // La plus grande quantité : un « 1 rouleau » resterait 1 une fois arrondi
  const measured = ingredients.filter((line) => line.quantity >= 10).sort((a, b) => b.quantity - a.quantity)[0];
  if (measured) {
    const item = page.locator('.item__text', { hasText: measured.name }).first();
    const before = (await item.textContent()).replace(/\s+/g, ' ').trim();
    check('Ingrédient écrit « Nom (quantité) »', new RegExp(`^${measured.name} \\(.+\\)`).test(before), before);
    if (recipe.servings) {
      await page.getByRole('button', { name: `Une personne de plus pour ${recipe.title}` }).click();
      const after = (await item.textContent()).replace(/\s+/g, ' ').trim();
      check('« + » dans la liste : les quantités suivent', after !== before, `${before} → ${after}`);
    }
  }
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

await part('Mon CAP (téléphone)', async () => {
  const page = await newPage(browser, PHONE, errors);
  await page.goto(BASE + '/mon-cap/observations', { waitUntil: 'networkidle' });
  await answerCookies(page);
  check('L’ancienne adresse de « Mes observations » mène à Mon CAP', new URL(page.url()).pathname === '/mon-cap', page.url());
  check('Plus de bouton « Mes observations »', (await page.getByText('Mes observations').count()) === 0);
  if (!capArticles.length) {
    check('Mon CAP sans article : le message d’attente', await page.getByText('Les premiers articles arrivent bientôt').isVisible());
    await page.context().close();
    return;
  }
  const first = capArticles[0];
  const card = page.locator('.timeline .card').first();
  check('La frise : un aperçu par article, le plus récent en premier', (await page.locator('.timeline .card').count()) === capArticles.length && (await card.locator('h2').textContent()).trim() === first.title);
  // Toute la carte s'ouvre, pas seulement le bouton
  await card.click();
  await page.waitForURL(`**/mon-cap/${first.slug}`);
  check('Un appui sur la carte ouvre la page de l’article', (await page.locator('h1').textContent()).trim() === first.title);
  check('« Tous les articles » et « Accueil » sous l’article', (await page.getByRole('link', { name: 'Tous les articles' }).count()) === 1 && (await page.getByRole('navigation', { name: 'Retour' }).getByRole('link', { name: 'Accueil' }).count()) === 1);
  const photo = page.locator('.article .photo').first();
  if (await photo.count()) {
    await photo.click();
    check('Une photo touchée s’ouvre en grand', await page.locator('dialog.viewer[open]').isVisible());
    await page.keyboard.press('Escape');
  }
  const unknown = await fetch(`${BASE}/api/cap/entries/article-introuvable-e2e`);
  check('Un article inconnu répond 404', unknown.status === 404, String(unknown.status));
  await page.context().close();
});

/** Une boutique pour les proches, ses produits simulés : le parcours ne dépend pas des données du site. */
const SHOP = {
  mode: 'FRIENDS',
  open: true,
  pickupInfo: 'Le samedi matin, à la maison',
  products: [
    { id: 101, name: 'Cookies aux pépites', format: 'Boîte de 6', batchSize: 6, price: 12, unitPrice: 2, categories: [{ slug: 'biscuits', name: 'Biscuits' }] },
    { id: 102, name: 'Tarte au citron', format: "À l'unité", price: 24, portionLabel: '8 parts', categories: [{ slug: 'tartes', name: 'Tartes' }] },
    { id: 103, name: 'Sablés de Noël', format: 'Boîte de 12', batchSize: 12, price: 9.5, unitPrice: 0.79, categories: [{ slug: 'biscuits', name: 'Biscuits' }] },
  ],
};

await part('Boutique (téléphone, produits simulés)', async () => {
  const page = await newPage(browser, PHONE, errors);
  await fakeRecaptcha(page);
  await page.route('**/api/shop', (route) => route.fulfill({ json: SHOP }));
  let sent = null;
  await page.route('**/api/shop/orders', (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { trackingToken: 'suivi-e2e' } });
  });
  await page.route('**/api/shop/orders/suivi-e2e', (route) =>
    route.fulfill({
      json: { number: 42, status: 'NEW', amount: 24, createdAt: '2026-11-10T09:00:00Z', updatedAt: '2026-11-10T09:00:00Z', lines: [{ title: 'Cookies aux pépites', quantity: 2, unitPrice: 12 }] },
    }),
  );
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await answerCookies(page);
  await goClient(page, '/boutique');
  const products = page.locator('.product');
  await products.first().waitFor();
  check('Boutique : les produits de la boutique', (await products.count()) === 3);
  check('Boutique : le bandeau « réservée à mes proches »', await page.locator('.shop__banner').isVisible());
  check('Boutique : plus de texte de présentation', (await page.locator('.shop__lead').count()) === 0);
  check('Boutique : le retrait', (await page.locator('.shop__pickup').innerText()).includes('samedi'));
  check('Boutique : le prix d’une pièce d’une boîte', (await products.first().innerText()).includes('soit 2,00'));

  // Téléphone : la catégorie se choisit dans une liste
  await page.locator('.filters__dropdown').selectOption('biscuits');
  check('Catégorie « Biscuits » : ses produits seulement', (await products.count()) === 2);
  await page.getByRole('searchbox', { name: 'Rechercher un produit' }).fill('CITRON');
  const empty = page.locator('.shop__empty');
  check('Recherche dans une catégorie sans résultat : le dire', (await empty.innerText()).includes('« Biscuits »') && (await empty.innerText()).includes('« CITRON »'));
  await page.locator('.filters__dropdown').selectOption('');
  check('Recherche sans tenir compte des majuscules', (await products.count()) === 1 && (await products.first().innerText()).includes('Tarte au citron'));
  await page.getByRole('searchbox', { name: 'Rechercher un produit' }).fill('sables noel');
  check('Recherche sans tenir compte des accents', (await products.count()) === 1 && (await products.first().innerText()).includes('Sablés de Noël'));
  await page.getByRole('searchbox', { name: 'Rechercher un produit' }).fill('');

  const cookies = page.getByRole('group', { name: 'Quantité de Cookies aux pépites' });
  await cookies.getByRole('button', { name: 'Un de plus' }).click();
  await cookies.getByRole('button', { name: 'Un de plus' }).click();
  const bar = page.locator('.request-bar');
  check('Barre « Ma demande » : nombre et total TTC', (await bar.innerText()).includes('2 produits') && (await bar.innerText()).includes('24,00'));
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('yona-shop-request') ?? 'null'));
  check('La demande est gardée dans le navigateur', kept?.quantities?.['101'] === 2, JSON.stringify(kept?.quantities));
  await goClient(page, '/');
  await goClient(page, '/boutique');
  await cookies.waitFor();
  check('Revenu sur la boutique : la demande est toujours là', (await cookies.locator('.stepper__count').innerText()).trim() === '2');

  await bar.click();
  const panel = page.locator('dialog.panel[open]');
  await panel.waitFor();
  check('Ma demande : les produits choisis et l’estimation', (await panel.locator('.order__line').count()) === 1 && (await panel.locator('.order__total').innerText()).includes('24,00'));
  const send = panel.getByRole('button', { name: 'Envoyer ma demande' });
  check('Sans nom ni contact : envoi impossible', await send.isDisabled());
  await panel.getByLabel('Votre nom').fill('Léa');
  await panel.getByLabel('E-mail').fill('lea@example.fr');
  await panel.getByLabel(/Votre message/).fill('Sans noix, merci');
  await page.waitForFunction(() => !document.querySelector('dialog.panel[open] button[type="submit"]')?.disabled, null, { timeout: 5000 });
  await page.screenshot({ path: SHOTS + 'boutique-demande.png' });
  await send.click();
  await page.waitForURL('**/boutique/commande/suivi-e2e');
  check(
    'Demande envoyée : les produits, le contact, le message et le jeton reCAPTCHA',
    sent?.customerName === 'Léa' && sent?.customerEmail === 'lea@example.fr' && sent?.message === 'Sans noix, merci' &&
      JSON.stringify(sent?.lines) === JSON.stringify([{ productId: 101, quantity: 2 }]) && sent?.captchaToken === 'jeton-e2e',
    JSON.stringify(sent),
  );
  await page.locator('h1').waitFor();
  check('Puis la page de suivi de la commande', (await page.locator('h1').innerText()).includes('42'));
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('yona-shop-request') ?? 'null'));
  check('Une nouvelle demande repart vide, le contact gardé', Object.keys(after?.quantities ?? {}).length === 0 && after?.name === 'Léa' && after?.message === '');

  // Une quantité trafiquée dans le navigateur ne fausse pas le total
  await page.evaluate(() => localStorage.setItem('yona-shop-request', JSON.stringify({ quantities: { 101: 'beaucoup' }, name: '', email: '', phone: '', wantedOn: '', message: '' })));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await goClient(page, '/boutique');
  await cookies.waitFor();
  check('Une demande gardée illisible est ignorée', !(await bar.innerText()).includes('NaN') && (await cookies.locator('.stepper__count').innerText()).trim() === '0');

  const { violations } = await new AxeBuilder({ page }).withTags(AXE_RULES).analyze();
  check('Boutique : aucun problème d’accessibilité', violations.length === 0, violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' | ')})`).join(' ; '));
  await page.context().close();
});

await part('Boutique (ordinateur, produits simulés)', async () => {
  const page = await newPage(browser, DESKTOP, errors);
  await page.route('**/api/shop', (route) => route.fulfill({ json: SHOP }));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await answerCookies(page);
  await goClient(page, '/boutique');
  await page.locator('.product').first().waitFor();
  const filters = page.locator('.filters__list');
  check('Ordinateur : les catégories en colonne, avec leur nombre', (await filters.innerText()).includes('Biscuits (2)') && (await filters.innerText()).includes('Tout (3)'));
  await filters.getByRole('button', { name: /Tartes/ }).click();
  check('Ordinateur : une catégorie choisie est marquée', (await filters.getByRole('button', { name: /Tartes/ }).getAttribute('aria-pressed')) === 'true' && (await page.locator('.product').count()) === 1);
  await page.getByRole('group', { name: 'Quantité de Tarte au citron' }).getByRole('button', { name: 'Un de plus' }).click();
  const button = page.locator('.request-button');
  check('Ordinateur : « Ma demande » en haut à droite, avec le total', (await button.innerText()).includes('1 produit') && (await button.innerText()).includes('24,00'));
  await button.click();
  await page.locator('dialog.panel[open]').waitFor();
  check('Ordinateur : la demande s’ouvre sur le côté', (await page.locator('dialog.panel[open] .order').boundingBox()).x > DESKTOP.width / 3);
  await page.keyboard.press('Escape');
  await page.locator('dialog.panel[open]').waitFor({ state: 'detached' });
  check('Échap ferme le panneau', true);
  const basket = await page.locator('.request-button svg').first().innerHTML();
  const list = await page.locator('yona-header a[aria-label^="Ma liste de courses"] svg').first().innerHTML();
  check('L’icône de la liste de courses n’est plus le panier de la boutique', basket !== list);
  await page.context().close();
});

await part('Mon CAP (articles simulés)', async () => {
  const card = { id: 7, slug: 'examen-blanc-e2e', title: 'Examen blanc', subtitle: 'Une pâte feuilletée récalcitrante', happenedOn: '2026-11-01', style: 'NOTEBOOK', excerpt: 'Le matin, tout allait bien' };
  const article = {
    ...card,
    updatedAt: '2026-11-02T08:00:00Z',
    blocks: [
      { type: 'TEXT', text: 'Le matin, **tout** allait bien. Voir les [recettes](/recettes)' },
      { type: 'TIP', text: 'Toujours peser le beurre' },
    ],
  };
  const page = await newPage(browser, PHONE, errors);
  await page.route('**/api/cap/entries', (route) => route.fulfill({ json: [card] }));
  await page.route(`**/api/cap/entries/${card.slug}`, (route) => route.fulfill({ json: article }));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await answerCookies(page);
  await goClient(page, '/mon-cap');
  await page.locator('.timeline .card').first().waitFor();
  check('La frise : l’aperçu de l’article, son sous-titre et ses premières lignes', (await page.locator('.timeline .card').innerText()).includes('récalcitrante') && (await page.locator('.timeline .card').innerText()).includes('Le matin'));
  await page.locator('.timeline .card').first().click();
  await page.waitForURL(`**/mon-cap/${card.slug}`);
  await page.locator('h1').waitFor();
  check('L’article : son titre', (await page.locator('h1').innerText()).trim() === 'Examen blanc');
  check('Style « Carnet » : le 1er du mois écrit « 1er »', (await page.locator('yona-cap-article-view').innerText()).includes('1er'));
  const articleAxe = await new AxeBuilder({ page }).withTags(AXE_RULES).analyze();
  check('Article : aucun problème d’accessibilité', articleAxe.violations.length === 0, articleAxe.violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' | ')})`).join(' ; '));
  check('Le texte mis en forme (gras) et l’astuce encadrée', (await page.locator('yona-cap-article-view strong').count()) >= 1 && (await page.getByText('Toujours peser le beurre').isVisible()));
  await page.locator('yona-cap-article-view a[href="/recettes"]').click();
  await page.waitForURL('**/recettes');
  check('Un lien du texte vers le site s’ouvre sans recharger', await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.name.endsWith('/')));
  await page.context().close();
});

await part('Infobulles de la barre du haut (ordinateur)', async () => {
  const page = await newPage(browser, DESKTOP, errors);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await answerCookies(page);
  const bubble = page.locator('.tooltip.is-open');
  for (const [selector, name] of [
    ['yona-header .search-toggle', 'Rechercher'],
    ['yona-header a[aria-label^="Mes favoris"]', 'Mes favoris'],
    ['yona-header a[aria-label^="Ma liste de courses"]', 'Ma liste de courses'],
    ['yona-header .scheme-switch .trigger', 'Affichage'],
  ]) {
    const icon = page.locator(selector).first();
    await icon.hover();
    await bubble.waitFor({ timeout: 3000 });
    const [iconBox, bubbleBox] = await Promise.all([icon.boundingBox(), bubble.boundingBox()]);
    check(`Infobulle : « ${name} » sous l’icône`, (await bubble.innerText()).startsWith(name) && bubbleBox.y >= iconBox.y + iconBox.height, await bubble.innerText());
    await page.mouse.move(0, 400);
    await bubble.waitFor({ state: 'hidden' });
  }
  // A fresh page: the cookie banner, answered, no longer holds the place of the focus
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  check('Clavier : le premier Tab mène à « Aller au contenu »', (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Aller au contenu');
  await page.locator('yona-header .scheme-switch .trigger').click();
  await page.locator('#color-scheme-menu').waitFor();
  const schemeMenu = page.locator('#color-scheme-menu');
  check('Menu Clair / Sombre : « Accessibilité » vers la page', (await schemeMenu.getByRole('link', { name: 'Accessibilité' }).getAttribute('href')) === '/accessibilite');
  check('Menu Clair / Sombre : « Paramètres par défaut » sans effet tant que rien n’a changé', await schemeMenu.getByRole('button', { name: 'Paramètres par défaut' }).isDisabled());
  await schemeMenu.getByRole('button', { name: 'Sombre' }).click();
  await page.locator('yona-header .scheme-switch .trigger').click();
  await schemeMenu.getByRole('button', { name: 'Paramètres par défaut' }).click();
  check('« Paramètres par défaut » : de nouveau selon l’appareil', (await page.evaluate(() => document.documentElement.getAttribute('data-color-scheme') ?? localStorage.getItem('yona-color-scheme'))) === null);
  await page.context().close();
});

await part('Accessibilité : réglages d’affichage et déclaration (téléphone)', async () => {
  const page = await newPage(browser, PHONE, errors);
  await page.goto(BASE + '/accessibilite', { waitUntil: 'networkidle' });
  await answerCookies(page);
  check('Page Accessibilité', (await page.locator('h1').innerText()).trim() === 'Accessibilité');
  const root = () => page.evaluate(() => Object.fromEntries([...document.documentElement.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-color-scheme').map((a) => [a.name, a.value])));
  await page.locator('.size', { hasText: 'Très grand' }).click();
  for (const label of ['Contraste renforcé', 'Réduire les animations', 'Police simple', 'Souligner les liens', 'Espacer le texte']) {
    await page.getByRole('switch', { name: new RegExp(label) }).check();
  }
  const applied = await root();
  check(
    'Chaque réglage s’applique tout de suite',
    applied['data-text-size'] === 'larger' && applied['data-contrast'] === 'more' && applied['data-motion'] === 'reduce' && applied['data-font'] === 'readable' && applied['data-links'] === 'underline' && applied['data-spacing'] === 'wide',
    JSON.stringify(applied),
  );
  check('Texte très grand : 125 %', (await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)) === '20px');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  check('Gardés sur les autres pages, dès l’affichage', JSON.stringify(await root()) === JSON.stringify(applied));
  check('Texte très grand et espacé : rien ne déborde sur un téléphone', (await page.evaluate(() => document.documentElement.scrollWidth)) <= PHONE.width);
  check('Animations réduites : aucune transition', (await page.evaluate(() => getComputedStyle(document.querySelector('a')).transitionDuration)).split(',').every((value) => parseFloat(value) < 0.001));
  await page.screenshot({ path: SHOTS + 'accessibilite-reglages.png' });
  await page.goto(BASE + '/accessibilite', { waitUntil: 'networkidle' });
  check('Les réglages relus sur la page', await page.getByRole('switch', { name: /Contraste renforcé/ }).isChecked());
  await page.getByRole('button', { name: 'Paramètres par défaut' }).click();
  check('« Paramètres par défaut » : plus aucun réglage, rien de gardé', JSON.stringify(await root()) === '{}' && (await page.evaluate(() => localStorage.getItem('yona-accessibility'))) === null);
  await page.getByRole('link', { name: 'Déclaration d’accessibilité' }).or(page.getByRole('link', { name: "Déclaration d'accessibilité" })).first().click();
  await page.waitForURL('**/declaration-d-accessibilite');
  const statement = await page.locator('main').innerText();
  check('Déclaration : état de conformité, contact et voies de recours', statement.includes('État de conformité') && statement.includes('Défenseur des droits') && statement.includes('Donner mon avis'));
  check('Pied de page : Accessibilité et la déclaration', (await page.locator('yona-footer a[href="/accessibilite"]').count()) === 1 && (await page.locator('yona-footer a[href="/declaration-d-accessibilite"]').count()) === 1);
  await page.context().close();
});

await part('Affichage sur un écran de 320 px (zoom à 400 %)', async () => {
  const page = await newPage(browser, { width: 320, height: 640 }, errors);
  for (const path of ['/', new URL(recipeUrl(recipe)).pathname, '/accessibilite', '/glossaire']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await answerCookies(page);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`${path} : rien ne déborde à 320 px`, width <= 320, `${width} px`);
  }
  await page.context().close();
});

await part('Accessibilité (axe, téléphone)', async () => {
  const paths = ['/', '/recettes', new URL(recipeUrl(recipe)).pathname, '/glossaire', '/installer', '/liste-de-courses', '/favoris', '/donner-mon-avis', '/mon-cap', '/accessibilite', '/declaration-d-accessibilite'];
  if (menus.length) {
    paths.push('/menus', `/menus/${menus[0].slug}`);
  }
  if (capArticles.length) {
    paths.push(`/mon-cap/${capArticles[0].slug}`);
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

await part('Connexion et cadre du back-office', async () => {
  // Sans session : l'API répond 401, ce qui n'est pas une erreur de la page
  const visitor = await newPage(browser, PHONE, []);
  await visitor.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await answerCookies(visitor);
  check('Sans session : la page de connexion', new URL(visitor.url()).pathname === '/admin/connexion', visitor.url());
  check('Connexion : ni barre ni pied du site', (await visitor.locator('yona-header, yona-footer').count()) === 0);
  const google = visitor.getByRole('button', { name: 'Se connecter avec Google' });
  check('Connexion : bouton Google assez haut', (await google.isVisible()) && (await google.boundingBox()).height >= 44);
  await visitor.context().close();

  const phone = await newPage(browser, PHONE, errors);
  await fakeAdmin(phone);
  await phone.goto(BASE + '/admin/nouveautes', { waitUntil: 'load' });
  const menu = phone.getByRole('button', { name: /^Menu/ });
  await menu.waitFor();
  await answerCookies(phone);
  check('Téléphone : ni barre ni pied du site', (await phone.locator('yona-header, yona-footer').count()) === 0);
  check('Téléphone : la première lettre du nom sans photo', (await phone.locator('.admin__me').innerText()).trim() === 'Y');
  await menu.click();
  const drawer = phone.getByRole('dialog', { name: 'Menu du back-office' });
  await drawer.waitFor();
  check('Téléphone : le groupe de la page est déplié', (await drawer.locator('.group__toggle[aria-expanded="true"]').innerText()).includes('Site'));
  await drawer.locator('.group__toggle', { hasText: 'Boutique' }).click();
  check('Téléphone : un groupe déplié à la fois', (await drawer.locator('.group__toggle[aria-expanded="true"]').count()) === 1);
  const heights = await drawer.locator('.group__toggle, a.link:visible').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  check('Téléphone : des lignes assez hautes pour le pouce', heights.every((height) => height >= 44), heights.map(Math.round).join(', '));
  check('Téléphone : « Se déconnecter »', await drawer.getByRole('button', { name: 'Se déconnecter' }).isVisible());
  await drawer.getByRole('button', { name: 'Fermer le menu' }).click();
  await drawer.waitFor({ state: 'hidden' });
  check('Téléphone : le panneau se ferme', true);
  await phone.context().close();

  const desktop = await newPage(browser, DESKTOP, errors);
  await fakeAdmin(desktop);
  await desktop.goto(BASE + '/admin/nouveautes', { waitUntil: 'load' });
  const side = desktop.locator('.admin__side');
  await side.waitFor();
  await answerCookies(desktop);
  check('Ordinateur : ni barre ni pied du site', (await desktop.locator('yona-header, yona-footer').count()) === 0);
  check('Ordinateur : toutes les sections à gauche', (await side.locator('a.link').count()) === 20 && (await side.boundingBox()).x === 0);
  check('Ordinateur : section courante marquée', (await side.locator('a.link.is-active').innerText()).includes('Nouveautés'));
  await side.locator('.account__email').hover();
  await desktop.locator('.tooltip.is-open').waitFor();
  check('Ordinateur : l’e-mail complet au survol', (await desktop.locator('.tooltip.is-open').innerText()) === 'yona@example.fr');
  const blog = side.locator('.group__toggle', { hasText: 'Blog' });
  await blog.click();
  await desktop.waitForTimeout(400);
  check('Ordinateur : une section se ferme', (await blog.getAttribute('aria-expanded')) === 'false' && !(await side.locator('a.link', { hasText: 'Tags' }).isVisible()));
  await desktop.reload({ waitUntil: 'load' });
  await blog.waitFor();
  check('Ordinateur : fermée, elle le reste', (await blog.getAttribute('aria-expanded')) === 'false');
  await blog.click();
  check('Ordinateur : elle se rouvre', (await blog.getAttribute('aria-expanded')) === 'true');
  await desktop.context().close();
});

await part('Back-office (session simulée)', async () => {

  const page = await newPage(browser, PHONE, errors);
  await fakeAdmin(page);
  await page.goto(BASE + '/admin/nouveautes', { waitUntil: 'load' });
  const folds = page.locator('details.changelog__version');
  await folds.first().waitFor();
  await answerCookies(page);
  check('Nouveautés : une section par version, la dernière ouverte', (await folds.count()) >= 1 && (await folds.nth(0).evaluate((d) => d.open)));
  check(
    'Nouveautés : boutons GitHub et Coolify',
    (await page.getByRole('link', { name: 'GitHub' }).getAttribute('href')) === 'https://github.com/ImMaxence/les-creations-de-yona' &&
      (await page.getByRole('link', { name: 'Coolify' }).count()) === 1,
  );
  check('Nouveautés : Version 2, puis Version 1', (await page.locator('.changelog__major').allTextContents()).join(' | ') === 'Version 2 | Version 1');
  const pills = await folds.nth(0).locator('.changes tbody .pill').allTextContents();
  check('Nouveautés : un tableau, une pastille par changement', pills.length > 0 && pills.every((pill) => ['Ajouté', 'Modifié', 'Corrigé', 'Retiré', 'Technique', 'Autre'].includes(pill.trim())), pills.slice(0, 5).join(', '));
  const relative = await page.locator('.changes a[href]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')).filter((href) => !/^(https?:|mailto:|#)/.test(href ?? '')),
  );
  check('Nouveautés : aucun lien relatif vers une page du site', relative.length === 0, relative.join(', '));
  if ((await folds.count()) > 1) {
    check('Les autres fermées, sans texte rendu', (await folds.nth(1).locator('.changes').count()) === 0);
    await folds.nth(1).locator('summary').click();
    const rendered = await folds.nth(1).locator('.changes').waitFor({ timeout: 2000 }).then(() => true, () => false);
    check('Une section ouverte : son texte rendu', rendered);
  }

  // Une publication programmée en échec : statut rouge, raison, « Publier maintenant »
  const failed = {
    id: 999, title: 'Tarte en échec', slug: 'tarte-en-echec', status: 'FAILED', theme: 'SWEET', featured: false, categories: [],
    createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', viewCount: 0, scheduledAt: '2026-10-28T08:00:00Z',
    publicationFailure: 'Le site était arrêté à l’heure prévue : plus de 30 minutes de retard, la recette n’a pas été publiée',
  };
  const scheduled = { ...failed, id: 998, title: 'Quiche programmée', status: 'DRAFT', scheduledAt: '2026-11-07T09:00:00Z', publicationFailure: null };
  await page.route('**/api/admin/recipes?**', (route) =>
    route.fulfill({ json: { content: [failed, scheduled], page: 0, size: 20, totalElements: 2, totalPages: 1 } }),
  );
  // Sans session, toute autre route du back-office répondrait 401 et renverrait vers Google
  await page.route('**/api/admin/tags', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/ingredients**', (route) => route.fulfill({ json: [] }));
  await page.goto(BASE + '/admin/recettes', { waitUntil: 'load' });
  await page.locator('.badge--failed').waitFor({ timeout: 5000 });
  check('Recettes : statut « Échec » en rouge', (await page.locator('.badge--failed').textContent()).includes('Échec'));
  check('Recettes : brouillon daté « Programmée » en bleu', (await page.locator('.badge--scheduled').textContent()).includes('Programmée'));
  check('Recettes : raison de l’échec et « Publier maintenant »', (await page.locator('.admin-row__failure').isVisible()) && (await page.getByRole('button', { name: 'Publier maintenant' }).isVisible()));
  await page.screenshot({ path: SHOTS + 'admin-echec.png' });

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

await part('Factures (back-office, données simulées)', async () => {
  const order = {
    id: 42, status: 'PICKED_UP', amount: 20, customerName: 'Léa Martin', customerEmail: 'lea@example.fr', trackingToken: 'suivi-e2e',
    createdAt: '2026-11-08T09:00:00Z', updatedAt: '2026-11-09T09:00:00Z', admins: ['yona@example.fr'], handledBy: 'yona@example.fr',
    lines: [{ productId: 101, title: 'Cookies aux pépites', quantity: 2, unitPrice: 12 }],
  };
  const invoice = {
    id: 7, number: '2026-0001', orderId: 42, issuedOn: '2026-11-10', customerName: 'Léa Martin', customerEmail: 'lea@example.fr',
    sellerName: 'Yona, Les créations de Yona', sellerAddress: '1 rue des Lilas\n69000 Lyon', sellerSiret: '12345678900012',
    vatMention: 'TVA non applicable, art. 293 B du CGI', amount: 20, linesTotal: 24, adminEmail: 'yona@example.fr',
    lines: [{ label: 'Cookies aux pépites', detail: 'Boîte de 6', quantity: 2, unitPrice: 12, total: 24 }],
  };
  const summary = { id: 7, number: '2026-0001', orderId: 42, issuedOn: '2026-11-10', customerName: 'Léa Martin', amount: 20 };
  let issued = false;
  const page = await newPage(browser, DESKTOP, errors);
  await fakeAdmin(page);
  await page.route('**/api/admin/shop/orders/42', (route) => route.fulfill({ json: issued ? { ...order, invoice: summary } : order }));
  await page.route('**/api/admin/shop/orders/42/invoice', (route) => {
    issued = true;
    return route.fulfill({ json: invoice });
  });
  await page.route('**/api/admin/invoices/7', (route) => route.fulfill({ json: invoice }));
  await page.goto(BASE + '/admin/boutique/commandes/42', { waitUntil: 'load' });
  await answerCookies(page);
  const generate = page.getByRole('button', { name: 'Générer la facture' });
  await generate.waitFor();
  check('Commande récupérée : « Générer la facture »', await generate.isVisible());
  await generate.click();
  const confirm = page.getByRole('alertdialog', { name: 'Générer la facture ?' });
  await confirm.waitFor();
  check('Avant de générer : ce que cela fige', (await confirm.innerText()).includes('ne se supprime plus'));
  await confirm.getByRole('button', { name: 'Générer' }).click();
  await page.waitForURL('**/admin/boutique/factures/7');
  const sheet = page.locator('.sheet');
  await sheet.waitFor();
  const text = await sheet.innerText();
  check('Facture : numéro, vendeur, SIRET espacé, client', text.includes('2026-0001') && text.includes('Les créations de Yona') && text.includes('123 456 789 00012') && text.includes('Léa Martin'));
  check('Facture : la ligne, la remise et le total à payer', text.includes('Cookies aux pépites') && text.includes('Remise') && /Total à payer\s*20,00/.test(text));
  check('Facture : la mention de TVA', text.includes('293 B'));
  check('Facture : le titre de la page, nom du PDF', (await page.title()) === 'Facture 2026-0001', await page.title());
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_RULES).analyze();
  check('Facture : aucun problème d’accessibilité', violations.length === 0, violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' | ')})`).join(' ; '));
  await page.emulateMedia({ media: 'print' });
  check('Impression : la facture seule, sans menu ni boutons', !(await page.locator('.admin__side').isVisible()) && !(await page.getByRole('button', { name: /Imprimer/ }).isVisible()) && (await sheet.isVisible()));
  await page.screenshot({ path: SHOTS + 'facture-impression.png' });
  await page.emulateMedia({ media: 'screen' });

  await page.goto(BASE + '/admin/boutique/commandes/42', { waitUntil: 'load' });
  await page.getByRole('link', { name: 'Voir la facture' }).waitFor();
  check('Commande facturée : montant figé', await page.locator('#order-amount').isDisabled());
  check('Commande facturée : plus de « Supprimer »', (await page.getByRole('button', { name: 'Supprimer' }).count()) === 0);
  await page.context().close();
});

await part('Comptabilité : factures et informations de facturation (données simulées)', async () => {
  const totals = { income: 20, expense: 0, balance: 20 };
  const overview = {
    year: 2026, period: 'YEAR', number: 1, from: '2026-01-01', to: '2026-12-31', years: [2026], admins: ['yona@example.fr'],
    totals, previousTotals: { income: 0, expense: 0, balance: 0 }, figures: { orders: 1, offeredOrders: 0, averageBasket: 20, marginRate: 1 },
    months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, totals: index === 10 ? totals : { income: 0, expense: 0, balance: 0 } })),
    expensesByCategory: [], bestSellers: [], entries: [], byAdmin: [],
  };
  let settingsSaved = null;
  const page = await newPage(browser, DESKTOP, errors);
  await fakeAdmin(page);
  await page.route('**/api/admin/accounting?**', (route) => route.fulfill({ json: overview }));
  await page.route('**/api/admin/accounting/costs', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/invoices?**', (route) =>
    route.fulfill({ json: [{ id: 7, number: '2026-0001', orderId: 42, issuedOn: '2026-11-10', customerName: 'Léa Martin', amount: 20 }] }),
  );
  await page.route('**/api/admin/invoices/settings', (route) => {
    if (route.request().method() === 'PUT') {
      settingsSaved = route.request().postDataJSON();
      return route.fulfill({ json: settingsSaved });
    }
    return route.fulfill({ json: { vatMention: 'TVA non applicable, art. 293 B du CGI' } });
  });
  await page.goto(BASE + '/admin/boutique/comptabilite', { waitUntil: 'load' });
  await answerCookies(page);
  const panel = page.locator('yona-invoices-panel');
  await panel.getByText('N° 2026-0001').waitFor();
  check('Comptabilité : les factures de l’année', (await panel.innerText()).includes('Léa Martin') && (await panel.innerText()).includes('1 facture'));
  await panel.getByRole('button', { name: 'Informations de facturation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Informations de facturation' });
  await dialog.waitFor();
  await page.waitForFunction(() => document.querySelector('#seller-vat')?.value.includes('293 B'), null, { timeout: 3000 });
  check('Informations de facturation : la mention de TVA par défaut', true);
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  check('Sans nom ni adresse : refusé avant l’envoi', settingsSaved === null);
  await dialog.getByLabel('Nom', { exact: true }).fill('Yona, Les créations de Yona');
  await dialog.getByLabel('Adresse').fill('1 rue des Lilas\n69000 Lyon');
  await dialog.getByLabel('SIRET (facultatif)').fill('123 456 789 00012');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await dialog.waitFor({ state: 'hidden' });
  check('Informations de facturation enregistrées', settingsSaved?.sellerName === 'Yona, Les créations de Yona' && settingsSaved?.sellerSiret === '123 456 789 00012', JSON.stringify(settingsSaved));
  await page.context().close();
});

await part('Mon CAP : brouillon gardé dans le navigateur', async () => {
  const page = await newPage(browser, DESKTOP, errors);
  await fakeAdmin(page);
  // Le choix d'une recette à lier lit les recettes du back-office
  await page.route('**/api/admin/recipes?**', (route) => route.fulfill({ json: { content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 } }));
  await page.goto(BASE + '/admin/mon-cap/nouveau?modele=vide', { waitUntil: 'load' });
  await answerCookies(page);
  const title = page.locator('#article-title');
  await title.waitFor();
  await title.fill('Mon article gardé');
  await page.waitForFunction(() => localStorage.getItem('yona-article-draft-nouveau')?.includes('Mon article gardé'), null, { timeout: 3000 });
  check('Saisi : gardé dans le navigateur peu après', true);
  await page.reload({ waitUntil: 'load' });
  const banner = page.locator('yona-recovered-draft');
  await banner.waitFor();
  check('Page rouverte : « Des modifications non enregistrées ont été retrouvées »', (await banner.innerText()).includes('non enregistrées'));
  await banner.getByRole('button', { name: 'Reprendre' }).click();
  check('« Reprendre » : le titre revient', (await title.inputValue()) === 'Mon article gardé');
  await page.reload({ waitUntil: 'load' });
  await banner.waitFor();
  await banner.getByRole('button', { name: 'Ignorer' }).click();
  check('« Ignorer » : l’article reste vide et le brouillon est oublié', (await title.inputValue()) === '' && (await page.evaluate(() => localStorage.getItem('yona-article-draft-nouveau'))) === null);
  // Caché (téléphone verrouillé, autre application) : gardé tout de suite
  await title.fill('Écrit juste avant de verrouiller');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check('Onglet caché : gardé sans attendre', (await page.evaluate(() => localStorage.getItem('yona-article-draft-nouveau') ?? '')).includes('verrouiller'));
  await page.context().close();
});

await part('Connexion : motif vichy et bord festonné', async () => {
  const page = await newPage(browser, DESKTOP, []);
  await page.goto(BASE + '/admin/connexion', { waitUntil: 'networkidle' });
  const pattern = await page.locator('.brand').evaluate((brand) => ({
    cloth: getComputedStyle(brand, '::before').backgroundImage,
    edge: getComputedStyle(brand, '::after').backgroundImage,
  }));
  check('Connexion : le vichy derrière le nom', (pattern.cloth.match(/linear-gradient/g) ?? []).length === 2, pattern.cloth.slice(0, 60));
  check('Connexion : le bord festonné', pattern.edge.includes('radial-gradient'));
  await page.context().close();
});

await browser.close();
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications OK. Captures : ${SHOTS}`);
if (errors.length) {
  console.log('\nErreurs JavaScript des pages :\n' + [...new Set(errors)].join('\n'));
}
process.exitCode = failed.length || errors.length ? 1 : 0;
