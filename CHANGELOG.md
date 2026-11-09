# Changelog

Front and backend share one version number (semantic versioning: major breaks existing data, minor adds features, patch fixes). How to release: [docs/developpement.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/developpement.md#monter-la-version). Versions before 1.1.0 are summed up in the [roadmap](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/roadmap.md).

## 2.0.1 - 2026-11-09

Front and backend 2.0.1. No database migration.

### Changed

- **Infinite scroll**: every paged list loads as you go down, in place of page numbers and "per page". Cards far from the screen are not rendered, and Back returns to the same spot.
- **Navigation**: one "Recettes" panel in the bar; the phone menu has sections, the search, and folding "Salé" and "Sucré".
- **Phone header**: the site's name on one line, beside the menu button only.
- **Recipes on phones**: all filters fold behind one "Filtres" button showing how many are active.
- **Notifications button**: shorter on the home page; once on, the status and "Désactiver" are separate.
- **Back-office menu**: three entries (Blog, Boutique, Site), each opening a panel, in place of three rows of links.
- **Observations, shop products**: the recipe is found with a search field instead of a drop-down list.
- **Orders**: the alert for new orders says plainly what it does.

### Fixed

- **Accounts**: a long email no longer overflows the form, nor gets cut off in the admin filter.

## 2.0.0 - 2026-11-09

Front and backend 2.0.0. Database migration: V20.

### Added

- **Shop** (`/boutique`, closed until opened in the back-office): recipes chosen by the admin, with a price, a free text and Google's captcha. No payment on the site.
- **Orders**: statuses from "Nouvelle" to "Récupérée" or "Annulée", a secret tracking link for the customer, no account needed.
- **Order alerts**: a badge in the back-office, and a push notification on the admins' devices that ask for it.
- **Accounts**: orders picked up come in by themselves, expenses are typed by hand, each line counted for an admin; totals by month and by admin, CSV export.
- **Mon CAP** (`/mon-cap`): a dated timeline of the diploma, with text and photos.
- **Mes observations** (`/mon-cap/observations`): notes about a recipe or about none, also shown on the recipe's page.
- **Recipes used as parts**: a recipe can be a part of another one, whole or multiplied ("Pâte sablée × 0.5"), up to 3 levels. Total, cooking mode, shopping list, search and structured data all follow.
- **Ingredient equivalents**: the weight of one piece, to show "400 g (≈ 8 œufs)", following the servings.

### Changed

- **Back-office**: sections in three groups, Blog, Boutique and Site.
- **Deleting a recipe**: refused while another recipe uses it, or while it is in the shop.
- **Legal pages**: the shop and its data; orders are in the backups, and are erased 12 months after being finished.

### Technical

- Backup and restore: new tables included and merged, orders too (found by their tracking link, each keeping its number when free); order numbers continue after the accounts on a new server.
- `RecaptchaBox` shared by the feedback and shop forms.
- Backend: `POST /api/shop/orders` limited to one order a minute and 5 an hour per address, 30 an hour for the whole site.

## 1.22.0 - 2026-11-08

Front and backend 1.22.0. No database migration.

### Added

- **Local AI, download**: amount downloaded, amount left, speed and time left.
- **Local AI, download**: a link to report a failed download on GitHub, already filled in.
- **Local AI, while it runs**: the list of what is being done, the time elapsed, the time left for an image, and a warning that the computer may slow down.
- **Phones and tablets**: local AI greyed out, with the reason.
- **ReadMe**: the AI of the back-office, with screenshots.
- **Recipe editor**: a "Publier" button in the bar always in sight, with a confirmation, next to "Enregistrer le brouillon".

### Changed

- **Models named in full**: Gemma 4 E4B by Google, FLUX.2 klein 4B by Black Forest Labs, Qwen3 4B by Alibaba; where they come from (Hugging Face) and where they are kept (the browser's cache).
- **Remplir avec l'IA**: taller text field.
- **Legal pages**: the three local models named, with their makers; kept in the browser's cache until deleted.

## 1.21.1 - 2026-11-08

Front and backend 1.21.1. No database migration.

### Fixed

- **Remplir avec l'IA**: the choice between Gemini and the local AI looks like two real buttons, and says what each one reads.

### Changed

- **Remplir avec l'IA, Générer avec l'IA**: the model in use is named (Gemini, Gemma 4 E4B, FLUX.2 klein 4B); a photo is announced as read by Gemini.
- **Remplir avec l'IA**: "Essayer avec un exemple" writes a sample recipe in the empty text field.
- **Privacy policy**: names the local models, and says a recipe photo only goes to Gemini.

## 1.21.0 - 2026-11-08

Front and backend 1.21.0. No database migration.

### Added

- **Remplir avec l'IA, local model**: Gemma 4 E4B runs in the admin's browser (WebGPU), for pasted text only, next to Gemini; downloaded once from Hugging Face (5.2 GB), kept in the browser, removable. Still usable when Gemini is out of quota.
- **Générer avec l'IA**: every photo field of the back-office can draw an image in the browser with FLUX.2 klein 4B (6.5 GB), then send it to the photo editor.

### Changed

- **Legal pages**: privacy policy and legal notice cover the models running in the admin's browser.

### Technical

- Front: `core/local-ai/` (pinned model files, Cache storage, one Web Worker per network so that graphics memory is freed); ONNX Runtime's WebAssembly served by the site (`/ort/`).
- Backend: `GET /api/admin/recipe-ai/local-prompt` and `POST /api/admin/recipe-ai/local-draft`: same rules and same checks as Gemini.
- CSP: `wasm-unsafe-eval`, and Hugging Face in `connect-src`.

## 1.20.1 - 2026-11-08

Front and backend 1.20.1. No database migration.

### Fixed

- **Donner mon avis**: the reCAPTCHA failed to load, or stayed on "Chargement…", in browsers with the service worker: its Content-Security-Policy did not allow Google's scripts.

### Changed

- **Donner mon avis**: the reCAPTCHA is shown as soon as the page opens, without a first click; privacy policy updated.
- **`devops/.env.example`**: `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` set to Google's public test keys, with where to create the production ones.

### Technical

- Service worker registered at a new address (`ngsw-worker.js?v=2`), so installed browsers replace the one holding the old policy.

## 1.20.0 - 2026-11-08

Front and backend 1.20.0. No database migration. New required production variables: `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`.

### Changed

- **Donner mon avis**: Google reCAPTCHA v2 checkbox instead of the 1.19.0 check, loaded only after the visitor's click.
- **Privacy policy**: what Google receives with the reCAPTCHA.

### Technical

- Backend: `GET /api/feedback/captcha` replaces `GET /api/feedback/challenge`; each answer checked with Google outside any transaction, 20 checks an hour per address, message refused when Google cannot answer.
- SSR server: CSP opened to Google's reCAPTCHA (scripts and frame).
- Keys: [docs/google.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/google.md#5-recaptcha); Google's public test keys by default in the local stack.

## 1.19.0 - 2026-11-08

Front and backend 1.19.0. No database migration.

### Added

- **Donner mon avis**: "Je ne suis pas un robot" checkbox, required to send a message. The browser solves a one-time challenge from the backend: no third-party service, no cookie.

### Fixed

- **Statistics, machine memory**: the disk cache no longer counts as used (a server up for a while looked almost full); the tile now leads with the memory used, not the free part.
- **Donner mon avis**: a refused message shows the real reason (one a minute, too many messages…) instead of a generic connection error.

### Technical

- Backend: `GET /api/feedback/challenge`, `feedback/FeedbackCaptcha` (signed SHA-256 proof of work); `POST /api/feedback` refused without a solved challenge.
- Backend: available memory from `MemAvailable`, or the free memory plus the inactive disk cache in a container with a limit.

## 1.18.1 - 2026-11-02

Front and backend 1.18.1. Database migration: V19.

### Fixed

- **Security, notifications**: new subscriptions limited to 10 an hour per address and 300 an hour for the whole site, so a script can no longer fill the 20,000 places; a subscription its push service refuses 3 times in a row (400, 403…) is removed.
- **Security, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`**: an address with a query string is redirected (301) to the plain one, instead of being built again from the API past Cloudflare's cache.
- **Dependencies**: Angular 22.2.4 (build tools 22.2.5, Vite 8.3.5) and body-parser 2.4.0, `npm audit` clean.

### Technical

- Backend: the visitor's address for the public limits in `common/ClientAddress` (feedback and notifications).
- Security review of 2026-11-02 in [SECURITY-REVIEW.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/SECURITY-REVIEW.md).

## 1.18.0 - 2026-11-02

Front and backend 1.18.0. No database migration.

### Added

- **Every page in Markdown**: the address of an indexable page + `.md` (`/index.md` for the home page, `/recettes.md?categorie=desserts` for a category, `…/index.md` too), or the page's own address asked for with `Accept: text/markdown`. Announced by each page, canonical address kept on the page.
- **`/llms-full.txt`**: the whole text of the site in one file (Yona, every recipe in full, the menus, the glossary), linked from `/llms.txt`.

### Changed

- **robots.txt**: every robot allowed, AI training included (GPTBot, ClaudeBot, CCBot…), named with the AI search robots. Cached one hour instead of one day.
- **Conditions d'utilisation**: AI training no longer refused (text and data mining, article L122-5-3); reproducing the contents still needs the author's consent.
- **Installer l'application**: the steps for iPhone, Android and computer are all in the page, readable without JavaScript.
- **Social cards**: the site's icon for a page without a photo, the category's photo for a category page.

### Technical

- SSR server: pages in Markdown in `front/src/server/markdown.ts`, written from the API (`page-markdown.ts`) or converted from the rendered page with Turndown (`rendered-markdown.ts`: installation, legal pages).

## 1.17.0 - 2026-11-01

Front and backend 1.17.0. No database migration.

### Added

- **Conditions d'utilisation** page (`/conditions-d-utilisation`): free access, recipes to make with care (allergies, hygiene, indicative quantities and timers), visitor messages, forbidden uses, sharing and reuse of the contents, AI assistants welcome to quote with a link, AI training refused (article L122-5-3 of the French intellectual property code). Linked from the footer, the legal notice, the feedback page, the sitemap and `/llms.txt`.

## 1.16.0 - 2026-11-01

Front and backend 1.16.0. Database migration: V18.

### Added

- **Questions fréquentes** in the recipe editor: questions and answers shown under the recipe, given to search engines as FAQPage and kept in the history, the trash and the backups.
- **"À propos de Yona"** page (`/a-propos`): the text, photo and networks of the home page's "À propos", linked from the home page, the footer and each recipe ("Une recette de Yona").
- **`/llms.txt`**: the site described for AI assistants, with every published recipe, menu and page, built on each request like the sitemap.
- **Recipes in Markdown**: the address of a recipe + `.md` (`/recettes/tartes/tarte-aux-pommes.md`), announced by each page, canonical address kept on the page.
- **IndexNow**: Bing (ChatGPT Search, Copilot) and the other IndexNow engines are told at once of each recipe published, changed, unpublished or deleted. Production only.
- **Statistiques, "Visites venant des assistants IA"**: visits coming from ChatGPT, Perplexity, Gemini, Copilot, Claude… over 30 days and 12 months, counted once per tab with nothing about the visitor.

### Changed

- **robots.txt**: AI assistants that answer with a link (OAI-SearchBot, PerplexityBot, Claude-SearchBot…) named and welcome; robots collecting for AI training (GPTBot, ClaudeBot, CCBot…) refused. Google-Extended stays allowed (Gemini's answers).
- **Structured data**: one JSON-LD graph per page, the site (`WebSite`) and Yona (`Person`) shared by every page; recipes with `BreadcrumbList`, their YouTube video (`VideoObject`) and language; recipe lists and menus as `CollectionPage` and `ItemList`.

### Technical

- SSR server: API calls of the sitemap, `llms.txt` and Markdown versions in one module (`front/src/server/api.ts`).
- Backend: `app.site-url` (`SITE_URL`) and `app.indexnow` (`INDEXNOW_ENABLED`, set in `compose.prod.yaml`), key file `front/public/f5d890788ccc4557ecd282dea7299d26.txt`.

## 1.15.0 - 2026-10-31

Front and backend 1.15.0. No database migration.

### Added

- **Restore, "Ajouter ce qui manque"**: also brings back the backup's Préférences (texts and photo of the home page, footer) and Apparence when the site's were never edited, e.g. on a new server. Edited ones stay as they are.
- **Restore**: menus are counted, listed among what is missing and in the report; searches without a result (Statistiques) are merged too.

### Fixed

- **Restore refused any archive holding a menu photo** ("archive invalide"): the `menus/` folder was not accepted. The accepted folders now come from the image kinds, so a new kind cannot be forgotten again.

### Changed

- "Sauvegarde" page: lists everything the archive holds, and what stays on the server (history, visitors' messages, notification subscribers, Google Drive account).

## 1.14.1 - 2026-10-29

Front and backend 1.14.1. No database migration.

### Fixed

- **Public pages slow to load** (1 to 5 s per request): the service worker, busy installing a new version, held every answer of the API. The page now asks the API directly, as the back-office does, and keeps its own copy in the browser for offline reading (used when the network does not answer within 3 s).

## 1.14.0 - 2026-10-29

Front and backend 1.14.0. No database migration.

### Added

- **Connection lost / back**: a toast says the site is offline (recipes already opened stay readable) until the connection comes back, then "Connexion retrouvée".
- **"Mettre à jour"**: a page opened before a deployment offers the new version in a toast as soon as it is ready, instead of waiting for a change of page.

### Changed

- **Faster pages**: the answers of the public API (recipes, categories, menus, texts, theme, search suggestions) are kept in the backend's memory, emptied at every change made in the back-office, scheduled publication or restored backup. About 10 ms instead of 15 to 50 ms each; pages rendered by the server 80 to 100 ms instead of 110 to 200 ms (local measures).
- **Back-office always up to date**: never served from the service worker's copy, it loads the version on the server.

### Technical

- Every API answer says the backend version (`X-App-Version`); a front older than it looks for its new version at once.
- Spring Cache with Caffeine: 500 answers per cache at most, 10 minutes at most.
- 134 backend tests, 104 front tests, 82 Chrome checks.

## 1.13.0 - 2026-10-29

Front and backend 1.13.0. No database migration.

### Added

- **Live server curves** in Statistics ("Suivre en direct"): processor and memory of the backend measured every 1, 2 or 5 s, the last 60 drawn, values on hover.
- **Free rotation** in the photo editor: a dial to press and turn, stopping on 0, 90, 180 and 270°; the frame stays on the tilted photo, no empty corner.

### Changed

- **Smaller photos accepted**: landscape or square, 800 × 450 px at least (1200 × 800 and 4:3 before); Pinterest 600 × 800 (1000 × 1333). Any image the browser opens (iPhone HEIC, WebP) goes through the editor, sent as JPEG; 10 MB at most.

### Fixed

- Statistics exported as PDF: charts printed, "Actualiser" buttons left out.

### Technical

- **Backend memory** about 370 to 400 MB at rest (420 MB in 1.12.0): heap capped at 256 MB, quick compiler (C1) only.
- API: `GET /api/admin/stats/server` (memory and processor alone, for the live curves); `PUT /api/admin/images/{id}` follows the same size rules as an upload.
- 131 backend tests, 100 front tests, 82 Chrome checks.

## 1.12.0 - 2026-10-29

Front and backend 1.12.0. Database migration: V17.

### Added

- **Photo editor** before every upload and on photos already on the site ("Retoucher", also in the gallery): crop (free, 4:3, 3:2, 16:9; 2:3, 3:4 for Pinterest), quarter turns, mirror, filters (Bright, Gourmet, Soft, Contrasted, Fresh, Black and white), brightness, contrast, colours and warmth. A retouched photo replaces the original wherever it is shown; the original goes to the trash.
- **History details**: each update lists the fields changed, old value struck through, new value next to it; for ingredients, steps and other lists, the lines removed and added. Photo changes of a recipe are recorded too.
- **Smarter search**: words are also looked for in the steps and the equipment; a time is understood ("dessert en 30 min", "brioche 1h30"), as are "rapide", "facile" and "sans cuisson".

### Changed

- **A single featured recipe** on the home page again (the latest published one when none is chosen).
- **Home page**: the 3 latest savory recipes and the 3 latest sweet ones, each with a link to all recipes of the theme, instead of the 3 latest.
- Photos larger than 2400 px are made smaller in the browser before upload: quicker from a phone.

### Fixed

- Home search bar wider than a phone screen when a number of people was typed; long placeholder cut with an ellipsis.
- Tapping − and + quickly (servings) zoomed the page in on iPhone.

### Technical

- **Backend memory** about 420 MB at rest instead of 700 to 800 MB: heap capped at 320 MB, G1 giving memory back when idle, GC and compiler threads for 2 cores, native memory trimmed, 5 database connections, 40 web threads at most.
- API: `changes` on history lines, `PUT /api/admin/images/{id}` (retouched photo), `theme` of `/api/featured-recipe` kept for installed apps only.
- 131 backend tests, 98 front tests, 82 Chrome checks.

## 1.11.0 - 2026-10-29

Front and backend 1.11.0. Database migration: V16. Includes 1.10.1, never released.

### Added

- **Themes belong to categories**: each category is Sweet, Savory or Both. A recipe takes the theme of its main category; it is chosen by hand only in a "Both" category.
- **"Salé" and "Sucré" menus** in the navbar (and on phones) instead of "Catégories": each theme with its categories and "All savory recipes". A "Both" category shows in each menu it has recipes for, opening only those.
- **Back-office Categories**: theme of each category; changing it moves its recipes (after confirmation).
- **"Scheduled" status** (blue) in the back-office for a draft with a publication time, with its own filter.

### Changed

- Savory before sweet everywhere (menus, filters, home page), as a meal goes.
- **Recipes page** reorganised: search on its own line, then labelled filters (Type, Number of people, Ingredients, Category).
- **Number of people**: a − / + counter (number can be typed, × to reset) instead of the "Comme la recette" menu.
- Existing categories classified from their name, recipes following their main category (fixes the all-sweet migration of 1.10.0).

### Technical

- API: `theme` and `publishedThemes` on categories, `PUT /api/admin/categories/{id}` renamed `updateCategory` (name and theme), `theme` of the recipe form optional, `scheduled` filter on `/api/admin/recipes`.
- 122 backend tests, 89 front tests, 81 Chrome checks.

## 1.10.0 - 2026-10-29

Front and backend 1.10.0. Database migration: V15.

### Added

- **Sweet and savory themes**: every recipe is one or the other; theme filter on the recipes page and in the back-office.
- **Home page**: one featured recipe per theme, side by side.
- **Feature a scheduled recipe**: it becomes the featured one of its theme once published.
- **"Failed" status** (red) next to Draft (grey) and Published (green): a scheduled recipe more than 30 min late (site down, old backup restored) or failing 3 times in a row is not published; reason shown, "Publish now" button.
- **Smarter search**: "cake salé" suggests the savory theme (and still finds "caramel au beurre salé"), "gâteau au yaourt" suggests the Yaourt ingredient, "gâteau 8" shows a "8 pers." chip with − and +; "No result" message with an icon.
- **Recipes page**: "For how many people?" carried to the recipes opened.
- **Shopping list**: − and + per recipe; items read "Butter (90 g)".
- **Statistics**: memory and processor in use, failed publications, sweet and savory counts.
- **What's new**: GitHub and Coolify buttons.

### Changed

- Changelog in English, versions renumbered from 3.x to 1.x.
- Shop aisles named as in a supermarket: "Bakery" removed (its ingredients left without aisle), "Fresh" added, a hint for each.
- History: 20 lines a page, pagination above and below the list.
- Visitor feedback: one message a minute per address, 30 an hour for the whole site, duplicates kept once.

### Fixed

- Glossary: a word with a hyphen disabled every word; hyphens, underscores and spaces now match alike.
- Feedback page: email field border; back-office feedback cards: outline kept on unread messages.
- Changelog links open the file on GitHub instead of a missing page of the site.

### Technical

- API: `theme` on recipes, `GET /api/featured-recipe?theme=`, `POST /api/admin/recipes/{id}/publish`, `themes` in search suggestions, `server` in statistics, `theme` read by the AI.
- 117 backend tests, 84 front tests, 74 Chrome checks (themes, smart search, failed status, shopping list servings, GitHub links).

## 1.9.0 - 2026-10-28

Front and backend 1.9.0. Database migration: V14.

### Added

- Site-wide search: header magnifier and home page bar, words matched in titles, categories, tags and ingredients, suggestions by kind; "tarte 8 personnes" opens recipes for 8.
- "Give feedback" form for visitors; "Feedback" page in the back-office.
- Back-office history (who did what, kept 6 months), editable home page titles.
- Trash also keeps tags, ingredients and glossary words.

### Technical

- `GET /api/search-suggestions`, `POST /api/feedback` (honeypot, 5 an hour per address), `/api/admin/feedback`, `/api/admin/history`.

## 1.8.1 - 2026-10-28

Front and backend 1.8.1. No database migration.

### Technical

- Documentation: corporate networks and Cloudflare Bot Fight Mode.

## 1.8.0 - 2026-10-28

Front and backend 1.8.0. No database migration.

### Added

- "Fill with AI" in the recipe editor: Gemini reads pasted text or a photo and fills the form, nothing saved ([docs/ia.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/ia.md)).

### Changed

- Menus without a photo show the default visual.

## 1.7.0 - 2026-10-28

Front and backend 1.7.0. Database migration: V13.

### Added

- A photo for each menu.

### Fixed

- Offline: pages already seen open at once, no more 30 s wait then "Forbidden".
- Installed app recognised from the browser; Search Console recipe steps completed.

## 1.6.0 - 2026-10-28

Front and backend 1.6.0. No database migration.

### Added

- Trash: multiple selection to restore or erase.

## 1.5.3 - 2026-10-28

Front and backend 1.5.3. No database migration.

### Fixed

- Back-office recipe list keeps its scroll position when sorting or filtering.

## 1.5.2 - 2026-10-27

Front and backend 1.5.2. No database migration.

### Fixed

- Back-office recipe list empty ("sort not allowed").

## 1.5.1 - 2026-10-27

Front and backend 1.5.1. No database migration.

### Changed

- No full stop at the end of texts shown on the site.

## 1.5.0 - 2026-10-27

Front and backend 1.5.0. Database migration: V12.

### Added

- "Download the app" button; recipe view counts and most viewed recipes; sortable back-office recipe list.
- Trash also keeps categories, menus and photos, restored where they were.

## 1.4.0 - 2026-10-27

Front and backend 1.4.0. Database migration: V11.

### Added

- Menus (recipes for an occasion) with "Add all to my shopping list".
- Timers survive a page reload.

### Technical

- Accessibility (axe) and Lighthouse checks in the Chrome run; gateway compression.

## 1.3.0 - 2026-10-27

Front and backend 1.3.0. Database migration: V10.

### Added

- Timers kept across pages, free timer; shopping list sorted by aisle; equipment list.

### Technical

- End-to-end Chrome run (`e2e/`), documentation split into `docs/`, MIT licence.

## 1.2.0 - 2026-10-27

Front and backend 1.2.0. No database migration.

### Added

- Search with several ingredients, personal notes, cooking mode "Mise en place" and "+ 1 min", install banner, "What's new" page.

### Technical

- Unit tests: Vitest (front), JUnit (backend).

## 1.1.0 - 2026-10-26

Front and backend 1.1.0. Database migration: V9.

### Added

- New recipe notifications, mold size adaptation, "Plan my time", rest time, tips, related recipes, glossary.
- Back-office: trash, scheduled publication, duplicate, auto-saved draft, nightly Google Drive backup.

### Technical

- Built-in icons instead of `@lucide/angular` (first load 730 → 505 KB).
