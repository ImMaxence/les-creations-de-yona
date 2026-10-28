# Production

Mise en ligne sur Coolify et services Google. Retour au [ReadMe](../ReadMe.md).

## Production (Coolify)

Fichier : `devops/compose.prod.yaml`. Mêmes services qu'en local, sans port publié ni profil. Seule la passerelle reçoit le domaine. Chaîne d'une requête : Cloudflare → Traefik (proxy de Coolify, HTTPS) → passerelle Caddy → front ou backend.

- URL publique : Traefik transmet `X-Forwarded-Proto: https` et le domaine. Caddy les conserve (`trusted_proxies`), le backend les lit (`forward-headers-strategy: framework`) pour construire l'URL de retour Google, et le serveur SSR (`NG_TRUST_PROXY_HEADERS`). Vérifié en simulant Traefik devant la stack de production : URL de retour `https://les-creations-de-yona.fr/api/login/oauth2/code/google`, domaine inconnu refusé (400).
- Secrets : identifiants PostgreSQL et S3 générés par Coolify au premier déploiement (`SERVICE_USER_*`, `SERVICE_PASSWORD_64_*`), conservés ensuite. À saisir : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_ADMIN_EMAILS` ; facultatif, `GEMINI_API_KEY` (« Remplir avec l'IA », [ia.md](ia.md)). Ne jamais définir `API_DOCS_ENABLED`. Facultatif : `PUSH_SUBJECT` (contact donné aux services de notification, `https://les-creations-de-yona.fr` par défaut). Les clés des notifications (VAPID) sont créées par le backend au premier démarrage, en base (`web_push_key`) : rien à saisir.
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

## Réseaux d'entreprise

Retour de la 3.6 : depuis certains réseaux d'entreprise, « tunnel connection failed », erreurs de cache, « 504 Gateway Timeout » sur les recettes et le back-office. Ces erreurs viennent du proxy de l'entreprise, entre le poste et Cloudflare, pas du site : `ERR_TUNNEL_CONNECTION_FAILED` veut dire que le proxy a refusé d'ouvrir la connexion HTTPS vers le domaine, et un 504 qu'il a abandonné avant la réponse.

Ce que le site fait depuis la 3.7 :

- Les pages répondent `Cache-Control: private, no-cache` : un proxy ne les garde plus (une page périmée resservie par lui pouvait ne plus correspondre aux fichiers du site), le navigateur les redemande à chaque fois.
- Une fois le site visité (ou l'application installée), les pages s'ouvrent depuis l'appareil, sans attendre le réseau, et les données attendent 3 secondes au plus avant de passer à celles déjà gardées : un proxy qui bloque ou répond « Forbidden » ne bloque plus que les nouveautés.

Ce que le code ne peut pas régler, et qui se fait une fois, en ligne :

1. **Catégorie du domaine** : les filtres d'entreprise bloquent ou ralentissent souvent les domaines récents ou « non classés ». Demander le classement en « Food / Recipes » (« Cuisine », « Gastronomie ») chez les principaux éditeurs, gratuitement : Zscaler (https://sitereview.zscaler.com), Palo Alto Networks (https://urlfiltering.paloaltonetworks.com), Fortinet (https://www.fortiguard.com/webfilter), Cisco Talos (https://talosintelligence.com/reputation_center), Broadcom/Symantec (https://sitereview.bluecoat.com), Forcepoint (https://csi.forcepoint.com), Check Point (https://www.checkpoint.com/urlcat). Une réponse arrive en général en quelques jours. Si le service informatique d'une entreprise est connu, lui demander quel produit bloque : c'est le seul à classer en priorité.
2. **Cloudflare, Security → Events** : repérer la règle qui bloque ou met en défi le visiteur (colonne « Action » : *block*, *managed challenge*, *JS challenge*). **Bot Fight Mode** et le **Security Level** sont la protection anti-robots du site : elle sert à arrêter les bots, et elle peut aussi gêner un visiteur réel, car beaucoup de personnes derrière une même adresse d'entreprise y ressemblent à un robot. Ne pas la désactiver avant d'avoir identifié la règle en cause. Pour vérifier, un navigateur ordinaire suffit : un script ou `curl` sont des signatures de robot, et un refus de leur part ne dit rien du réseau d'un visiteur.
3. Le back-office passe par la connexion Google : certains réseaux bloquent `accounts.google.com` hors des comptes de l'entreprise. Rien à faire côté site.

## Google Search Console

Les rapports « Données structurées : Recettes » sont des suggestions (non critiques). Depuis la 3.7, chaque étape a un nom (sa première phrase), son adresse (`#etape-2`, `#partie-1-etape-2`, ancre de la page) et une image (la photo de la recette), et les temps de préparation et de cuisson sont donnés dès que l'un des temps est rempli (un temps vide compte pour 0). Une recette sans aucun temps reste signalée : la remplir (Statistiques, « Recettes à compléter », « temps »). Après la mise en ligne, **Valider la correction** dans chaque rapport pour que Google repasse sur les pages.

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
