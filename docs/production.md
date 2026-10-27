# Production

Mise en ligne sur Coolify et services Google. Retour au [ReadMe](../ReadMe.md).

## Production (Coolify)

Fichier : `devops/compose.prod.yaml`. Mêmes services qu'en local, sans port publié ni profil. Seule la passerelle reçoit le domaine. Chaîne d'une requête : Cloudflare → Traefik (proxy de Coolify, HTTPS) → passerelle Caddy → front ou backend.

- URL publique : Traefik transmet `X-Forwarded-Proto: https` et le domaine. Caddy les conserve (`trusted_proxies`), le backend les lit (`forward-headers-strategy: framework`) pour construire l'URL de retour Google, et le serveur SSR (`NG_TRUST_PROXY_HEADERS`). Vérifié en simulant Traefik devant la stack de production : URL de retour `https://les-creations-de-yona.fr/api/login/oauth2/code/google`, domaine inconnu refusé (400).
- Secrets : identifiants PostgreSQL et S3 générés par Coolify au premier déploiement (`SERVICE_USER_*`, `SERVICE_PASSWORD_64_*`), conservés ensuite. À saisir : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_ADMIN_EMAILS`. Ne jamais définir `API_DOCS_ENABLED`. Facultatif : `PUSH_SUBJECT` (contact donné aux services de notification, `https://les-creations-de-yona.fr` par défaut). Les clés des notifications (VAPID) sont créées par le backend au premier démarrage, en base (`web_push_key`) : rien à saisir.
- Données : volumes `postgres-data` et `seaweedfs-data`, conservés d'un déploiement à l'autre. Supprimer la ressource Coolify les supprime : faire une sauvegarde avant.
- Versions : `back/pom.xml` et `front/package.json`, en version sémantique (1.0.0), notées dans [CHANGELOG.md](../CHANGELOG.md), à monter ensemble à chaque mise en production : `npm version x.y.z --no-git-tag-version` dans `front/`, la balise `<version>` du `pom.xml` à la main (quel numéro choisir et quoi mettre à jour : [développement](developpement.md#monter-la-version)). Affichées en haut du back-office (« Site v… · API v… ») : la version du front est lue dans `package.json` au build, celle du backend dans `build-info.properties` (plugin Maven de Spring Boot), par `GET /api/admin/version`.
- Le CHANGELOG est lu par les admins dans le back-office (« Nouveautés ») : y décrire les changements en mots de tous les jours, la partie technique dans une section « Technique ». Image Docker du front : le fichier, à la racine du dépôt, hors du contexte `front/`, arrive par un second contexte de build (`additional_contexts: repo: ..` dans les deux fichiers Compose, `COPY --from=repo` dans `front/Dockerfile`) ; Docker Compose 2.17 au moins, et en dehors de Compose `docker build --build-context repo=.. front`.

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

Réglages pas à pas (projet Google Cloud, client OAuth, Google Drive, Analytics, Search Console) et problèmes courants : [docs/google.md](./google.md).

| Service | Rôle | Adresse |
| --- | --- | --- |
| Google Cloud Console, Identifiants | Client OAuth de la connexion admin : URI de retour et origines autorisées | https://console.cloud.google.com/apis/credentials |
| Google Cloud Console, Audience | Mode « Test » de l'application, adresses admin dans « Utilisateurs test » | https://console.cloud.google.com/auth/audience |
| Google Analytics 4 | Mesure d'audience, propriété `G-914Y0MV42H` (`front/src/app/core/analytics/analytics.ts`), après accord du visiteur | https://analytics.google.com/ |
| Google Search Console | Indexation, sitemap, recherches Google qui mènent au site | https://search.google.com/search-console |
| Google Drive API | Sauvegardes de chaque nuit (portée `drive.file` : le site ne voit que les fichiers qu'il crée) | https://console.cloud.google.com/apis/library/drive.googleapis.com |
| Test des résultats enrichis | Vérifier les données structurées Recipe (JSON-LD) d'une page | https://search.google.com/test/rich-results |

- Client OAuth : un seul client (`894227614182-d19k….apps.googleusercontent.com`) pour le local et la production. Ses URI de retour doivent contenir les 4 adresses listées dans `devops/.env.example`, à l'identique (`localhost` et `127.0.0.1` sont différents pour Google). Une adresse manquante donne `Erreur 400 : redirect_uri_mismatch` ; « Détails de l'erreur » sur la page de Google montre l'adresse envoyée. Une modification peut mettre quelques minutes à s'appliquer.
- Analytics : **Rapports → Temps réel** montre une visite dans la minute (site ouvert dans un autre navigateur, cookies acceptés, sans bloqueur de publicité). Les autres rapports arrivent en 24 à 48 h. **Administration → Flux de données → Mesure améliorée** : « Changements de page basés sur les événements de l'historique du navigateur » doit rester désactivé, sinon chaque page est comptée deux fois.
- Search Console : **Sitemaps** (`sitemap.xml` à l'état « Opération effectuée », nombre d'URL découvertes), **Inspection de l'URL** sur une recette (« Tester l'URL en ligne » : page indexable, recette détectée). Indexation en quelques jours à quelques semaines.

- Google Drive : un seul compte reçoit les sauvegardes pour tout le site, choisi par l'admin qui clique sur « Connecter Google Drive ». Mise en place (API Drive, URI de retour, portée `drive.file`, application « En production ») : [docs/google.md](./google.md#2-sauvegarde-de-nuit-sur-google-drive).
- Le jeton d'accès durable (refresh token) est gardé en base (`google_drive_link`), jamais dans les sauvegardes : il ne sert à rien sans le secret du client OAuth, qui n'est que dans l'environnement. Retiré chez Google à la déconnexion.
