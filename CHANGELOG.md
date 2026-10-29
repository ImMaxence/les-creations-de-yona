# Changelog

Front and backend share one version number (semantic versioning: major breaks existing data, minor adds features, patch fixes). How to release: [docs/developpement.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/developpement.md#monter-la-version). Versions before 1.1.0 are summed up in the [roadmap](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/roadmap.md).

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
