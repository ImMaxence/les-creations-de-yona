# Les créations de Yona

Blog de cuisine : recettes, catégories, recherche. Projet monorepo.

Dernière mise à jour : 2026-10-21.

## Périmètre v1

### Pages publiques

- Accueil (`/`) :
  - Recette à la une : grande card en haut (image, titre, catégorie). Champ `featured`, une seule à la fois ; si aucune, la plus récente publiée.
  - À propos : présentation de l'auteur, texte court, photo en dur dans le projet Angular.
  - Les 6 dernières recettes, toutes catégories confondues, bouton « Voir plus » vers `/recettes`.
  - Toutes les catégories, avec image, cliquables vers `/recettes?categorie={slug}`.
- Recettes (`/recettes`) :
  - Grille de cards de même taille : image, date de création, titre (tronqué avec ellipsis), catégorie.
  - Filtre par catégorie, barre de recherche avec autocomplétion sur le titre.
  - Pagination numérotée, nombre d'éléments par page au choix.
- Recette (`/recettes/{slug-categorie}/{slug-recette}`) :
  - Header : image pleine largeur, titre et catégorie superposés sur un dégradé noir qui part du bas de l'image.
  - Ingrédients, étapes, date de dernière mise à jour.
- Erreurs : 404 (URL inconnue, recette introuvable ou en brouillon) et erreur serveur.
- Installer l'application (`/installer`) : bouton d'installation quand le navigateur le propose, guide pas à pas pour iPhone/iPad, Android et ordinateur.

### Application installable (PWA)

- Le site s'installe comme une application (écran d'accueil du téléphone, ordinateur), sans store : plein écran, icône dédiée.
- Les pages et recettes déjà consultées restent lisibles hors connexion.

### Navigation

- Navbar : accueil, recettes, catégories en menu déroulant (environ 10 au maximum), installer l'application, administration (admins seulement).
- Menu mobile : bouton hamburger, panneau plein écran avec les mêmes entrées.
- Footer sur toutes les pages : réseaux sociaux, mentions légales, politique de confidentialité, lien discret « Espace admin ».

### Back-office (`/admin`)

