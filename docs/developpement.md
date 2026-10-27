# Développement

Lancer le projet, le tester, son organisation et son API. Retour au [ReadMe](../ReadMe.md).

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
e2e/       parcours dans Chrome contre le site lancé en local, captures d'écran du ReadMe
docs/      documentation : fonctionnalités, développement, production, architecture, roadmap, restauration, services Google, changement de domaine ; captures/ (images du ReadMe)
ReadMe.md, CHANGELOG.md (aussi affiché dans le back-office, « Nouveautés »), LICENSE
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
./mvnw test              # tests unitaires (sans base ni Docker)
```

- Tests unitaires sans JDK sur la machine : `docker run --rm -v "$PWD:/build" -v yona-m2:/root/.m2 -w /build eclipse-temurin:25.0.4.1_1-jdk-resolute ./mvnw --batch-mode test` depuis `back/` (sous Git Bash, préfixer par `MSYS_NO_PATHCONV=1` et utiliser `$(pwd -W)`).

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
npm test               # tests unitaires (Vitest, dans Node.js avec jsdom), sans backend
npm run api:generate   # régénère le client API depuis http://localhost:8080/api/docs
npm run fonts:generate # régénère src/styles/_fonts.scss après une mise à jour d'un paquet @fontsource-variable
```

- Client API généré par `ng-openapi-gen` dans `src/app/core/api/generated` (versionné, ne pas modifier à la main). À régénérer après chaque changement d'API du backend.
- Budgets de build (`angular.json`) : bundle initial 800 Ko (avertissement), styles d'un composant 8 Ko.
- Icônes : composant maison `<svg yonaIcon="heart" [size]="18">` (`shared/ui/icon/`), dessiné en SVG inline depuis `icons.ts`, qui ne contient que les icônes utilisées (tracés Lucide, licence ISC). Remplace `@lucide/angular` (3.1.0) : bundle initial ramené de 730 à 505 Ko de JavaScript brut (`main` de 448 à 223 Ko), nouvelles fonctionnalités comprises, soit moins de code à analyser au premier chargement sur téléphone ; le poids transféré, déjà bien compressé, change peu (135 → 133 Ko). Ajouter une icône : copier ses formes depuis lucide.dev dans `icons.ts`, sous son nom.
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
  - `/sitemap.xml` (`src/server/sitemap.ts`) : construit à chaque demande depuis l'API (accueil, recettes, catégories ayant au moins une recette, toutes les recettes publiées, installation, glossaire s'il a des mots, pages légales), en cache une heure. URL sur le domaine de production.
  - `public/robots.txt` : API exclue sauf les photos, lien vers le sitemap. `/admin` n'y figure pas exprès : ses pages répondent `X-Robots-Tag: noindex, nofollow`, que les robots doivent pouvoir lire.
