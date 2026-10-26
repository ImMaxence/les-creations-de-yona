# Les créations de Yona

Blog de cuisine : recettes, catégories, recherche. Projet monorepo.

Dernière mise à jour : 2026-10-26 (version 3.0.0).

## Périmètre v1

### Pages publiques

- Accueil (`/`) :
  - Recette à la une : grande card en haut (image, titre, catégories). Champ `featured`, une seule à la fois ; si aucune, la plus récente publiée.
  - À propos : présentation de l'autrice, titre, texte et photo modifiables dans le back-office (Préférences) ; sans photo choisie, celle du projet Angular.
  - Les 3 dernières recettes, toutes catégories confondues, bouton « Voir plus » vers `/recettes`.
  - Toutes les catégories, avec image, cliquables vers `/recettes?categorie={slug}` (grille de 2 sur téléphone, 4 au-delà).
- Recettes (`/recettes`) :
  - Grille de cards de même taille (une par ligne sur téléphone avec une photo moins haute, 2 puis 3 colonnes) : image, date de création, titre (tronqué avec ellipsis), catégories.
  - Recherche par titre avec autocomplétion, ingrédient et catégorie choisis dans des menus déroulants (celui des ingrédients se filtre en tapant ; seuls les ingrédients des recettes publiées y figurent), recherche lancée dès le choix (une recette apparaît dans chacune de ses catégories). Filtres combinables, dans l'URL (`q`, `ingredient`, `categorie`).
  - « Plus de filtres » (repliés sur téléphone, sauf s'ils sont utilisés) : tag, temps total (prêt en 15 min, 30 min, 1 h au plus ; préparation + cuisson, une recette sans aucun temps est écartée) et difficulté (facile 1 à 2 étoiles, moyenne 2,5 à 3,5, difficile 4 à 5). Dans l'URL : `tag`, `temps`, `difficulte`. Pages filtrées ainsi en `noindex`.
  - « Effacer tous les filtres » dès qu'un filtre est actif (recherche comprise) : retour à toutes les recettes, en gardant le nombre par page.
  - Une recherche par titre sans aucun résultat est notée, anonymement, pour la page Statistiques (voir « Recherches sans résultat »).
  - Pagination numérotée, nombre d'éléments par page au choix.
- Recette (`/recettes/{slug-categorie}/{slug-recette}`) :
  - Header : image pleine largeur, titre et catégories superposés sur un dégradé noir qui part du bas de l'image, bouton « Retour » en haut à gauche (page précédente du site, sinon la catégorie principale de la recette), cœur (favori) et bouton « Partager » en haut à droite (feuille de partage du téléphone, sinon lien copié).
  - Tags de la recette sous l'introduction, chacun vers `/recettes?tag={slug}`.
  - Boutons « Mode cuisine », « Épingler » (Pinterest) et « Imprimer ».
  - Temps, et difficulté de 1 à 5 étoiles par demi-étoile (facultative).
  - Ingrédients, étapes, vidéo YouTube en bas de page si la recette en a une (chargée seulement au clic), date de dernière mise à jour.
  - Recette en parties (la pâte, la garniture…) : la liste « Ingrédients » est le total de toutes les parties (quantités d'une même unité additionnées, parties concernées indiquées sous chaque ingrédient), puis « Préparation » détaille chaque partie (ses ingrédients et ses étapes), avec un sommaire cliquable des parties.
  - « Ajouter à ma liste de courses » sous les ingrédients, avec les portions choisies (ajoutée de nouveau, la recette est mise à jour).
  - Mode cuisine : plein écran, une étape par écran en gros caractères, partie et numéro d'étape, barre de progression ; flèches du clavier ou glissement du doigt pour changer d'étape. Une étape qui a une durée a un minuteur (lecture, pause, remise à zéro) qui continue pendant qu'on change d'étape et sonne à la fin (bip et vibration) ; les minuteurs en cours restent affichés. Ingrédients de la partie (ou de la recette) à portée de main. Écran maintenu allumé pendant le mode, si le navigateur le permet.
  - Épingler : simple lien vers la page d'épinglage de Pinterest (adresse, photo et titre de la recette), sans aucun script de Pinterest ; photo verticale de la recette si elle en a une, sinon sa photo.
  - Impression : feuille de style d'impression (photo réduite, ingrédients puis étapes, sans boutons ni en-tête du site, couleurs claires).
- Erreurs : 404 (URL inconnue, recette introuvable ou en brouillon) et erreur serveur.
- Installer l'application (`/installer`) : bouton d'installation quand le navigateur le propose, guide pas à pas pour iPhone/iPad, Android et ordinateur.
- Mes favoris (`/favoris`) : recettes marquées du cœur, gardées dans le navigateur seulement (`localStorage`, clé `yona-favorites`, 200 au plus), sous forme de cards : lisibles hors connexion dans l'application installée. Pas de compte.
- Ma liste de courses (`/liste-de-courses`) : ingrédients des recettes ajoutées, les mêmes additionnés (même calcul que le total d'une recette en parties, recettes concernées sous chaque ingrédient), à cocher (cochés en bas), articles libres en plus, partage par WhatsApp, feuille de partage ou copie du texte, liste vidée sur confirmation. Gardée dans le navigateur (clé `yona-shopping-list`). Ces deux pages sont en `noindex`, et leur contenu n'apparaît qu'une fois la page chargée dans le navigateur (le serveur ne le connaît pas).

### Application installable (PWA)

- Le site s'installe comme une application (écran d'accueil du téléphone, ordinateur), sans store : plein écran, icône dédiée.
- Les pages et recettes déjà consultées restent lisibles hors connexion.

### Navigation

- Navbar : accueil, recettes, catégories en menu déroulant (environ 10 au maximum), installer l'application, administration (admins seulement). Icônes cœur (favoris) et panier (liste de courses) avec leur nombre d'éléments, aussi sur téléphone à côté du menu.
- Menu mobile : bouton hamburger, panneau plein écran avec les mêmes entrées, plus « Mes favoris » et « Ma liste de courses ».
- Footer sur toutes les pages : réseaux sociaux, mentions légales, politique de confidentialité, lien discret « Espace admin ».
- Affichage Clair / Auto / Sombre au choix du visiteur : icône dans la navbar, trois boutons dans le menu mobile. « Auto » (par défaut) suit le réglage du système. Choix gardé dans le navigateur (`localStorage`), appliqué avant le premier affichage.

### Back-office (`/admin`)

- Accès réservé à 2 admins via Google, pas de création de compte.
- Entrée : lien « Espace admin » du footer, visible de tous (l'application installée n'a pas de barre d'adresse pour taper `/admin`). Un visiteur qui le suit arrive sur la connexion Google, puis sur la page d'accès refusé. Pages jamais indexées.
- Recettes : liste paginée (20 par page), les dernières modifiées en premier, avec miniature de la photo ; recherche par titre, filtres ingrédient (menu filtrable), catégorie, tag et statut, le tout dans l'URL (`q`, `idIngredient`, `categorie`, `tag`, `statut`, `page`) ; création, modification, publication ou brouillon, suppression.
- Éditeur de recette : tags à cocher (facultatifs), créables depuis le formulaire ; « Photo Pinterest (facultative) » : photo verticale (1000 × 1333 px au moins, 3:4 ou plus haute, 2:3 conseillé), envoyée ou choisie parmi les photos verticales de la galerie, proposée par le bouton « Épingler » et jamais affichée sur le site.
- Aperçu : bouton « Aperçu » de l'éditeur, qui affiche en plein écran la recette telle que les visiteurs la verront, modifications non enregistrées comprises, sans rien enregistrer. Page `/admin/apercu/{id}` (version enregistrée, brouillon compris), liée depuis la liste pour les brouillons. Réservé aux admins (guard, et API sous `/api/admin`).
- Sélection multiple et suppression groupée (recettes, catégories, ingrédients, galerie) : cases à cocher, « Tout sélectionner » pour les éléments affichés, sélection gardée d'une page à l'autre. Tout ou rien : une catégorie qui contient des recettes ou un ingrédient utilisé annule la suppression, en les nommant.
- Liens filtrés : « Voir ses recettes » sous la photo de chaque catégorie, « Voir les recettes » sur chaque ingrédient utilisé, vers la liste des recettes filtrée. Galerie : sous chaque photo, « Voir les recettes » et « Voir les catégories » qui l'affichent (listes filtrées par `?photo=`), et sa date d'envoi. Plusieurs catégories par recette (puces à cocher), dont une principale ; catégorie créable depuis le formulaire de la recette. Parties facultatives (« Découper en parties ») : titre, ingrédients et étapes par partie, ingrédients et étapes déplaçables d'une partie à l'autre par glisser-déposer. Ingrédients proposés pendant la saisie, les plus utilisés en premier.
- Catégories, ingrédients (modifier, supprimer), réseaux sociaux (Pinterest compris).
- Tags (`/admin/tags`) : végétarien, sans gluten, de saison… Création, renommage, suppression (une à une ou groupée), nombre de recettes (brouillons compris), « Voir les recettes ». Nom unique (casse et accents ignorés), 40 caractères au plus. Contrairement à une catégorie, un tag utilisé peut être supprimé : il est retiré de ses recettes.
- Ingrédients : filtre « Utilisés / Non utilisés ». « Détecter les doublons » regroupe les ingrédients écrits de plusieurs façons (casse, accents, ponctuation, pluriels en -s/-x, une faute de frappe à partir de 6 lettres, deux à partir de 12) et propose de les fusionner : garder l'un d'eux (le plus utilisé par défaut) ou tout remplacer par un nouveau nom. Les recettes sont mises à jour, les autres ingrédients supprimés. Fusion refusée si deux d'entre eux figurent dans une même partie d'une recette.
- Galerie : toutes les photos envoyées, gardées même une fois remplacées. « Ajouter une photo » l'y range directement (avec barre de progression), sans l'afficher nulle part. Filtres « Utilisées / Non utilisées » et type d'envoi (dont « Photos Pinterest »), suppression, liens vers les recettes et catégories qui les affichent. Une photo de la galerie peut être remise sur une recette ou une catégorie (« Choisir dans la galerie ») : les photos paysage pour les photos du site, les photos verticales pour Pinterest, jamais l'une à la place de l'autre.
- Apparence : thème de couleurs (20 thèmes, chacun en version claire et sombre, dont 5 plus audacieux : Néon, Art déco, Lagon, Bonbon, Aurore boréale), police des titres (15) et police du texte (10), arrondi des coins de 0 à 999 px. Aperçu immédiat sur tout le site, visible des visiteurs une fois enregistré.
- Préréglages d'apparence (« Mes préréglages », en haut de la page Apparence) : un thème, deux polices et un arrondi gardés sous un nom libre (unique, 50 caractères au plus). Chaque préréglage montre ce qu'il contient (couleurs claires et sombres, polices, arrondi) ; un clic remplit les choix de la page (et l'aperçu), à enregistrer ensuite comme d'habitude ; celui qui correspond aux choix en cours est coché. Remplacer par les choix actuels, renommer, supprimer.
- Préférences : textes et photo de « À propos » et texte du pied de page ; la nouvelle photo n'est qu'un aperçu tant que « Enregistrer » n'est pas cliqué, comme les textes ; « Annuler les changements ».
- Sauvegarde : bouton « Sauvegarder mes données », qui télécharge une archive ZIP (base PostgreSQL, tout le bucket S3, et un `manifest.json` avec la date et la version du site).
- Restauration (même page) : glisser le ZIP (ou le choisir). Il est envoyé par morceaux de 32 Mio (Cloudflare refuse les requêtes de plus de 100 Mo), avec barre de progression ; le serveur l'analyse dans une base à part, sans toucher au site, puis affiche la date et la version de la sauvegarde et un tableau « dans la sauvegarde / sur le site / manquant sur le site ». Deux choix :
  - « Ajouter ce qui manque » (conseillé) : n'ajoute que ce que le site n'a pas, sans rien modifier ni supprimer (détails dans « Sauvegarde et restauration »).
  - « Tout remplacer », dans une zone danger repliée : avertissements chiffrés (recettes perdues, fichiers photo supprimés), case « J'ai compris », mot REMPLACER à taper, confirmation finale.
  - Une restauration à la fois ; elle reprend si la page est rechargée (identifiant gardé dans `sessionStorage`) ; « Annuler » supprime l'archive du serveur.
- Statistiques (`/admin/statistiques`) : recettes (publiées, brouillons, sans photo, avec vidéo, en plusieurs parties, créées sur 30 jours), catégories, ingrédients et photos (dont non utilisés) ; recettes créées par mois sur 12 mois, recettes par catégorie, ingrédients les plus utilisés ; stockage : poids des photos (tout le bucket), taille de la base, espace libre et total du disque du serveur. Graphiques à une seule série, couleur d'accent du thème, valeurs écrites à côté des barres ou dans un tableau. Puis ce qui reste à faire :
  - Recettes à compléter (100 au plus) : sans photo, introduction, temps, portions ou difficulté, ce qui manque à chacune, les publiées d'abord.
  - Brouillons oubliés (pas modifiés depuis 30 jours) et recettes à rafraîchir (publiées, pas modifiées depuis 12 mois), 50 au plus chacun.
  - Recherches sans résultat (30 au plus, les plus fréquentes d'abord), à effacer une à une ou toutes.
  - Bouton « Visites (Google Analytics) » vers `analytics.google.com` (la fréquentation n'est pas recopiée dans le back-office) et « Exporter en PDF » : impression de la page (tableaux dépliés, sans menus), que le navigateur propose d'enregistrer en PDF.
- Infobulles des boutons-icônes : à droite de l'icône, centrées (à gauche s'il n'y a pas la place, au-dessus en dernier recours), jamais par-dessus.
- Photos : barre de progression pendant l'envoi, puis « Préparation de la photo… » pendant la conversion WebP. Choix dans la galerie : les plus récentes en premier, pagination numérotée.

### Pages légales

- Mentions légales (`/mentions-legales`) et politique de confidentialité (`/politique-de-confidentialite`), liées depuis le footer.
- Mentions légales : certaines images d'illustration sont générées par IA (Google Gemini), comme l'exige la transparence sur les contenus générés. à titre non professionnel (adresse communiquée sur demande, art. 6, III, 2 LCEN). Hébergement : auto-hébergé à Aix-en-Provence, derrière Cloudflare. Crédits : les 25 polices proposées (licence SIL Open Font License), à tenir à jour avec `theme-fonts.ts`. Contact et texte dans `front/src/app/pages/legal/`.
- Politique de confidentialité : mesure d'audience Google Analytics sur consentement, recherches sans résultat (texte seul, 12 mois), favoris et liste de courses (stockage local), bouton « Épingler » (simple lien).

### SEO

- Angular SSR, balises meta par page, données structurées Recipe (JSON-LD, avec les tags en `keywords`), sitemap.xml, robots.txt.

## Stack

| Partie | Choix |
| --- | --- |
| Frontend | Angular 22 |
| Backend | Spring Boot 4, Java 25 LTS, Maven |
| Base de données | PostgreSQL 18 |
| Migrations | Flyway Community (gratuit, open source) |
| Auth | Google (OIDC) via Spring Security, session serveur (cookie HttpOnly) |
| Images | Protocole S3 via AWS SDK v2 (BOM). SeaweedFS (compatible S3) en local et sur Coolify : seul l'endpoint change. Identifiants S3 en variables d'environnement, métadonnées des images en base |
| DevOps | Docker Compose sur Coolify : PostgreSQL 18 et SeaweedFS en conteneurs |
| Validation API | ProblemDetail (RFC 9457) |
| Mapping | MapStruct avec une configuration partagée `@MapperConfig` |
| Boilerplate | Lombok limité (getters et setters des entités, constructeur des services), DTO en records |
| Documentation API | springdoc-openapi exposé par le backend, consommé par le front pour générer ses services |
| Hébergement | Serveur perso sur Coolify, Cloudflare en DNS et proxy |

## Structure

```
back/      API Spring Boot
front/     application Angular
devops/    Docker Compose (local : compose.yaml, Coolify : compose.prod.yaml), passerelle Caddy, configuration d'environnement
docs/      documentation technique (restauration d'une sauvegarde)
ReadMe.md
```

## Démarrage local

Prérequis : Docker Desktop (Compose v2).

```bash
cd devops
cp .env.example .env   # puis remplacer chaque valeur "change-me"
docker compose up -d --wait
```

| Service | Image | Accès depuis la machine |
| --- | --- | --- |
| PostgreSQL | `postgres:18.6-alpine` | `localhost:5432` |
| SeaweedFS (API S3) | `chrislusf/seaweedfs:4.48` (`weed mini`) | `http://localhost:8333` |
| Backend (profil `app`, facultatif) | construit depuis `back/Dockerfile` | `http://localhost:8080` |
| Front SSR (profil `app`) | construit depuis `front/Dockerfile` | via la passerelle uniquement |
| Passerelle (profil `app`) | construite depuis `devops/gateway/` (Caddy 2.11.7) | `http://localhost:8000` : application complète |

- Ports exposés sur `127.0.0.1` uniquement, jamais sur le réseau local.
- Base créée avec la collation ICU `fr-FR` (tri français des titres). Checksums de données activés (défaut de PostgreSQL 18).
- Bucket `S3_BUCKET` créé au démarrage, privé : accès anonyme refusé, seuls les identifiants `S3_ACCESS_KEY` / `S3_SECRET_KEY` y accèdent. Pas de création automatique d'autres buckets, suppression d'un bucket non vide refusée. Télémétrie SeaweedFS désactivée.
- Arrêt : `docker compose down`. Remise à zéro complète (supprime les données) : `docker compose down --volumes`.
- Journaux : 3 fichiers de 10 Mo au plus par conteneur (`x-logging`), effacés aussi quand le conteneur est recréé (chaque déploiement). Cohérent avec la politique de confidentialité (12 mois au plus).
- Application complète dans Docker, sans JDK ni Node sur la machine : `docker compose --profile app up -d --build --wait`, puis `http://localhost:8000`. La passerelle (`devops/gateway/Caddyfile`, intégré à son image) envoie `/api/*` au backend et le reste au front, en local comme en production. Arrêt : `docker compose --profile app down`.

### Backend

Prérequis : JDK 25. Les services Docker Compose doivent tourner.

```bash
cd back
./mvnw spring-boot:run   # Windows : .\mvnw.cmd spring-boot:run
```

- Lit les identifiants de `devops/.env` (lancement depuis `back/`). En production, mêmes clés en variables d'environnement, plus `POSTGRES_HOST` et `S3_ENDPOINT` (par défaut `http://localhost:8333`).
- Flyway applique les migrations de `back/src/main/resources/db/migration` au démarrage. Hibernate vérifie seulement que les entités correspondent au schéma (`ddl-auto: validate`).
- Santé : `http://localhost:8080/actuator/health`.
- Documentation de l'API : `http://localhost:8080/api/docs` (OpenAPI, lu par le front pour générer ses services) et `http://localhost:8080/api/docs/ui` (Swagger UI). Désactivée par défaut, activée en local par `API_DOCS_ENABLED=true` dans `devops/.env`. En production, la variable reste absente : les URL de documentation sont refusées comme toute route inconnue.
- Connexion admin : client OAuth Google à créer (type « Application Web »), avec les URL de retour listées dans `devops/.env.example`. Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `APP_ADMIN_EMAILS` dans `devops/.env`. Application Google laissée en mode « Test », avec les adresses admin dans « Utilisateurs test ».
- Sauvegarde : nécessite le client `pg_dump` 18. Il est inclus dans l'image Docker. En lancement local, l'installer et renseigner `PG_DUMP_PATH`, sinon la route répond 503 `BACKUP_UNAVAILABLE`.
- Encodage WebP : libwebp est une bibliothèque native, autorisée par `--enable-native-access=ALL-UNNAMED` (déjà passé par `spring-boot:run` et par l'image Docker).

Image Docker (`back/Dockerfile`) : build Maven multi-étapes, jar découpé en couches Spring Boot, JRE Temurin 25 sur Ubuntu 26.04 avec `postgresql-client-18`, utilisateur non root, health check sur `/actuator/health`.

### Frontend

Prérequis : Node.js 24 LTS. Le backend doit tourner (`http://localhost:8080`, en local ou dans Docker).

```bash
cd front
npm ci
npm start              # http://localhost:4200, avec SSR, /api relayé vers le backend (proxy.conf.json)
npm run build          # build de production (navigateur + serveur SSR) dans dist/
npm run api:generate   # régénère le client API depuis http://localhost:8080/api/docs
npm run fonts:generate # régénère src/styles/_fonts.scss après une mise à jour d'un paquet @fontsource-variable
```

- Client API généré par `ng-openapi-gen` dans `src/app/core/api/generated` (versionné, ne pas modifier à la main). À régénérer après chaque changement d'API du backend.
- Budgets de build (`angular.json`) : bundle initial 800 Ko (avertissement), styles d'un composant 8 Ko. Lucide (`@lucide/angular`) est un seul fichier : toutes les icônes utilisées, back-office compris, vont dans le bundle initial (environ 320 Ko bruts, bien compressés : 135 Ko transférés en tout).
- Ajouter une police : paquet `@fontsource-variable/…` (version exacte), ligne dans `scripts/generate-fonts.mjs`, `npm run fonts:generate`, entrée dans `core/theme/theme-fonts.ts`, enum et contrainte CHECK côté backend (migration), crédits des mentions légales.
- Serveur SSR de production : `npm run serve:ssr` (port `PORT`, 4000 par défaut). Variables :
  - `API_URL` : URL interne du backend (ex. `http://back:8080`). Le serveur SSR l'appelle directement, sans repasser par Cloudflare. Sans elle, il appelle l'origine publique du site.
  - `NG_ALLOWED_HOSTS` : hôtes acceptés en plus de `les-creations-de-yona.fr` (protection SSRF d'Angular), ex. `localhost` pour un test local.
  - `NG_TRUST_PROXY_HEADERS` : en-têtes du proxy à prendre en compte (`x-forwarded-host,x-forwarded-proto,x-forwarded-for`), seulement si le serveur n'est joignable qu'à travers ce proxy.
- Cache HTTP : fichiers hashés (JS, CSS, polices) un an `immutable` ; fichiers de `public/` (favicon, photo de l'auteur, `robots.txt`) un jour, car leur nom ne change pas ; fichiers du service worker (`ngsw.json`, `ngsw-worker.js`, manifeste) jamais en cache, pour que les applications installées reçoivent les mises à jour.
- En-têtes de sécurité (`src/server/security-headers.ts`), posés par le serveur de production sur toutes ses réponses (pas par `npm start`, dont les scripts seraient bloqués) :
  - CSP : scripts du site uniquement. Les scripts inline du build (contrat d'event replay) sont autorisés par leur hash, calculé au démarrage depuis les fichiers HTML construits ; celui qu'Angular écrit au rendu par un nonce aléatoire propre à chaque réponse (`REQUEST_CONTEXT`, puis `CSP_NONCE`). Styles inline autorisés (styles de composants Angular). Aucune intégration dans une iframe (`frame-ancestors 'none'`). Iframes limitées au lecteur YouTube `youtube-nocookie.com` (vidéos des recettes, chargées au clic).
  - Inlining du CSS critique désactivé (`angular.json`) : son script de chargement ne peut pas recevoir le nonce. Coût faible, la feuille de style globale fait environ 15 Ko (2,5 Ko compressée).
  - HSTS (un an, sans sous-domaines), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (caméra, micro, géolocalisation, paiement coupés ; le maintien de l'écran allumé reste permis), `Cross-Origin-Opener-Policy`. `X-Powered-By` retiré.
- Référencement :
  - `/sitemap.xml` (`src/server/sitemap.ts`) : construit à chaque demande depuis l'API (accueil, recettes, catégories ayant au moins une recette, toutes les recettes publiées, installation, pages légales), en cache une heure. URL sur le domaine de production.
  - `public/robots.txt` : API exclue sauf les photos, lien vers le sitemap. `/admin` n'y figure pas exprès : ses pages répondent `X-Robots-Tag: noindex, nofollow`, que les robots doivent pouvoir lire.
- Application installable (PWA) : service worker Angular (`ngsw-config.json`), actif seulement dans le build de production. Pour le tester en local : `npm run build`, puis `npm run serve:ssr` ou l'application complète dans Docker. Icônes dans `public/icons/`, manifeste dans `public/manifest.webmanifest`. Nom sous l'icône une fois installée : « Recette Yona » (`short_name` du manifeste, `apple-mobile-web-app-title` pour iOS).
- Les écritures (POST, PUT, DELETE) contournent le service worker (en-tête `ngsw-bypass`) : relayé par lui, Safari sur iOS perd le fichier envoyé lors de l'upload d'une photo.
  - Pages : toujours demandées au serveur (rendu SSR à jour), version hors ligne en secours.
  - API publique (`/api/recipes`, catégories, réseaux sociaux) : réseau d'abord, cache de 30 jours si le réseau ne répond pas en 4 secondes.
  - Images : servies depuis le cache (leur URL change à chaque nouvelle photo), 30 jours.
  - `/api/admin/**` et la connexion Google ne passent jamais par le cache.
  - Une page rendue par le serveur reçoit ses données dans le HTML, sans appel à l'API : ces requêtes sont rejouées une fois en arrière-plan après le chargement (`core/pwa/offline-warmup.ts`), pour que la page soit aussi lisible hors connexion.

Image Docker (`front/Dockerfile`) : build Node 24 multi-étapes, image finale sans `node_modules` (le serveur SSR embarque ses dépendances), utilisateur non root, health check sur `/healthz` (répond sans rendu Angular).

Organisation de `front/src` :

```
app/core/      services globaux, layout (header, menus, footer), thème (couleurs, polices, clair/sombre), favoris et liste de courses (kitchen/), client API généré
app/shared/    composants d'interface (bouton, carte de recette, image), directive de reveal, utilitaires
app/pages/     une page par route, chargée à la demande
styles/        variables (espacements, breakpoints, animations), polices (généré), reset, base typographique, animations, impression
server/        middlewares du serveur SSR Express (en-têtes de sécurité, sitemap) ; point d'entrée : server.ts
scripts/       génération de styles/_fonts.scss (npm run fonts:generate)
```

### API

| Accès | Routes |
| --- | --- |
| Public (GET) | `/api/recipes` (recherche, filtres `category`, `tag`, `ingredient` (nom exact, accents ignorés), `maxMinutes` (1 à 1440), `difficulty` (`EASY`, `MEDIUM`, `HARD`), pagination ; une recherche `q` sans résultat est notée), `/api/ingredients` (ingrédients des recettes publiées), `/api/recipes/{slug}`, `/api/featured-recipe`, `/api/recipe-suggestions?q=`, `/api/categories`, `/api/tags` (avec le nombre de recettes publiées), `/api/social-links`, `/api/site-content`, `/api/theme`, `/api/images/{imageId}/800.webp` et `/1600.webp` |
| Admin | `/api/admin/me`, `/api/admin/stats` (statistiques et stockage), `/api/admin/recipes`, `POST /api/admin/recipes/preview` (aperçu sans enregistrement), `/api/admin/categories`, `/api/admin/ingredients`, `GET /api/admin/ingredients/similar`, `POST /api/admin/ingredients/merge`, `DELETE` sur `/api/admin/recipes`, `/categories`, `/ingredients` et `/images` avec `?ids=` (suppression groupée, tout ou rien), `/api/admin/social-links`, `PUT /api/admin/recipes/{id}/image` et `PUT /api/admin/categories/{id}/image` (nouvelle photo, multipart, champ `file`), `PUT …/{id}/image-choice` (photo de la galerie, ou `null` pour la retirer), `/api/admin/images` (galerie, filtres `kind`, `portrait` et `used` ; `POST` multipart pour y ajouter une photo), `PUT /api/admin/recipes/{id}/pinterest-image` et `…/pinterest-image-choice` (photo verticale), `/api/admin/tags` (`DELETE` avec `?ids=`), `PUT /api/admin/theme`, `/api/admin/appearance-presets`, `/api/admin/site-content`, `DELETE /api/admin/search-misses` (`?term=`, ou toutes), `/api/admin/version` (version du backend), `/api/admin/backup`, `/api/admin/restore` (`POST` pour commencer, `PUT …/{id}/chunks/{index}` en `application/octet-stream`, `GET …/{id}` pour l'état, `POST …/{id}/apply` avec `MERGE` ou `REPLACE` + `REMPLACER`, `DELETE …/{id}`) |
| Auth | Connexion : `/api/oauth2/authorization/google`. Déconnexion : `POST /api/auth/logout` |

- Erreurs : ProblemDetail avec `code` stable (`ErrorCode`) et `detail` en français. Erreurs de validation listées dans `errors` (`field`, `message`).
- Écritures admin : en-tête `X-XSRF-TOKEN` recopié du cookie `XSRF-TOKEN`, que `GET /api/admin/me` crée. Angular le fait automatiquement. Aucun cookie n'est posé pour un visiteur public.
- Images : le front construit l'URL à partir du `imageId` des recettes et catégories. Réponse `Cache-Control: public, max-age=31536000, immutable` : une nouvelle photo a un nouvel identifiant, donc une nouvelle URL.
- Sauvegarde : à ouvrir comme un lien classique (`<a href="/api/admin/backup">`), pas via `HttpClient`, qui chargerait toute l'archive en mémoire. Restauration : morceaux envoyés par `XMLHttpRequest` (progression), comme les photos (`core/api/image-uploads.ts`).
- Toute route non listée est refusée.

## Production (Coolify)

Fichier : `devops/compose.prod.yaml`. Mêmes services qu'en local, sans port publié ni profil. Seule la passerelle reçoit le domaine. Chaîne d'une requête : Cloudflare → Traefik (proxy de Coolify, HTTPS) → passerelle Caddy → front ou backend.

- URL publique : Traefik transmet `X-Forwarded-Proto: https` et le domaine. Caddy les conserve (`trusted_proxies`), le backend les lit (`forward-headers-strategy: framework`) pour construire l'URL de retour Google, et le serveur SSR (`NG_TRUST_PROXY_HEADERS`). Vérifié en simulant Traefik devant la stack de production : URL de retour `https://les-creations-de-yona.fr/api/login/oauth2/code/google`, domaine inconnu refusé (400).
- Secrets : identifiants PostgreSQL et S3 générés par Coolify au premier déploiement (`SERVICE_USER_*`, `SERVICE_PASSWORD_64_*`), conservés ensuite. À saisir : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_ADMIN_EMAILS`. Ne jamais définir `API_DOCS_ENABLED`.
- Données : volumes `postgres-data` et `seaweedfs-data`, conservés d'un déploiement à l'autre. Supprimer la ressource Coolify les supprime : faire une sauvegarde avant.
- Versions : `back/pom.xml` et `front/package.json`, en version sémantique (1.0.0), à monter ensemble à chaque mise en production : `npm version x.y.z --no-git-tag-version` dans `front/`, la balise `<version>` du `pom.xml` à la main. Affichées en haut du back-office (« Site v… · API v… ») : la version du front est lue dans `package.json` au build, celle du backend dans `build-info.properties` (plugin Maven de Spring Boot), par `GET /api/admin/version`.

Mise en place :

1. Projet Coolify → **+ New** → **Public Repository** : `https://github.com/ImMaxence/les-creations-de-yona`, branche `main`, build pack **Docker Compose**.
2. **Base Directory** : `/devops`. **Docker Compose Location** : `/compose.prod.yaml`. Les contextes de build (`../back`, `../front`, `./gateway`) sont relatifs à ce dossier.
3. **Domains** : sur le service `gateway` uniquement, `https://les-creations-de-yona.fr`. Les autres services restent sans domaine.
4. **Environment Variables** : renseigner les trois variables Google, laisser les variables générées.
5. **Deploy**. Premier build long (Maven et Angular sur le serveur).
6. Déploiement à chaque commit : Coolify, onglet **Webhooks** → **GitHub** : définir un secret, copier l'URL. GitHub, **Settings → Webhooks → Add webhook** : cette URL, `Content type: application/json`, le même secret, événement **push**. Vérifier que **Auto Deploy** est actif dans les options avancées de Coolify.
7. Google Cloud : URI de retour `https://les-creations-de-yona.fr/api/login/oauth2/code/google` et origine `https://les-creations-de-yona.fr` (déjà faits).

Cloudflare (offre gratuite, proxy seulement) :

- DNS : enregistrement `A` du domaine vers le serveur, proxifié (nuage orange), comme le site déjà hébergé sur ce Coolify.
- SSL/TLS : mode **Full (strict)** (ou **Full**). Jamais **Flexible** : Cloudflare appellerait le serveur en HTTP, Traefik redirigerait vers HTTPS, et la page bouclerait.
- **Email Address Obfuscation** (Scrape Shield, active par défaut) : à désactiver. Elle réécrit l'adresse de contact dans le HTML des pages légales, que le navigateur ne retrouve alors plus identique au rendu du serveur (erreur d'hydratation Angular).
- **Rocket Loader** (désactivé par défaut) : le laisser désactivé, il réécrit les balises `<script>`.
- Photos (`/api/images/*`) : Cloudflare les garde en cache (un an, réponse `immutable`). Une photo supprimée reste accessible à qui connaît son URL (UUID impossible à deviner) jusqu'à purge manuelle (**Caching → Purge Cache**). Accepté.

## Services Google

| Service | Rôle | Adresse |
| --- | --- | --- |
| Google Cloud Console, Identifiants | Client OAuth de la connexion admin : URI de retour et origines autorisées | https://console.cloud.google.com/apis/credentials |
| Google Cloud Console, Audience | Mode « Test » de l'application, adresses admin dans « Utilisateurs test » | https://console.cloud.google.com/auth/audience |
| Google Analytics 4 | Mesure d'audience, propriété `G-914Y0MV42H` (`front/src/app/core/analytics/analytics.ts`), après accord du visiteur | https://analytics.google.com/ |
| Google Search Console | Indexation, sitemap, recherches Google qui mènent au site | https://search.google.com/search-console |
| Test des résultats enrichis | Vérifier les données structurées Recipe (JSON-LD) d'une page | https://search.google.com/test/rich-results |

- Client OAuth : un seul client (`894227614182-d19k….apps.googleusercontent.com`) pour le local et la production. Ses URI de retour doivent contenir les 4 adresses listées dans `devops/.env.example`, à l'identique (`localhost` et `127.0.0.1` sont différents pour Google). Une adresse manquante donne `Erreur 400 : redirect_uri_mismatch` ; « Détails de l'erreur » sur la page de Google montre l'adresse envoyée. Une modification peut mettre quelques minutes à s'appliquer.
- Analytics : **Rapports → Temps réel** montre une visite dans la minute (site ouvert dans un autre navigateur, cookies acceptés, sans bloqueur de publicité). Les autres rapports arrivent en 24 à 48 h. **Administration → Flux de données → Mesure améliorée** : « Changements de page basés sur les événements de l'historique du navigateur » doit rester désactivé, sinon chaque page est comptée deux fois.
- Search Console : **Sitemaps** (`sitemap.xml` à l'état « Opération effectuée », nombre d'URL découvertes), **Inspection de l'URL** sur une recette (« Tester l'URL en ligne » : page indexable, recette détectée). Indexation en quelques jours à quelques semaines.

## Modèle de données

- `social_link` : platform (liste fixe : YouTube, TikTok, Instagram, Facebook, X, Threads, Reddit, WhatsApp, Pinterest), url, position. Éditable depuis le back-office.
- `site_theme` : une seule ligne (id = 1) : preset (thème de couleurs), display_font, body_font, radius_px (0 à 999), updated_at, updated_by.
- `appearance_preset` : name (unique, casse et accents ignorés), preset, display_font, body_font, radius_px, created_at, updated_at, updated_by. Valeurs vérifiées par l'application (mêmes enums que `site_theme`), sans contrainte CHECK : ajouter un thème ou une police ne touche pas cette table.
- `site_content` : une seule ligne : about_title, about_text, about_image_id (facultatif), footer_text, updated_at, updated_by.
- `search_miss` : term (texte cherché, en minuscules, 100 caractères au plus, clé), count, first_searched_at, last_searched_at. 500 lignes au plus, effacées après 12 mois.
- `image` : kind (envoyée pour une recette, une catégorie, « À propos », directement dans la galerie, ou photo Pinterest), s3_prefix (`recipes/{uuid}/`, `categories/{uuid}/`, `site/{uuid}/`, `gallery/{uuid}/` ou `pinterest/{uuid}/`), created_at. Filtrable par type et par utilisation dans la galerie.
- `category` : name, slug (unique), image_id (facultatif, vers `image`).
- `recipe` : title, slug (unique), intro, status (publiée ou brouillon), servings, prep_minutes, cook_minutes, difficulty (1 à 5 par demi-points, facultative), youtube_video_id (identifiant de 11 caractères, facultatif), image_id (facultatif, vers `image`), pinterest_image_id (photo verticale, facultative, vers `image`), featured (booléen), created_at, updated_at (timestamptz, UTC), created_by, updated_by (email de l'admin, texte).
- `recipe_category` : recipe_id, category_id, position. Clé primaire (recipe_id, position), (recipe_id, category_id) unique. Position 0 : catégorie principale.
- `tag` : name (unique, casse et accents ignorés), slug (unique).
- `recipe_tag` : recipe_id, tag_id. Clé primaire (recipe_id, tag_id) ; supprimer un tag le retire de ses recettes (`ON DELETE CASCADE`).
- `recipe_part` : recipe_id, position, title (facultatif). Au moins une par recette : une recette sans parties en a une seule, sans titre.
- `ingredient` : name (unique).
- `recipe_ingredient` : part_id, ingredient_id, quantity, unit, note, position. Clé primaire (part_id, ingredient_id) : un ingrédient une fois par partie, mais possible dans plusieurs parties d'une recette.
- `recipe_step` : part_id, position, description, duration_minutes.

## Décisions

### Général

- Interface en français uniquement. Mobile first : conception pour écran de téléphone d'abord (environ 90 % du trafic), puis adaptation desktop.
- Noms de tables, colonnes et code en anglais.
- Pas de tests automatisés, ni backend ni frontend (la restauration a été testée à la main sur une pile Docker jetable, voir SECURITY-REVIEW.md). À l'init du back et du front, supprimer les fichiers générés inutiles (tests unitaires, configuration Prettier, etc.).
- Pas de commentaires sur le site, ni en v1 ni prévus.
- Logo en dur dans le projet Angular, photo de l'autrice par défaut aussi (remplaçable dans Préférences). Couleurs, polices et arrondi choisis dans le back-office (`site_theme`).
- Sans compte visiteur : favoris et liste de courses restent dans le navigateur (`localStorage`), rien n'est envoyé au serveur. Notifications de nouvelle recette (Web Push) : prévues plus tard.
- Routage sur un domaine unique : site à la racine, API sous `/api`. Domaine `https://les-creations-de-yona.fr/`, déjà en place.
- Flyway Community (gratuit) plutôt que Liquibase : migrations SQL simples, base PostgreSQL unique.
- Erreurs API en ProblemDetail (RFC 9457) : format JSON standard (`type`, `title`, `status`, `detail`), identique pour toutes les erreurs. Ajout d'un code stable et d'un message en français, affichables en toast côté Angular.

### Frontend

- Angular 22 avec signals (`signal`, `computed`, `input()`, `output()`), composants standalone, sans NgModule.
- Styles en SCSS uniquement, sans Tailwind ni framework CSS. Espacements, breakpoints et animations dans `styles/_variables.scss` ; couleurs, polices et arrondi dans `core/theme/`.
- Composants d'interface faits maison (boutons, champs, barre de recherche, etc.), sans bibliothèque de composants.
- Icônes : Lucide (licence ISC, libre).
- Animations sobres et soignées, pensées comme une signature du site, sans effet gratuit :
  - Entrées de page et de sections : fondu et léger glissement (reveal au scroll via `IntersectionObserver`, une seule fois par élément).
  - Cartes de recettes : légère élévation et zoom de l'image au survol (et à l'appui sur mobile).
  - Transitions entre pages : View Transitions API, avec repli sans effet si non supporté. Pas de transition quand seuls les paramètres changent (recherche, filtre, page). La photo de la carte cliquée devient l'image d'en-tête de la recette (`view-transition-name` partagé, posé uniquement sur la carte cliquée).
  - Micro-interactions : états des boutons, champs et menu, avec des durées courtes (150 à 400 ms) et une courbe d'accélération douce.
  - Animations en CSS/SCSS (`@keyframes`, `transition`), sans bibliothèque d'animation.
  - `prefers-reduced-motion` respecté : sans mouvement, les éléments restent visibles immédiatement.
  - Uniquement des propriétés peu coûteuses (`opacity`, `transform`), pour rester fluide sur téléphone.
- Services HTTP générés depuis l'OpenAPI du backend. Les DTO marquent les champs facultatifs avec `@Nullable` (JSpecify) : tous les autres sont déclarés obligatoires dans l'OpenAPI, donc non optionnels en TypeScript.
- Données d'une page chargées par un resolver de route, avant l'affichage. Données communes (catégories, réseaux sociaux) chargées une fois au démarrage. Le serveur et le navigateur affichent donc la même page, et l'hydratation réutilise les réponses du serveur (cache de transfert HTTP) sans rappeler l'API.
- Styles : les composants lisent des propriétés CSS (`var(--color-accent)`, `var(--radius-md)`). Thème : `core/theme/` (`SiteTheme`) écrit sur `<html>` les couleurs (`light-dark(clair, sombre)`), les polices et l'arrondi chargés depuis `/api/theme` avant le premier rendu : la page rendue par le serveur a déjà le bon thème, sans flash. Clair ou sombre : `ColorScheme` pose `data-color-scheme` sur `<html>`, que `_root.scss` traduit en `color-scheme` ; un script inline de `index.html` (autorisé par son hash dans la CSP) l'applique avant le premier affichage.
- Thèmes de couleurs : `core/theme/theme-presets.ts`, chacun en version claire et sombre, contrastes vérifiés (texte ≥ 7:1, texte secondaire et accent ≥ 4,5:1). Texte posé sur une photo : `--color-on-image`, toujours clair.
- Polices : Fontsource (SIL Open Font License), auto-hébergées. `src/styles/_fonts.scss` est généré par `npm run fonts:generate` (sous-ensembles latin et latin étendu seulement) ; le navigateur ne télécharge que les polices utilisées par la page.
- Icônes de marque (Instagram, TikTok, YouTube, Facebook, X, Threads, Reddit, WhatsApp) : Simple Icons (CC0), Lucide n'en fournissant pas.
- API indisponible : page d'erreur (HTTP 503) en conservant l'URL demandée. URL inconnue, recette introuvable ou en brouillon : page 404 avec un vrai statut 404. Segment catégorie erroné dans l'URL d'une recette : redirection 301 vers l'URL canonique.
- SEO déclaré par route (`data.seo`, statique ou calculé après les resolvers), appliqué à chaque navigation par une `TitleStrategy` : titre, description, Open Graph, URL canonique, `robots`, JSON-LD (`Person` sur l'accueil, `Recipe` sur une recette). Résultats de recherche et pages vides en `noindex`.
- Recherche : combobox ARIA (flèches, Entrée, Échap), suggestions dès 2 caractères, texte tapé mis en évidence sans tenir compte des accents. Filtres et pagination dans l'URL (`q`, `categorie`, `page`, `parPage`), donc partageables.
- Page recette pensée pour cuisiner avec un téléphone : portions ajustables (quantités recalculées puis arrondies à des valeurs mesurables), ingrédients et étapes à cocher, écran maintenu allumé (Screen Wake Lock, proposé seulement si le navigateur le permet).
- Étapes en Markdown rendues par `marked` (MIT), puis nettoyées par le sanitizer d'Angular.
- Back-office (`/admin`) : rendu dans le navigateur uniquement (la session est un cookie), chargé à la demande, protégé par un guard qui renvoie vers la connexion Google sans session. Formulaires en Signal Forms (`@angular/forms/signals`) avec les mêmes règles que l'API, ingrédients et étapes réordonnables par glisser-déposer (`@angular/cdk/drag-drop`, MIT) ou par boutons pour le clavier. Erreurs de l'API affichées en toast avec leur message, confirmation avant suppression, alerte avant de quitter une recette non enregistrée.
- Modales : composant `yona-dialog` (`shared/ui/dialog`) pour toutes les modales (confirmation, choix dans la galerie, aperçu d'une recette) : `<dialog>` natif ouvert par `showModal()` (focus gardé, Échap, page inerte), en-tête (titre, croix) fixe en haut, actions (`dialogActions`) fixes en bas, seul le contenu défile ; tailles sm, md, lg, full ; fermeture au clic sur le fond. La confirmation n'est chargée qu'avec le back-office. Le menu mobile reste un panneau de navigation à part.
- Upload des photos par `XMLHttpRequest` (`core/api/image-uploads.ts`) : `fetch`, utilisé par HttpClient, ne mesure pas l'envoi d'un fichier ; XSRF, contournement du service worker et erreurs en toast y sont repris.
- Listes déroulantes : composant `yona-select` fait maison (pattern ARIA combobox), la liste native d'un `<select>` ne se stylant pas. Champ avec suggestions (ingrédients) : `yona-suggest-input`, pour la même raison avec `<datalist>`.

### Dates

- Stockage en UTC (`timestamptz` côté PostgreSQL, `Instant` côté Java). Affichage en heure de Paris (`Europe/Paris`) côté Angular, qui gère l'heure d'été et d'hiver.
- `updated_at` enregistré à chaque sauvegarde. `created_by` et `updated_by` renseignés depuis la session admin.

### Auth et sécurité

- Authentification Google OIDC. Allowlist des emails admin dans la variable d'environnement `APP_ADMIN_EMAILS`, sans table utilisateur. Email non autorisé : page d'accès refusé.
- Google OAuth : deux URL de retour, une pour le local et une pour la production.
- Session serveur (cookie HttpOnly, Secure, SameSite), expirée après 7 jours d'inactivité, plutôt que JWT. Sessions en mémoire, sans persistance : un redémarrage ou un redéploiement déconnecte l'admin, accepté. Bouton de déconnexion.
- Autorisation par règles d'URL dans Spring Security : `/api/admin/**` réservé aux admins.
- Pas de bouton de connexion sur le site public : l'admin passe par `/admin`, via le lien discret « Espace admin » du footer. Ce lien ne donne aucun droit : la protection est côté serveur (Google, liste des admins, rôle exigé sur `/api/admin/**`).
- Cookies : ceux de Google Analytics (`_ga`, `_ga_…`) seulement si le visiteur accepte la mesure d'audience dans le bandeau (choix gardé 6 mois, script de Google non téléchargé avant). Sinon, cookies techniques seulement, dispensés de consentement : session admin et CSRF (posés uniquement à la connexion d'un admin), et éventuellement `__cf_bm` de Cloudflare. Détail dans la politique de confidentialité.

### Recherche et pagination

- Recherche par JPA Specifications sur titre, catégorie, tag, ingrédient, temps total et difficulté, insensible à la casse et aux accents (extension `unaccent`). Sécurisée contre l'injection SQL : valeurs passées en paramètres liés, jamais concaténées. Tri limité à une liste de champs autorisés, `%` et `_` saisis par l'utilisateur échappés.
- Autocomplétion des titres : endpoint dédié, 5 suggestions maximum.
- Pagination offset avec `Pageable`. L'accueil appelle la même route avec `size=3`.
- Recette recherchée par slug seul. Si le segment catégorie de l'URL ne correspond pas, redirection 301 vers l'URL canonique, gérée par Angular SSR qui interroge l'API par slug.

### Recettes

- Création : titre, au moins 1 catégorie, au moins 1 ingrédient et au moins 1 étape obligatoires. Image facultative.
- Majuscule : la première lettre du titre d'une recette, du nom d'une catégorie, d'un tag, d'un ingrédient et du titre d'une partie est mise en majuscule par le backend, à la création comme à la modification (`Texts.capitalizeFirstLetter`). Ce qui précède la première lettre (emoji, guillemet…) est sauté : « 🍰 tarte » devient « 🍰 Tarte ». Un nom qui commence par un chiffre reste tel quel (« 3 chocolats »). Les noms déjà en base ont été corrigés par la migration Java `V8__capitalize_names` (`back/src/main/java/db/migration/`), avec la même règle.
- Catégories multiples (10 au plus, chacune une fois). La première est la catégorie principale : elle figure dans l'URL, le bouton « Retour » et le lien « Plus de recettes ». Changer de catégorie principale change l'URL ; l'ancienne redirige en 301 vers la nouvelle.
- Parties facultatives (10 au plus) : avec plusieurs parties, chacune a un titre et au moins un ingrédient ou une étape ; la recette garde au moins 1 ingrédient et 1 étape au total. Les parties sont réécrites à chaque enregistrement (contraintes de position différées).
- Statut : publiée ou brouillon. Un brouillon n'est visible que dans le back-office.
- Recette à la une (`featured`) : une seule à la fois, uniquement sur une recette publiée. Cocher une recette décoche l'ancienne, dans la même transaction.
- Champs optionnels : portions, temps de préparation et de cuisson, difficulté, vidéo YouTube, durée d'une étape.
- Difficulté : de 1 à 5 par demi-points (1, 1,5 … 5), affichée en étoiles. Vérifiée par le formulaire, le service et une contrainte CHECK.
- Vidéo : l'admin colle un lien YouTube (`watch?v=`, `youtu.be`, `shorts`, `embed`, `live`), le backend n'en garde que l'identifiant. Sur le site, la photo de la recette tient lieu de lecteur : rien n'est chargé depuis YouTube avant le clic, puis le lecteur vient de `youtube-nocookie.com` (seule origine autorisée en `frame-src` par la CSP). Mentionné dans la politique de confidentialité.
- Ingrédients structurés (table dédiée + table de liaison), pas de texte ou HTML libre. Quantité et unité optionnelles, unité en texte libre. Unicité insensible à la casse et aux accents. Suppression bloquée si l'ingrédient est utilisé. Nombre de recettes d'un ingrédient : recettes distinctes, même s'il apparaît dans plusieurs parties.
- Total des ingrédients (page recette, JSON-LD) : calculé par le front (`pages/recipe/recipe-parts.ts`), quantités de même unité additionnées (casse ignorée), unités différentes juxtaposées (« 150 g + 1 c. à soupe »), puis ajusté aux portions choisies comme les quantités de chaque partie.
- Étapes en texte ou Markdown rendu côté Angular, jamais de HTML brut en base.
- Ordre des ingrédients et des étapes : glisser-déposer dans le back-office.
- Slug : généré depuis le titre, suffixe numérique en cas de doublon. Pas de timestamp.
- Suppression d'une recette : sa photo reste dans la galerie.
- Suppression d'une catégorie encore utilisée : bloquée tant qu'elle contient des recettes.
- Tags : facultatifs, 20 au plus par recette, triés par nom ; la première lettre passe en majuscule, comme les catégories. Un tag utilisé peut être supprimé (retiré de ses recettes).
- Recherches sans résultat : notées par `GET /api/recipes` quand une recherche `q` ne trouve rien en première page ; le même texte compte une fois par minute (le navigateur rejoue la requête d'une page rendue par le serveur, pour la lecture hors connexion).
- Réseaux sociaux : plateforme en liste fixe (YouTube, TikTok, Instagram, Facebook, X, Threads, Reddit, WhatsApp, Pinterest), une fois chacune au plus. Ajouter une plateforme : enum `SocialPlatform`, contrainte CHECK (migration Flyway) et icône côté Angular.

### Sauvegarde

- Bouton « Sauvegarder mes données » (`/api/admin/backup`) : télécharge dans le navigateur une archive ZIP contenant le dump PostgreSQL (`pg_dump`, format custom) et une copie de tout le bucket S3 (toutes les images, orphelines comprises).
- Archive streamée : rien n'est stocké sur le serveur. Google Drive hors v1. Contenu : `database.dump` et `images/{clé S3}`. Une erreur survenue pendant le téléchargement coupe la connexion (téléchargement marqué en échec par le navigateur) et est journalisée.
- Le backend embarque le client `pg_dump` en version 18, identique au serveur.
- Contenu : `manifest.json` (date, version du site ; absent des sauvegardes d'avant la 2.1.0), `database.dump`, `images/{clé S3}`.
- Restauration depuis le back-office (`backup/RestoreService.java`) :
  - L'archive est gardée dans un dossier temporaire du conteneur backend (`/tmp/yona-restore-*`), 20 Go au plus, espace libre vérifié (2,2 fois sa taille). Abandonnée au bout d'une heure sans activité ; nettoyage toutes les 10 minutes.
  - Analyse : `pg_restore` charge le dump dans une base temporaire `yona_restore_…`, propriété d'un rôle créé pour l'occasion, sans droits d'administration (le SQL d'un fichier envoyé ne s'exécute jamais avec les droits du site) ; Flyway l'amène au schéma actuel (une sauvegarde plus ancienne est mise à niveau, une plus récente refusée) ; mêmes tables et colonnes que le site exigées, aucune vue, fonction, trigger ou règle.
  - Fusion : ce qui manque est ajouté, rien n'est modifié. Reconnus par leur adresse (slug) pour les recettes, catégories et tags, leur nom pour les ingrédients, tags et préréglages, leur plateforme pour les réseaux sociaux, leur identifiant pour les photos. Les fichiers absents du stockage sont envoyés d'abord, puis la base en une transaction ; une photo n'est ajoutée que si ses deux fichiers sont là. Une recette ajoutée n'est jamais mise à la une si le site en a déjà une.
  - Remplacement : fichiers manquants ou différents envoyés, puis toutes les tables (sauf l'historique Flyway) vidées et remplies par `COPY` depuis la base temporaire, en une transaction, séquences recalées ; enfin les fichiers absents de l'archive sont supprimés du stockage.
  - Le rôle PostgreSQL du site doit pouvoir créer des rôles et des bases : c'est le cas de l'utilisateur de l'image `postgres` (superutilisateur), en local comme sur Coolify.
- Procédure manuelle (base et S3), en secours : [docs/restauration.md](docs/restauration.md), testée sur la stack locale.

### Affichage et SEO

- URL des recettes SEO friendly : `/recettes/{slug-categorie-principale}/{slug-recette}`. JSON-LD : `recipeCategory` liste toutes les catégories, `recipeInstructions` en `HowToSection` (une par partie) pour une recette en parties.
- Clic sur une catégorie : la page recettes s'ouvre pré-filtrée (`/recettes?categorie={slug}`).
- Recette sans image : visuel par défaut côté Angular.
- Accueil : JSON-LD `Person` pour l'auteur, pour compenser l'absence de page à propos dédiée.
- Texte alternatif des images : titre de la recette. Meta description : extrait de l'intro.
- Pages d'erreur : 404 pour les URL inconnues, recettes introuvables ou en brouillon, et page d'erreur serveur.

## Images

- Upload passé par le backend. Une image principale par recette et une par catégorie, facultatives. Une même image peut servir à plusieurs recettes et catégories.
- Sur la recette et sur la catégorie : « Nouvelle photo » (envoi), « Choisir dans la galerie » ou « Retirer » (visuel par défaut). L'ancienne photo n'est jamais supprimée : elle reste dans la galerie, marquée « Non utilisée » si plus rien ne l'affiche.
- Cohérence base / S3 : S3 n'a pas de transaction, ses fichiers suivent donc l'issue de la transaction PostgreSQL. Un upload est effacé si la transaction échoue, une image supprimée perd ses fichiers une fois la suppression validée. Au pire il reste des fichiers orphelins, jamais un enregistrement sans fichier. La sauvegarde inclut les orphelins.
- Suppression d'une recette ou d'une catégorie : sa photo reste dans la galerie.
- Galerie back-office : toutes les images, avec les recettes et catégories qui les affichent, filtrables (utilisées ou non, type d'envoi). Seule la galerie supprime une image (enregistrement et fichiers S3) : les recettes et catégories qui l'affichaient passent au visuel par défaut, après confirmation.
- Accès : bucket S3 privé, images servies par le backend avec cache HTTP. Seul le backend accède au bucket.
- Formats : JPEG et PNG, vérifiés sur le contenu réel (magic bytes) et non sur l'extension. HEIC non accepté en v1.
- Taille max à l'upload : 10 Mo, et 100 mégapixels au plus, lus dans l'en-tête avant tout décodage, pour bloquer les images piégées. Les grandes photos sont décodées en sous-échantillonnant (au moins deux fois la plus grande sortie), pour limiter la mémoire.
- Paysage : largeur minimale 1200 px, hauteur minimale 800 px, ratio largeur/hauteur d'au moins 4:3. Seule exception, la photo Pinterest d'une recette : verticale, 1000 × 1333 px au moins, hauteur au moins 4/3 de la largeur (2:3 conseillé).
- Traitement : suppression des métadonnées EXIF (dont la localisation GPS), rotation appliquée selon l'EXIF, pas d'agrandissement.
- Sorties WebP de 800 px et 1600 px de large, qualité 80. L'original JPEG ou PNG n'est pas conservé.
- En base : table `image` (type et préfixe S3). Chaque préfixe contient `800.webp` et `1600.webp`. `recipe.image_id`, `recipe.pinterest_image_id`, `category.image_id` et `site_content.about_image_id` pointent vers elle (`ON DELETE SET NULL`), sans contrainte d'unicité. Les identifiants S3 sont dans les variables d'environnement.

## Charte graphique

Ambiance pâtisserie chic, chaleureuse, lisible sur téléphone. Thème par défaut : « Pâtisserie chic » (version claire ci-dessous). Autres thèmes au choix dans le back-office : Terracotta, Pistache, Myrtille, Caramel, chacun avec sa version sombre.

| Rôle | Couleur | Hex |
| --- | --- | --- |
| Fond principal | Almond milk | `#FCF9F5` |
| Fond secondaire (surfaces, cards, footer) | Blush pale | `#F4E7E6` |
| Couleur principale (texte) | Dark cocoa | `#36221C` |
| Boutons et actions principales (liens, à la une) | Warm mocha | `#8C533E` |
| Accent secondaire (décor : anneau photo, icônes) | Dusty rose | `#D49A99` |

- Contrastes : texte sur fond ≈ 14:1, warm mocha sur almond milk ≈ 5,8:1 (AA). Le dusty rose (≈ 2,2:1) reste en décor, jamais pour du texte.
- Favicon et icônes de l'application : toque almond milk sur fond warm mocha.
- Polices par défaut : Fraunces pour les titres, Inter pour le texte. Au choix dans le back-office : titres en Fraunces, Playfair Display, Cormorant Garamond, Dancing Script ou Quicksand ; texte en Inter, Nunito, DM Sans, Source Sans 3 ou Lora. Toutes auto-hébergées, sans appel à Google Fonts, pour ne pas transmettre l'IP des visiteurs à Google.
- Arrondi des coins : 16 px par défaut, de 0 (coins carrés) à 999 px. Les petits éléments (boutons, puces) prennent le double, pour rester ronds par défaut.
- Header de recette : dégradé noir transparent, du bas vers le haut.

## Roadmap

- [x] devops : Docker Compose (PostgreSQL 18, SeaweedFS), `.env.example`
- [x] devops : Dockerfile du backend (avec client `pg_dump` 18), service `back` dans la Compose (profil `app`)
- [x] devops : Dockerfile du frontend, passerelle locale (Caddy) pour l'application complète
- [x] devops : Compose de production pour Coolify (`devops/compose.prod.yaml`), passerelle en image autonome
- [x] devops : premier déploiement sur Coolify, déploiement automatique à chaque commit (webhook GitHub)
- [x] back : init Spring Boot 4 avec Maven (nettoyage des fichiers inutiles), migration Flyway V1, entités et repositories
- [x] back : service d'upload S3 (validation, resize, conversion)
- [x] back : auth Google avec allowlist `APP_ADMIN_EMAILS`, session
- [x] back : endpoints publics recettes et catégories
- [x] back : endpoint d'autocomplétion des titres
- [x] front : init Angular 22 (nettoyage des fichiers inutiles)
- [x] front : page d'accueil (recette à la une, à propos, 3 dernières recettes, catégories)
- [x] front : page recettes (filtre par catégorie, recherche)
- [x] front : navbar avec menu déroulant, menu mobile, footer, pages 404 et erreur serveur
- [x] front : page recette
- [x] front : pages mentions légales et politique de confidentialité
- [x] back : ProblemDetail et springdoc-openapi exposé
- [x] back : API admin (recettes, catégories, ingrédients, réseaux sociaux)
- [x] back : API admin galerie images et sauvegarde ZIP
- [x] front : back-office (guard, intercepteur HTTP, formulaires)
- [x] front : application installable (PWA), page « Installer l'application »
- [x] front : génération des services depuis le openapi du backend
- [x] front : Angular SSR, meta tags, JSON-LD
- [x] front : sitemap.xml
- [x] docs : procédure de restauration (dump PostgreSQL et S3)
- [x] sécurité : en-têtes du serveur SSR (CSP à nonce), documentation de l'API coupée en production, rotation des journaux
- [x] thèmes : 5 thèmes de couleurs clair et sombre, polices et arrondi choisis dans le back-office, choix Clair / Auto / Sombre du visiteur
- [x] réseaux sociaux : Facebook, X, Threads, Reddit, WhatsApp
- [x] back-office : galerie qui garde toutes les photos (filtre « Non utilisées », réutilisation), catégorie créée depuis la recette, ingrédients suggérés par usage, liste des recettes paginée
- [x] front : bouton « Retour » sur la page recette
- [x] versions du front et du backend affichées dans le back-office
- [x] recettes : difficulté en étoiles, vidéo YouTube, bouton « Partager » ; accueil limité aux 3 dernières recettes
- [x] recettes : parties facultatives (ingrédients et étapes par partie, total des ingrédients), catégories multiples, majuscule automatique (migration V4)
- [x] envoi de photos depuis la galerie (migration V5)
- [x] composant de modale commun, galerie paginée, progression des envois de photos, page Statistiques (stockage compris)
- [x] back-office : aperçu des recettes (brouillons compris), doublons d'ingrédients et fusion, suppressions groupées, filtres catégorie et ingrédient, miniatures, liens filtrés ; site : recherche par ingrédient, catégories en menu déroulant
- [x] 3.0.0 : tags (migration V7), filtres temps et difficulté, photo Pinterest et bouton « Épingler », favoris, liste de courses, mode cuisine, impression ; restauration d'une sauvegarde (fusion ou remplacement) ; statistiques (recettes à compléter, brouillons oubliés, recettes à rafraîchir, recherches sans résultat, export PDF) ; préréglages d'apparence, 5 thèmes et 5 polices de titres en plus ; photo « À propos » enregistrée avec le bouton ; infobulles à côté des icônes
- [x] 3.0.0 : majuscule aux ingrédients et aux noms commençant par un emoji (migration V8), « Effacer tous les filtres » sur la page Recettes
- [ ] Notifications de nouvelle recette (Web Push : accord du visiteur, clés VAPID, politique de confidentialité ; sur iPhone, application installée seulement)

## Points ouverts

- Vérification en ligne : connexion Google, upload d'une photo depuis l'iPhone, sauvegarde ZIP, restauration (d'abord une fusion avec une sauvegarde toute fraîche : rien à ajouter attendu).
- Après la mise en ligne : déclarer `https://les-creations-de-yona.fr/sitemap.xml` dans Google Search Console.