- Accès réservé à 2 admins via Google, pas de création de compte.
- Entrée : lien « Espace admin » du footer, visible de tous (l'application installée n'a pas de barre d'adresse pour taper `/admin`). Un visiteur qui le suit arrive sur la connexion Google, puis sur la page d'accès refusé. Pages jamais indexées.
- Recettes : création, modification, publication ou brouillon, suppression.
- Catégories, ingrédients (modifier, supprimer), réseaux sociaux.
- Galerie : toutes les images, filtrables par type (recette ou catégorie), avec suppression.
- Sauvegarde : bouton « Sauvegarder mes données », qui télécharge une archive ZIP (base PostgreSQL et tout le bucket S3).

### Pages légales

- Mentions légales (`/mentions-legales`) et politique de confidentialité (`/politique-de-confidentialite`), liées depuis le footer.
- Éditeur et directeur de la publication : Maxence Bonnici, à titre non professionnel (adresse communiquée sur demande, art. 6, III, 2 LCEN). Hébergement : auto-hébergé à Aix-en-Provence, derrière Cloudflare. Contact et texte dans `front/src/app/pages/legal/`.

### SEO

- Angular SSR, balises meta par page, données structurées Recipe (JSON-LD), sitemap.xml, robots.txt.

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
```

- Client API généré par `ng-openapi-gen` dans `src/app/core/api/generated` (versionné, ne pas modifier à la main). À régénérer après chaque changement d'API du backend.
- Serveur SSR de production : `npm run serve:ssr` (port `PORT`, 4000 par défaut). Variables :
  - `API_URL` : URL interne du backend (ex. `http://back:8080`). Le serveur SSR l'appelle directement, sans repasser par Cloudflare. Sans elle, il appelle l'origine publique du site.
  - `NG_ALLOWED_HOSTS` : hôtes acceptés en plus de `les-creations-de-yona.fr` (protection SSRF d'Angular), ex. `localhost` pour un test local.
  - `NG_TRUST_PROXY_HEADERS` : en-têtes du proxy à prendre en compte (`x-forwarded-host,x-forwarded-proto,x-forwarded-for`), seulement si le serveur n'est joignable qu'à travers ce proxy.
- Cache HTTP : fichiers hashés (JS, CSS, polices) un an `immutable` ; fichiers de `public/` (favicon, photo de l'auteur, `robots.txt`) un jour, car leur nom ne change pas ; fichiers du service worker (`ngsw.json`, `ngsw-worker.js`, manifeste) jamais en cache, pour que les applications installées reçoivent les mises à jour.
- En-têtes de sécurité (`src/server/security-headers.ts`), posés par le serveur de production sur toutes ses réponses (pas par `npm start`, dont les scripts seraient bloqués) :
  - CSP : scripts du site uniquement. Les scripts inline du build (contrat d'event replay) sont autorisés par leur hash, calculé au démarrage depuis les fichiers HTML construits ; celui qu'Angular écrit au rendu par un nonce aléatoire propre à chaque réponse (`REQUEST_CONTEXT`, puis `CSP_NONCE`). Styles inline autorisés (styles de composants Angular). Aucune intégration dans une iframe (`frame-ancestors 'none'`).
  - Inlining du CSS critique désactivé (`angular.json`) : son script de chargement ne peut pas recevoir le nonce. Coût faible, la feuille de style globale fait moins de 10 Ko.
  - HSTS (un an, sans sous-domaines), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (caméra, micro, géolocalisation, paiement coupés ; le maintien de l'écran allumé reste permis), `Cross-Origin-Opener-Policy`. `X-Powered-By` retiré.
- Référencement :
  - `/sitemap.xml` (`src/server/sitemap.ts`) : construit à chaque demande depuis l'API (accueil, recettes, catégories ayant au moins une recette, toutes les recettes publiées, installation, pages légales), en cache une heure. URL sur le domaine de production.
  - `public/robots.txt` : API exclue sauf les photos, lien vers le sitemap. `/admin` n'y figure pas exprès : ses pages répondent `X-Robots-Tag: noindex, nofollow`, que les robots doivent pouvoir lire.
- Application installable (PWA) : service worker Angular (`ngsw-config.json`), actif seulement dans le build de production. Pour le tester en local : `npm run build`, puis `npm run serve:ssr` ou l'application complète dans Docker. Icônes dans `public/icons/`, manifeste dans `public/manifest.webmanifest`.
  - Pages : toujours demandées au serveur (rendu SSR à jour), version hors ligne en secours.
  - API publique (`/api/recipes`, catégories, réseaux sociaux) : réseau d'abord, cache de 30 jours si le réseau ne répond pas en 4 secondes.
  - Images : servies depuis le cache (leur URL change à chaque nouvelle photo), 30 jours.
  - `/api/admin/**` et la connexion Google ne passent jamais par le cache.
  - Une page rendue par le serveur reçoit ses données dans le HTML, sans appel à l'API : ces requêtes sont rejouées une fois en arrière-plan après le chargement (`core/pwa/offline-warmup.ts`), pour que la page soit aussi lisible hors connexion.

Image Docker (`front/Dockerfile`) : build Node 24 multi-étapes, image finale sans `node_modules` (le serveur SSR embarque ses dépendances), utilisateur non root, health check sur `/healthz` (répond sans rendu Angular).

Organisation de `front/src` :

```
app/core/      services globaux, layout (header, menus, footer), client API généré
app/shared/    composants d'interface (bouton, carte de recette, image), directive de reveal, utilitaires
app/pages/     une page par route, chargée à la demande
styles/        variables (couleurs, polices, breakpoints), reset, base typographique, animations
server/        middlewares du serveur SSR Express (en-têtes de sécurité, sitemap) ; point d'entrée : server.ts
```

### API

| Accès | Routes |
| --- | --- |
| Public (GET) | `/api/recipes` (recherche, filtre `category`, pagination), `/api/recipes/{slug}`, `/api/featured-recipe`, `/api/recipe-suggestions?q=`, `/api/categories`, `/api/social-links`, `/api/images/{imageId}/800.webp` et `/1600.webp` |
| Admin | `/api/admin/me`, `/api/admin/recipes`, `/api/admin/categories`, `/api/admin/ingredients`, `/api/admin/social-links`, `PUT /api/admin/recipes/{id}/image` et `PUT /api/admin/categories/{id}/image` (multipart, champ `file`), `/api/admin/images` (galerie, filtre `kind`), `/api/admin/backup` |
| Auth | Connexion : `/api/oauth2/authorization/google`. Déconnexion : `POST /api/auth/logout` |

- Erreurs : ProblemDetail avec `code` stable (`ErrorCode`) et `detail` en français. Erreurs de validation listées dans `errors` (`field`, `message`).
- Écritures admin : en-tête `X-XSRF-TOKEN` recopié du cookie `XSRF-TOKEN`, que `GET /api/admin/me` crée. Angular le fait automatiquement. Aucun cookie n'est posé pour un visiteur public.
- Images : le front construit l'URL à partir du `imageId` des recettes et catégories. Réponse `Cache-Control: public, max-age=31536000, immutable` : une nouvelle photo a un nouvel identifiant, donc une nouvelle URL.
- Sauvegarde : à ouvrir comme un lien classique (`<a href="/api/admin/backup">`), pas via `HttpClient`, qui chargerait toute l'archive en mémoire.
- Toute route non listée est refusée.

## Production (Coolify)

Fichier : `devops/compose.prod.yaml`. Mêmes services qu'en local, sans port publié ni profil. Seule la passerelle reçoit le domaine. Chaîne d'une requête : Cloudflare → Traefik (proxy de Coolify, HTTPS) → passerelle Caddy → front ou backend.

- URL publique : Traefik transmet `X-Forwarded-Proto: https` et le domaine. Caddy les conserve (`trusted_proxies`), le backend les lit (`forward-headers-strategy: framework`) pour construire l'URL de retour Google, et le serveur SSR (`NG_TRUST_PROXY_HEADERS`). Vérifié en simulant Traefik devant la stack de production : URL de retour `https://les-creations-de-yona.fr/api/login/oauth2/code/google`, domaine inconnu refusé (400).
- Secrets : identifiants PostgreSQL et S3 générés par Coolify au premier déploiement (`SERVICE_USER_*`, `SERVICE_PASSWORD_64_*`), conservés ensuite. À saisir : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_ADMIN_EMAILS`. Ne jamais définir `API_DOCS_ENABLED`.
- Données : volumes `postgres-data` et `seaweedfs-data`, conservés d'un déploiement à l'autre. Supprimer la ressource Coolify les supprime : faire une sauvegarde avant.

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

## Modèle de données

- `social_link` : platform (liste fixe : YouTube, TikTok, Instagram, extensible), url, position. Éditable depuis le back-office.
- `image` : kind (recipe ou category), s3_prefix (`recipes/{uuid}/` ou `categories/{uuid}/`), created_at. Filtrable par type dans la galerie.
- `category` : name, slug (unique), image_id (facultatif, vers `image`).
- `recipe` : title, slug (unique), intro, status (publiée ou brouillon), category_id, servings, prep_minutes, cook_minutes, image_id (facultatif, vers `image`), featured (booléen), created_at, updated_at (timestamptz, UTC), created_by, updated_by (email de l'admin, texte).
- `ingredient` : name (unique).
- `recipe_ingredient` : recipe_id, ingredient_id, quantity, unit, note, position. Clé primaire (recipe_id, ingredient_id).
- `recipe_step` : recipe_id, position, description, duration_minutes.

## Décisions

### Général

- Interface en français uniquement. Mobile first : conception pour écran de téléphone d'abord (environ 90 % du trafic), puis adaptation desktop.
- Noms de tables, colonnes et code en anglais.
- Pas de tests pour la v1, ni backend ni frontend. À l'init du back et du front, supprimer les fichiers générés inutiles (tests unitaires, configuration Prettier, etc.).
- Pas de commentaires sur le site, ni en v1 ni prévus.
- Logo et photo de l'auteur en dur dans le projet Angular. Couleurs dans `variables.scss`.
- Routage sur un domaine unique : site à la racine, API sous `/api`. Domaine `https://les-creations-de-yona.fr/`, déjà en place.
- Flyway Community (gratuit) plutôt que Liquibase : migrations SQL simples, base PostgreSQL unique.
- Erreurs API en ProblemDetail (RFC 9457) : format JSON standard (`type`, `title`, `status`, `detail`), identique pour toutes les erreurs. Ajout d'un code stable et d'un message en français, affichables en toast côté Angular.

### Frontend

- Angular 22 avec signals (`signal`, `computed`, `input()`, `output()`), composants standalone, sans NgModule.
- Styles en SCSS uniquement, sans Tailwind ni framework CSS. Variables (couleurs, espacements, polices) dans `variables.scss`.
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
- Styles : les composants lisent les propriétés CSS (`var(--color-accent)`) émises depuis `styles/_variables.scss`. Sass ne sert qu'aux breakpoints et mixins.
- Icônes de marque (Instagram, TikTok, YouTube) : Simple Icons (CC0), Lucide n'en fournissant pas.
- API indisponible : page d'erreur (HTTP 503) en conservant l'URL demandée. URL inconnue, recette introuvable ou en brouillon : page 404 avec un vrai statut 404. Segment catégorie erroné dans l'URL d'une recette : redirection 301 vers l'URL canonique.
- SEO déclaré par route (`data.seo`, statique ou calculé après les resolvers), appliqué à chaque navigation par une `TitleStrategy` : titre, description, Open Graph, URL canonique, `robots`, JSON-LD (`Person` sur l'accueil, `Recipe` sur une recette). Résultats de recherche et pages vides en `noindex`.
- Recherche : combobox ARIA (flèches, Entrée, Échap), suggestions dès 2 caractères, texte tapé mis en évidence sans tenir compte des accents. Filtres et pagination dans l'URL (`q`, `categorie`, `page`, `parPage`), donc partageables.
- Page recette pensée pour cuisiner avec un téléphone : portions ajustables (quantités recalculées puis arrondies à des valeurs mesurables), ingrédients et étapes à cocher, écran maintenu allumé (Screen Wake Lock, proposé seulement si le navigateur le permet).
- Étapes en Markdown rendues par `marked` (MIT), puis nettoyées par le sanitizer d'Angular.
- Back-office (`/admin`) : rendu dans le navigateur uniquement (la session est un cookie), chargé à la demande, protégé par un guard qui renvoie vers la connexion Google sans session. Formulaires en Signal Forms (`@angular/forms/signals`) avec les mêmes règles que l'API, ingrédients et étapes réordonnables par glisser-déposer (`@angular/cdk/drag-drop`, MIT) ou par boutons pour le clavier. Erreurs de l'API affichées en toast avec leur message, confirmation avant suppression, alerte avant de quitter une recette non enregistrée.
- Listes déroulantes : composant `yona-select` fait maison (pattern ARIA combobox), la liste native d'un `<select>` ne se stylant pas.

### Dates

- Stockage en UTC (`timestamptz` côté PostgreSQL, `Instant` côté Java). Affichage en heure de Paris (`Europe/Paris`) côté Angular, qui gère l'heure d'été et d'hiver.
- `updated_at` enregistré à chaque sauvegarde. `created_by` et `updated_by` renseignés depuis la session admin.

### Auth et sécurité

- Authentification Google OIDC. Allowlist des emails admin dans la variable d'environnement `APP_ADMIN_EMAILS`, sans table utilisateur. Email non autorisé : page d'accès refusé.
- Google OAuth : deux URL de retour, une pour le local et une pour la production.
- Session serveur (cookie HttpOnly, Secure, SameSite), expirée après 7 jours d'inactivité, plutôt que JWT. Sessions en mémoire, sans persistance : un redémarrage ou un redéploiement déconnecte l'admin, accepté. Bouton de déconnexion.
- Autorisation par règles d'URL dans Spring Security : `/api/admin/**` réservé aux admins.
- Pas de bouton de connexion sur le site public : l'admin passe par `/admin`, via le lien discret « Espace admin » du footer. Ce lien ne donne aucun droit : la protection est côté serveur (Google, liste des admins, rôle exigé sur `/api/admin/**`).
- Cookies : aucun cookie de suivi ni d'analyse. Cookies techniques seulement, dispensés de consentement : session admin et CSRF (posés uniquement à la connexion d'un admin), et éventuellement `__cf_bm` de Cloudflare. Donc pas de bandeau cookies ; le détail est dans la politique de confidentialité.

### Recherche et pagination

- Recherche par JPA Specifications sur titre et catégorie, insensible à la casse et aux accents (extension `unaccent`). Sécurisée contre l'injection SQL : valeurs passées en paramètres liés, jamais concaténées. Tri limité à une liste de champs autorisés, `%` et `_` saisis par l'utilisateur échappés.
- Autocomplétion des titres : endpoint dédié, 5 suggestions maximum.
- Pagination offset avec `Pageable`. L'accueil appelle la même route avec `size=6`.
- Recette recherchée par slug seul. Si le segment catégorie de l'URL ne correspond pas, redirection 301 vers l'URL canonique, gérée par Angular SSR qui interroge l'API par slug.

### Recettes

- Création : titre, catégorie, au moins 1 ingrédient et au moins 1 étape obligatoires. Image facultative.
- Statut : publiée ou brouillon. Un brouillon n'est visible que dans le back-office.
- Recette à la une (`featured`) : une seule à la fois, uniquement sur une recette publiée. Cocher une recette décoche l'ancienne, dans la même transaction.
- Champs optionnels : portions, temps de préparation et de cuisson, durée d'une étape.
- Ingrédients structurés (table dédiée + table de liaison), pas de texte ou HTML libre. Quantité et unité optionnelles, unité en texte libre. Unicité insensible à la casse et aux accents. Suppression bloquée si l'ingrédient est utilisé.
- Étapes en texte ou Markdown rendu côté Angular, jamais de HTML brut en base.
- Ordre des ingrédients et des étapes : glisser-déposer dans le back-office.
- Slug : généré depuis le titre, suffixe numérique en cas de doublon. Pas de timestamp.
- Suppression d'une recette : suppression de son préfixe S3.
- Suppression d'une catégorie encore utilisée : bloquée tant qu'elle contient des recettes.
- Réseaux sociaux : plateforme en liste fixe (YouTube, TikTok, Instagram), extensible si besoin.

### Sauvegarde

- Bouton « Sauvegarder mes données » (`/api/admin/backup`) : télécharge dans le navigateur une archive ZIP contenant le dump PostgreSQL (`pg_dump`, format custom) et une copie de tout le bucket S3 (toutes les images, orphelines comprises).
- Archive streamée : rien n'est stocké sur le serveur. Google Drive hors v1. Contenu : `database.dump` et `images/{clé S3}`. Une erreur survenue pendant le téléchargement coupe la connexion (téléchargement marqué en échec par le navigateur) et est journalisée.
- Le backend embarque le client `pg_dump` en version 18, identique au serveur.
- Procédure de restauration (base et S3) : [docs/restauration.md](docs/restauration.md), testée sur la stack locale.

### Affichage et SEO

- URL des recettes SEO friendly : `/recettes/{slug-categorie}/{slug-recette}`.
- Clic sur une catégorie : la page recettes s'ouvre pré-filtrée (`/recettes?categorie={slug}`).
- Recette sans image : visuel par défaut côté Angular.
- Accueil : JSON-LD `Person` pour l'auteur, pour compenser l'absence de page à propos dédiée.
- Texte alternatif des images : titre de la recette. Meta description : extrait de l'intro.
- Pages d'erreur : 404 pour les URL inconnues, recettes introuvables ou en brouillon, et page d'erreur serveur.

## Images

- Upload passé par le backend. Une image principale par recette et une par catégorie, facultatives.
- Bouton « Modifier la photo » sur la recette et sur la catégorie : remplace l'image directement, sans passer par la galerie. Envoi de la nouvelle image, puis suppression de l'ancienne une fois le remplacement enregistré : en cas d'échec, l'ancienne photo reste en place.
- Cohérence base / S3 : S3 n'a pas de transaction, ses fichiers suivent donc l'issue de la transaction PostgreSQL. Un upload est effacé si la transaction échoue, une image supprimée perd ses fichiers une fois la suppression validée. Au pire il reste des fichiers orphelins, jamais un enregistrement sans fichier. La sauvegarde inclut les orphelins.
- Suppression d'une recette ou d'une catégorie : son image (enregistrement et fichiers S3) est supprimée avec elle.
- Galerie back-office : toutes les images (recettes et catégories), avec suppression. Supprimer une image utilisée retire l'image de la recette ou de la catégorie (visuel par défaut), après confirmation.
- Accès : bucket S3 privé, images servies par le backend avec cache HTTP. Seul le backend accède au bucket.
- Formats : JPEG et PNG, vérifiés sur le contenu réel (magic bytes) et non sur l'extension. HEIC non accepté en v1.
- Taille max à l'upload : 10 Mo, et 100 mégapixels au plus, lus dans l'en-tête avant tout décodage, pour bloquer les images piégées. Les grandes photos sont décodées en sous-échantillonnant (au moins deux fois la plus grande sortie), pour limiter la mémoire.
- Paysage uniquement : largeur minimale 1200 px, hauteur minimale 800 px, ratio largeur/hauteur d'au moins 4:3.
- Traitement : suppression des métadonnées EXIF (dont la localisation GPS), rotation appliquée selon l'EXIF, pas d'agrandissement.
- Sorties WebP de 800 px et 1600 px de large, qualité 80. L'original JPEG ou PNG n'est pas conservé.
- En base : table `image` (type et préfixe S3). Chaque préfixe contient `800.webp` et `1600.webp`. `recipe.image_id` et `category.image_id` pointent vers elle. Une image est liée à une recette ou à une catégorie, jamais aux deux. Les identifiants S3 sont dans les variables d'environnement.

## Charte graphique

Ambiance cuisine chaleureuse, lisible sur téléphone.

| Rôle | Couleur | Hex |
| --- | --- | --- |
| Fond | Crème | `#FBF6EE` |
| Surfaces (cards, footer) | Beige sable | `#EFE4D2` |
| Texte | Brun espresso | `#2E2420` |
| Accent (boutons, liens, à la une) | Terracotta | `#B5532E` |
| Décor secondaire (catégories, badges) | Vert sauge | `#7D8F69` |

- Contrastes : texte sur fond ≈ 14:1, terracotta sur crème ≈ 4,6:1 (AA). Le vert sauge reste en décor, pas pour du texte.
- Titres : Fraunces (serif chaleureuse, Google Fonts, gratuite). Texte et interface : Inter (lisible sur mobile). Polices auto-hébergées dans le projet, sans appel à Google Fonts, pour ne pas transmettre l'IP des visiteurs à Google.
- Header de recette : dégradé noir transparent, du bas vers le haut.

## Roadmap

- [x] devops : Docker Compose (PostgreSQL 18, SeaweedFS), `.env.example`
- [x] devops : Dockerfile du backend (avec client `pg_dump` 18), service `back` dans la Compose (profil `app`)
- [x] devops : Dockerfile du frontend, passerelle locale (Caddy) pour l'application complète
- [x] devops : Compose de production pour Coolify (`devops/compose.prod.yaml`), passerelle en image autonome
- [ ] devops : premier déploiement sur Coolify, déploiement automatique à chaque commit (webhook GitHub)
- [x] back : init Spring Boot 4 avec Maven (nettoyage des fichiers inutiles), migration Flyway V1, entités et repositories
- [x] back : service d'upload S3 (validation, resize, conversion)
- [x] back : auth Google avec allowlist `APP_ADMIN_EMAILS`, session
- [x] back : endpoints publics recettes et catégories
- [x] back : endpoint d'autocomplétion des titres
- [x] front : init Angular 22 (nettoyage des fichiers inutiles)
- [x] front : page d'accueil (recette à la une, à propos, 6 dernières recettes, catégories)
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

## Points ouverts

- Premier déploiement Coolify (voir « Production (Coolify) ») et vérification en ligne : connexion Google, upload d'une photo, sauvegarde ZIP.
- Après la mise en ligne : déclarer `https://les-creations-de-yona.fr/sitemap.xml` dans Google Search Console.