- Notifications (Web Push) : `core/pwa/new-recipe-notifications.ts` (`SwPush` d'Angular, clé publique lue sur `/api/notifications/public-key`), bouton `shared/ui/notify-button`. La notification reçue est affichée par le service worker d'Angular (champ `notification` du message), un appui ouvre la recette (`onActionClick`, `navigateLastFocusedOrOpen`). Sans service worker (`npm start`), le bouton n'apparaît pas.
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

### Parcours dans Chrome (e2e)

Avant une mise en ligne, le site lancé en local (`docker compose --profile app up -d --build --wait`), dans `e2e/` :

```bash
npm ci
npm test               # 56 vérifications dans Chrome (environ 3 min), captures d'écran dans e2e/resultats/
npm run captures       # refait les images du ReadMe (docs/captures/) avec les données de la base locale
```

- Captures avec de vraies recettes : celles du site en ligne (pages publiques seulement, rien n'y est écrit, cookies refusés), `BASE_URL=https://les-creations-de-yona.fr RECIPE=<slug> ONLY=telephone-recette,telephone-mode-cuisine npm run captures`. `ONLY` : les captures à refaire (toutes par défaut) ; `RECIPE` : la recette montrée. Les captures 3.5 (recette, ingrédients, mode cuisine, liste de courses, thème sombre) viennent du site en ligne ; la page d'installation, de la pile locale (nouveau bouton).

- Le Chrome installé sur la machine, sans fenêtre (`HEADED=1` pour la voir, `CHROME_CHANNEL=msedge` pour Edge) ; aucun navigateur à télécharger (`playwright-core`). Autre adresse : `BASE_URL`.
- Aucune donnée à préparer : il choisit une recette publiée avec des ingrédients et une étape minutée, et le premier menu publié (sans menu, la partie « Menus » échoue en le disant). Les minuteurs se vérifient avec une horloge simulée (un quart d'heure en une seconde).
- Couvre : accueil, recherche à plusieurs ingrédients, notes, mode cuisine (mise en place, minuteurs, « + 1 min », minuteur libre), minuteurs gardés sur les autres pages et retrouvés après un rechargement, liste de courses par rayon, menus (« Tout ajouter »), bandeau d'installation, « Nouveautés » et rayons du back-office, et les réponses de l'API (400 pour une adresse mal encodée).
- Accessibilité : chaque page publique passée à [axe](https://github.com/dequelabs/axe-core) (WCAG 2.1 A et AA, bonnes pratiques), aucun écart toléré ; le détail de chaque problème trouvé est écrit (règle, élément).
- Vitesse et qualité : [Lighthouse](https://developer.chrome.com/docs/lighthouse) sur l'accueil, une recette et un menu, en téléphone simulé (4G lente) ; seuils dans `parcours.mjs` (`LIGHTHOUSE_MIN`) : performance 70, accessibilité 100, bonnes pratiques 95, SEO 100. La performance varie de quelques points d'une mesure à l'autre (78 à 90 en 3.4) : le seuil ne signale que les vraies régressions. Les réponses sont compressées par la passerelle (`encode zstd gzip` dans le Caddyfile), comme Cloudflare le fait en production : sans cela, la mesure locale serait faussée.
- Le back-office sans connexion Google : la réponse « qui est connecté ? » est simulée dans le navigateur, comme les rayons (choisis dans le back-office). Le service worker de l'application est bloqué, sauf sur l'accueil : il relaierait lui-même les appels à l'API, que le parcours ne pourrait plus simuler.

### API

| Accès | Routes |
| --- | --- |
| Public (GET) | `/api/recipes` (recherche, filtres `category`, `tag`, `ingredient` (nom exact, accents ignorés ; répété pour plusieurs ingrédients, tous exigés, 5 au plus, 100 caractères chacun), `maxMinutes` (1 à 1440, repos compris), `difficulty` (`EASY`, `MEDIUM`, `HARD`), pagination, tri par défaut `publishedAt,desc` ; une recherche `q` sans résultat est notée), `/api/ingredients` (ingrédients des recettes publiées), `/api/ingredients/aisles` (leurs rayons, ceux choisis, pour la liste de courses), `/api/menus` et `/api/menus/{slug}` (menus publiés, leurs recettes publiées), `/api/recipes/{slug}`, `/api/recipes/{slug}/related` (3 recettes proches), `/api/glossary`, `/api/notifications/public-key` (clé VAPID), `/api/featured-recipe`, `/api/recipe-suggestions?q=`, `/api/categories`, `/api/tags` (avec le nombre de recettes publiées), `/api/social-links`, `/api/site-content`, `/api/theme`, `/api/images/{imageId}/800.webp` et `/1600.webp` |
| Admin | `/api/admin/me`, `/api/admin/stats` (statistiques et stockage), `/api/admin/recipes` (tri `title`, `createdAt`, `updatedAt`, `publishedAt`, `viewCount`, et `id` en second), `POST /api/admin/recipes/preview` (aperçu sans enregistrement), `/api/admin/categories`, `/api/admin/ingredients`, `GET /api/admin/ingredients/similar`, `POST /api/admin/ingredients/merge`, `PUT /api/admin/ingredients/aisle` (rayon d'une sélection, ou aucun), `/api/admin/menus` (liste, création ; `GET`, `PUT`, `DELETE` sur `/{id}`), `DELETE` sur `/api/admin/recipes`, `/categories`, `/ingredients` et `/images` avec `?ids=` (suppression groupée, tout ou rien ; à la corbeille, sauf les ingrédients), `/api/admin/social-links`, `PUT /api/admin/recipes/{id}/image` et `PUT /api/admin/categories/{id}/image` (nouvelle photo, multipart, champ `file`), `PUT …/{id}/image-choice` (photo de la galerie, ou `null` pour la retirer), `/api/admin/images` (galerie, filtres `kind`, `portrait` et `used` ; `POST` multipart pour y ajouter une photo), `PUT /api/admin/recipes/{id}/pinterest-image` et `…/pinterest-image-choice` (photo verticale), `/api/admin/tags` (`DELETE` avec `?ids=`), `PUT /api/admin/theme`, `/api/admin/appearance-presets`, `/api/admin/site-content`, `DELETE /api/admin/search-misses` (`?term=`, ou toutes), `/api/admin/version` (version du backend), `/api/admin/backup`, `/api/admin/restore` (`POST` pour commencer, `PUT …/{id}/chunks/{index}` en `application/octet-stream`, `GET …/{id}` pour l'état, `POST …/{id}/apply` avec `MERGE` ou `REPLACE` + `REMPLACER`, `DELETE …/{id}`), `POST /api/admin/recipes/{id}/duplicate`, `/api/admin/trash` (recettes, catégories, menus et photos : `GET`, `DELETE` pour vider, `POST …/{id}/restore`, `DELETE …/{id}`, `GET …/{id}/image` pour la miniature d'une photo à la corbeille), `/api/admin/glossary` (`POST`, `PUT …/{id}`, `DELETE` avec `?ids=`), `/api/admin/drive` (`GET` l'état, `POST …/backup` maintenant, `DELETE` pour déconnecter ; `GET …/connect` et `…/callback` ouverts par le navigateur, hors OpenAPI) |
| Public (écriture) | `POST /api/recipes/{slug}/views` (une vue, 204 ; sans jeton CSRF ; ignoré pour un brouillon, une adresse inconnue ou un admin connecté), `POST /api/notifications/subscriptions` (corps de `PushSubscription.toJSON()`), `DELETE /api/notifications/subscriptions?endpoint=` : sans jeton CSRF (les visiteurs n'en ont pas), seuls les services de notification des navigateurs acceptés (Google, Mozilla, Apple, Microsoft), 20 000 abonnements au plus |
| Auth | Connexion : `/api/oauth2/authorization/google`. Déconnexion : `POST /api/auth/logout` |

- Erreurs : ProblemDetail avec `code` stable (`ErrorCode`) et `detail` en français. Erreurs de validation listées dans `errors` (`field`, `message`).
- Écritures admin : en-tête `X-XSRF-TOKEN` recopié du cookie `XSRF-TOKEN`, que `GET /api/admin/me` crée. Angular le fait automatiquement. Aucun cookie n'est posé pour un visiteur public.
- Images : le front construit l'URL à partir du `imageId` des recettes et catégories. Réponse `Cache-Control: public, max-age=31536000, immutable` : une nouvelle photo a un nouvel identifiant, donc une nouvelle URL.
- Sauvegarde : à ouvrir comme un lien classique (`<a href="/api/admin/backup">`), pas via `HttpClient`, qui chargerait toute l'archive en mémoire. Restauration : morceaux envoyés par `XMLHttpRequest` (progression), comme les photos (`core/api/image-uploads.ts`).
- Toute route non listée est refusée.
