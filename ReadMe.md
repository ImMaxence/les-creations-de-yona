# Les créations de Yona

Le blog de cuisine et de pâtisserie de Yona : des recettes à suivre depuis son téléphone, une application installable, et un back-office pour les écrire. En ligne sur [les-creations-de-yona.fr](https://les-creations-de-yona.fr).

Version 3.3.0 · [Nouveautés](CHANGELOG.md) · Licence [MIT](LICENSE)

| Accueil | Recettes | Back-office |
| --- | --- | --- |
| ![Accueil sur ordinateur](docs/captures/pc-accueil.png) | ![Recettes sur ordinateur](docs/captures/pc-recettes.png) | ![Back-office sur ordinateur](docs/captures/pc-administration.png) |

| Installer l'application | Notifications | Glossaire |
| --- | --- | --- |
| ![Installer l'application sur téléphone](docs/captures/telephone-installer.png) | ![Notifications sur téléphone](docs/captures/telephone-notifications.png) | ![Glossaire sur téléphone](docs/captures/telephone-glossaire.png) |

## Ce que fait le site

**Pour les visiteurs, sans compte**

- Recettes avec recherche (titre, plusieurs ingrédients à la fois, catégorie, tag, temps, difficulté), portions et moule ajustables, « Organiser mon temps ».
- Mode cuisine : une étape par écran, mise en place à cocher (ingrédients et matériel), minuteurs qui sonnent et vibrent, gardés en changeant de page.
- Favoris, liste de courses rangée par rayon, notes personnelles : gardés dans le navigateur.
- Application installable, lisible hors connexion, notifications des nouvelles recettes.
- Glossaire de pâtisserie, mots expliqués d'un appui dans les étapes.

**Pour Yona (back-office, connexion Google)**

- Éditeur de recettes (parties, étapes minutées, matériel, conseil, publication programmée, brouillon gardé), aperçu, corbeille.
- Galerie de photos, catégories, tags, ingrédients (doublons, rayons), glossaire.
- Apparence (thèmes, polices), statistiques, sauvegardes (téléchargement, Google Drive chaque nuit, restauration), « Nouveautés ».

Le détail page par page : [docs/fonctionnalites.md](docs/fonctionnalites.md).

## Démarrage rapide

Avec Docker Desktop seulement (ni JDK ni Node sur la machine) :

```bash
cd devops
cp .env.example .env   # puis remplacer chaque valeur "change-me"
docker compose --profile app up -d --build --wait
```

Le site sur `http://localhost:8000`. Lancer le backend ou le front à part, avec rechargement à chaud : [docs/developpement.md](docs/developpement.md#démarrage-local).

## Tests

```bash
cd front && npm test   # tests unitaires du front (Vitest)
cd back && ./mvnw test # tests unitaires du backend (JUnit)
cd e2e && npm test     # parcours dans Chrome, le site lancé en local
```

## Documentation

| Document | Contenu |
| --- | --- |
| [Fonctionnalités](docs/fonctionnalites.md) | La spécification : chaque page du site et du back-office |
| [Développement](docs/developpement.md) | Stack, structure, lancement local, tests, API |
| [Production](docs/production.md) | Mise en ligne sur Coolify, Cloudflare, services Google |
| [Architecture et décisions](docs/architecture.md) | Modèle de données, choix techniques, images, charte graphique |
| [Roadmap](docs/roadmap.md) | Versions passées et points à vérifier |
| [CHANGELOG](CHANGELOG.md) | Le détail de chaque version, aussi affiché dans le back-office |
| [Sécurité](SECURITY-REVIEW.md) · [Restauration](docs/restauration.md) · [Google](docs/google.md) · [Domaine](docs/changement-de-domaine.md) | Revue de sécurité, procédures |

## Licence

Le code est sous [licence MIT](LICENSE) : libre de le reprendre, de le modifier et de le redistribuer, en gardant la mention « Copyright (c) 2026 Maxence Bonnici » et le texte de la licence.

Les contenus du site ne sont pas concernés : recettes, textes, photos, logo et portrait appartiennent à leur autrice et ne peuvent pas être réutilisés sans son accord.
