# Production

Mise en ligne sur Coolify, services Google, restauration à la main d'une sauvegarde et changement de nom de domaine (ces deux procédures avaient chacune leur fichier avant la 2.4). Retour au [ReadMe](../ReadMe.md).

## Production (Coolify)

Fichier : `devops/compose.prod.yaml`. Mêmes services qu'en local, sans port publié ni profil. Seule la passerelle reçoit le domaine. Chaîne d'une requête : Cloudflare → Traefik (proxy de Coolify, HTTPS) → passerelle Caddy → front ou backend.

- URL publique : Traefik transmet `X-Forwarded-Proto: https` et le domaine. Caddy les conserve (`trusted_proxies`), le backend les lit (`forward-headers-strategy: framework`) pour construire l'URL de retour Google, et le serveur SSR (`NG_TRUST_PROXY_HEADERS`). Vérifié en simulant Traefik devant la stack de production : URL de retour `https://les-creations-de-yona.fr/api/login/oauth2/code/google`, domaine inconnu refusé (400).
- Secrets : identifiants PostgreSQL et S3 générés par Coolify au premier déploiement (`SERVICE_USER_*`, `SERVICE_PASSWORD_64_*`), conservés ensuite. À saisir : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_ADMIN_EMAILS`, `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` ([google.md](google.md#5-recaptcha)) ; facultatif, `GEMINI_API_KEY` (« Remplir avec l'IA », [ia.md](ia.md)). Ne jamais définir `API_DOCS_ENABLED`. Facultatif : `PUSH_SUBJECT` (contact donné aux services de notification, `https://les-creations-de-yona.fr` par défaut). Les clés des notifications (VAPID) sont créées par le backend au premier démarrage, en base (`web_push_key`) : rien à saisir.
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

Retour de la 1.6 : depuis certains réseaux d'entreprise, « tunnel connection failed », erreurs de cache, « 504 Gateway Timeout » sur les recettes et le back-office. Ces erreurs viennent du proxy de l'entreprise, entre le poste et Cloudflare, pas du site : `ERR_TUNNEL_CONNECTION_FAILED` veut dire que le proxy a refusé d'ouvrir la connexion HTTPS vers le domaine, et un 504 qu'il a abandonné avant la réponse.

Ce que le site fait depuis la 1.7 :

- Les pages répondent `Cache-Control: private, no-cache` : un proxy ne les garde plus (une page périmée resservie par lui pouvait ne plus correspondre aux fichiers du site), le navigateur les redemande à chaque fois.
- Une fois le site visité (ou l'application installée), les pages s'ouvrent depuis l'appareil, sans attendre le réseau, et les données attendent 3 secondes au plus avant de passer à celles déjà gardées : un proxy qui bloque ou répond « Forbidden » ne bloque plus que les nouveautés.

Ce que le code ne peut pas régler, et qui se fait une fois, en ligne :

1. **Catégorie du domaine** : les filtres d'entreprise bloquent ou ralentissent souvent les domaines récents ou « non classés ». Demander le classement en « Food / Recipes » (« Cuisine », « Gastronomie ») chez les principaux éditeurs, gratuitement : Zscaler (https://sitereview.zscaler.com), Palo Alto Networks (https://urlfiltering.paloaltonetworks.com), Fortinet (https://www.fortiguard.com/webfilter), Cisco Talos (https://talosintelligence.com/reputation_center), Broadcom/Symantec (https://sitereview.bluecoat.com), Forcepoint (https://csi.forcepoint.com), Check Point (https://www.checkpoint.com/urlcat). Une réponse arrive en général en quelques jours. Si le service informatique d'une entreprise est connu, lui demander quel produit bloque : c'est le seul à classer en priorité.
2. **Cloudflare, Security → Events** : repérer la règle qui bloque ou met en défi le visiteur (colonne « Action » : *block*, *managed challenge*, *JS challenge*). **Bot Fight Mode** et le **Security Level** sont la protection anti-robots du site : elle sert à arrêter les bots, et elle peut aussi gêner un visiteur réel, car beaucoup de personnes derrière une même adresse d'entreprise y ressemblent à un robot. Ne pas la désactiver avant d'avoir identifié la règle en cause. Pour vérifier, un navigateur ordinaire suffit : un script ou `curl` sont des signatures de robot, et un refus de leur part ne dit rien du réseau d'un visiteur.
3. Le back-office passe par la connexion Google : certains réseaux bloquent `accounts.google.com` hors des comptes de l'entreprise. Rien à faire côté site.

## Google Search Console

Les rapports « Données structurées : Recettes » sont des suggestions (non critiques). Depuis la 1.7, chaque étape a un nom (sa première phrase), son adresse (`#etape-2`, `#partie-1-etape-2`, ancre de la page) et une image (la photo de la recette), et les temps de préparation et de cuisson sont donnés dès que l'un des temps est rempli (un temps vide compte pour 0). Une recette sans aucun temps reste signalée : la remplir (Statistiques, « Recettes à compléter », « temps »). Après la mise en ligne, **Valider la correction** dans chaque rapport pour que Google repasse sur les pages.

## Assistants IA

Depuis la 1.16, le site est fait pour être cité par les assistants IA (ChatGPT, Perplexity, Gemini, Copilot, Claude) : ce que fait le code est dans [développement](developpement.md#référencement). Trois réglages restent hors du code.

1. **Cloudflare** : depuis 2025, Cloudflare peut bloquer les robots d'IA d'un domaine sans rien demander. Dans **Security → Bots** (ou **AI Crawl Control**, selon l'offre) :
   - « Block AI bots » : désactivé. Depuis la 1.18, tous les robots d'IA doivent passer, ceux de recherche (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Bingbot, Googlebot : sans eux, plus de citation) comme ceux d'entraînement (GPTBot, ClaudeBot, CCBot…) ; dans **AI Crawl Control**, chaque robot sur « Allow » ;
   - « Managed robots.txt » (ou « Instruct AI bot traffic with robots.txt ») : désactivé. Le site a son propre `robots.txt` ; Cloudflare ajouterait ses lignes au début ;
   - **Security → Events**, filtre « Bot » : aucune action *block* ou *challenge* contre ces robots. **Bot Fight Mode** laisse passer les robots vérifiés (« Verified bots »), dont ceux-ci.

   Cloudflare garde `robots.txt` en cache (une heure depuis la 1.18, un jour avant) : après l'avoir changé, **Caching → Configuration → Purge Cache**, « Custom Purge », l'adresse `https://les-creations-de-yona.fr/robots.txt`.

   Vérifier : `https://les-creations-de-yona.fr/robots.txt` doit être exactement `front/public/robots.txt`. Puis, depuis n'importe quel terminal, chaque robot doit recevoir 200 sur la page, `robots.txt`, `llms.txt`, `llms-full.txt`, le sitemap et une version Markdown :

   ```bash
   for bot in GPTBot OAI-SearchBot ChatGPT-User ClaudeBot Claude-SearchBot Claude-User PerplexityBot Google-Extended Googlebot Bingbot CCBot Applebot-Extended Meta-ExternalAgent; do
     printf '%-20s' "$bot"
     for path in / /robots.txt /llms.txt /llms-full.txt /sitemap.xml /index.md; do
       printf '%s ' "$(curl -s -o /dev/null -w '%{http_code}' -A "Mozilla/5.0 (compatible; $bot/1.0)" "https://les-creations-de-yona.fr$path")"
     done
     echo
   done
   ```

   Cela montre qu'aucune règle sur le nom du robot ne le bloque, pas plus : Cloudflare reconnaît les vrais robots à leurs adresses IP. Leurs vraies visites se voient dans **AI Crawl Control** (ou **Security → Events**, filtre « Bot »).
2. **Bing Webmaster Tools** (https://www.bing.com/webmasters) : ChatGPT Search et Copilot cherchent dans l'index de Bing. Ajouter le site (« Importer depuis Google Search Console » le fait en un geste), déclarer `https://les-creations-de-yona.fr/sitemap.xml`. Les recettes publiées y arrivent ensuite par IndexNow, sans attendre le passage du robot : **IndexNow** dans le menu liste les adresses reçues. La clé (`f5d890788ccc4557ecd282dea7299d26`) est dans `application.yaml` et dans `front/public/` : les deux doivent rester identiques.
3. **Google Analytics** : les visites venant des assistants sont comptées dans les statistiques du back-office. Pour les voir aussi dans Analytics : **Administration → Paramètres des données → Groupes de canaux**, copier le groupe par défaut, ajouter un canal « Assistants IA » (source correspondant à l'expression régulière `chatgpt|openai|perplexity|gemini|copilot|claude|mistral|deepseek|grok`) placé au-dessus de « Referral ».

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

## Restaurer une sauvegarde à la main

Depuis la version 2.1.0, le back-office restaure lui-même une archive (page Sauvegarde, « Restaurer une sauvegarde ») : fusion de ce qui manque, ou remplacement complet. C'est la voie normale ; voir [architecture.md](architecture.md) (« Sauvegarde »).

La procédure manuelle ci-dessous reste le secours quand le back-office n'est pas utilisable : backend qui ne démarre plus, connexion Google impossible, nouveau serveur encore vide d'admin. Elle remet le site dans l'état d'une archive téléchargée depuis le back-office (bouton « Sauvegarder mes données »), après une perte de données, une fausse manipulation ou pour remonter le site sur un nouveau serveur. Une archive de la 2.1.0 contient aussi un `manifest.json` (date et version), sans effet ici.

Testée le 2026-10-21 sur la stack locale : base remise à l'état de la sauvegarde, image supprimée restaurée, backend redémarré sans erreur (Flyway valide le schéma).

### Contenu de l'archive

| Fichier | Contenu |
| --- | --- |
| `database.dump` | Toute la base PostgreSQL (`pg_dump`, format custom), historique Flyway compris |
| `images/{clé S3}` | Tout le bucket S3, par exemple `images/recipes/{uuid}/800.webp` |

### Avant de commencer

- Un accès SSH au serveur (ou la machine locale), avec Docker.
- La stack déployée et démarrée : PostgreSQL et SeaweedFS tournent, le bucket existe (créé au démarrage de SeaweedFS). Sur un nouveau serveur, déployer d'abord le site, base vide comprise.
- Les admins devront se reconnecter : les sessions sont en mémoire.

Les commandes sont écrites pour un shell Linux (serveur, WSL ou Git Bash).

### 1. Déposer et décompresser l'archive

```bash
scp sauvegarde.zip serveur:~/                 # depuis la machine qui a l'archive
unzip sauvegarde.zip -d ~/restauration
```

### 2. Repérer les conteneurs

```bash
docker ps --format '{{.Names}}'
```

Reporter les noms affichés (en local : `les-creations-de-yona-postgres-1`, etc. ; sur Coolify ils se terminent par un identifiant) :

```bash
POSTGRES=les-creations-de-yona-postgres-1
SEAWEEDFS=les-creations-de-yona-seaweedfs-1
BACK=les-creations-de-yona-back-1
```

### 3. Arrêter le backend

Plus aucune écriture pendant la restauration :

```bash
docker stop "$BACK"
```

### 4. Restaurer la base

```bash
docker cp ~/restauration/database.dump "$POSTGRES":/tmp/database.dump
docker exec "$POSTGRES" sh -c 'pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/database.dump'
docker exec "$POSTGRES" rm /tmp/database.dump
```

- `--clean --if-exists` : supprime puis recrée chaque table, que la base soit vide ou non.
- `--single-transaction --exit-on-error` : tout ou rien. Si une erreur survient, la base reste telle qu'avant la commande.
- `--no-owner` : les objets appartiennent à l'utilisateur de la base cible, même s'il a changé de nom.
- Le client `pg_restore` est celui du conteneur PostgreSQL : même version (18) que le `pg_dump` du backend.

### 5. Restaurer les images

Les identifiants S3 sont relus dans la configuration du backend arrêté, sans les taper ni les afficher :

```bash
while IFS='=' read -r key value; do export "$key=$value"; done < <(
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$BACK" \
    | grep -E '^S3_(ACCESS_KEY|SECRET_KEY|BUCKET)=')

docker run --rm --network "container:$SEAWEEDFS" \
  -v ~/restauration/images:/images:ro \
  -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli:2.38.3 --endpoint-url http://127.0.0.1:8333 \
  s3 sync /images "s3://$S3_BUCKET/"
```

- `--network "container:$SEAWEEDFS"` : le client S3 partage le réseau de SeaweedFS et l'atteint sur `127.0.0.1:8333`, sans publier de port ni chercher le nom du réseau Docker.
- `s3 sync` n'envoie que les fichiers absents ou différents, et ne supprime rien : des images en trop resteraient en orphelines, sans effet sur le site.

### 6. Redémarrer et vérifier

```bash
docker start "$BACK"
docker ps --filter name="$BACK" --format '{{.Status}}'   # attendre « (healthy) »
```

- Le site affiche les recettes de la sauvegarde, avec leurs photos.
- Le back-office s'ouvre après reconnexion Google.

### 7. Nettoyer

L'archive contient toutes les données du site :

```bash
rm -rf ~/restauration ~/sauvegarde.zip
unset S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET
```

## Changer de nom de domaine

Liste complète pour passer de `les-creations-de-yona.fr` à un nouveau domaine, appelé ici `nouveau-domaine.fr`. Rien ne change dans la base ni dans les photos : seuls le code, la configuration et les services extérieurs sont concernés.

L'ordre compte : le nouveau domaine doit fonctionner avant que l'ancien redirige vers lui.

### Ce que les visiteurs perdent, et que rien ne peut transférer

Le navigateur range tout par domaine. Sur le nouveau domaine, c'est un autre site pour lui :

- **Favoris et liste de courses** (stockage local du navigateur) : repartent de zéro.
- **Application installée** : celle de l'ancien domaine affiche la redirection, il faut réinstaller depuis le nouveau.
- **Notifications des nouvelles recettes** : les abonnements sont liés à l'ancien domaine. Il faut se réabonner sur le nouveau. Les anciens abonnés restent en base et continuent de recevoir les notifications tant que l'ancien service worker existe chez eux ; un appui ouvre la recette via l'ancien domaine, qui redirige.
- **Choix clair ou sombre, accord cookies** : redemandés.

Prévoir un mot aux visiteurs (réseaux sociaux, encart sur le site) avant la bascule.

### 1. Le code (un commit)

| Fichier | À changer |
| --- | --- |
| `front/src/app/core/seo/page-seo.ts` | `SITE_URL` : adresses canoniques, Open Graph, JSON-LD, sitemap |
| `front/angular.json` | `security.allowedHosts` : hôte accepté par le serveur SSR (sinon erreur 400) |
| `front/public/robots.txt` | ligne `Sitemap:` |
| `front/public/manifest.webmanifest` | `related_applications` : sinon le site ne voit plus, depuis le navigateur, que l'application est installée |
| `front/src/app/core/analytics/analytics.ts` | `MEASURED_HOSTS` : sinon plus aucune mesure d'audience |
| `front/src/app/pages/legal/legal-notice.html` | nom du site dans les mentions légales |
| `front/src/app/pages/legal/legal.ts` | `LEGAL_PAGES_UPDATED_ON` (date de mise à jour) |
| `back/src/main/resources/application.yaml` | valeurs par défaut de `PUSH_SUBJECT` et de `SITE_URL` (adresses envoyées à IndexNow), ou les variables dans Coolify |
| `devops/.env.example`, `devops/compose.prod.yaml` (commentaire), `docs/production.md`, `docs/google.md` | adresses d'exemple et documentation |

Pour vérifier qu'il n'en reste pas : chercher `les-creations-de-yona.fr` dans tout le dépôt, en dehors de `CHANGELOG.md`, qui raconte le passé.

Le backend n'a rien d'autre en dur : il lit le domaine dans les en-têtes `X-Forwarded-*` transmis par Coolify et la passerelle (adresses de retour Google comprises). Seul IndexNow, appelé sans requête à lire (publication programmée), prend `SITE_URL`. Après la bascule, ajouter aussi le nouveau domaine dans Bing Webmaster Tools ([production](production.md#assistants-ia)).

Ne pas déployer ce commit avant les étapes 2 à 4 : le serveur refuserait encore le nouveau domaine, ou Google ses adresses de retour.

### 2. DNS et Cloudflare

1. Ajouter `nouveau-domaine.fr` dans Cloudflare (offre gratuite) et changer les serveurs DNS chez le registraire, comme Cloudflare l'indique.
2. Enregistrement `A` du domaine vers l'IP du serveur, **proxifié** (nuage orange). Même chose pour `www` si besoin.
3. **SSL/TLS** : mode **Full (strict)** (ou **Full**), jamais **Flexible** (la page bouclerait).
4. **Scrape Shield → Email Address Obfuscation** : **désactivé** (sinon erreur d'hydratation sur les pages légales). **Rocket Loader** : désactivé.

### 3. Coolify

1. Ressource du site → service **gateway** → **Domains** : ajouter `https://nouveau-domaine.fr`, en gardant l'ancien pour l'instant (séparés par une virgule). Coolify obtient le certificat.
2. Si `PUSH_SUBJECT` est défini dans les variables : le passer sur le nouveau domaine (ou une adresse `mailto:`).

### 4. Google Cloud (client OAuth)

Voir [google.md](google.md). **Google Auth Platform** :

1. **Branding → Domaines autorisés** : ajouter `nouveau-domaine.fr`.
2. **Clients** → le client web :
   - **Origines JavaScript autorisées** : ajouter `https://nouveau-domaine.fr` ;
   - **URI de redirection autorisés** : ajouter `https://nouveau-domaine.fr/api/login/oauth2/code/google` et `https://nouveau-domaine.fr/api/admin/drive/callback`.
3. Garder les adresses de l'ancien domaine jusqu'à la fin de la bascule.

La sauvegarde Google Drive déjà connectée continue sans rien faire : son jeton ne dépend pas du domaine. L'adresse de retour ne sert que pour connecter un compte.

### 5. Déployer et vérifier

1. Pousser le commit de l'étape 1 : Coolify redéploie.
2. Sur `https://nouveau-domaine.fr` :
   - accueil, une recette, `/glossaire` ;
   - `/sitemap.xml` et `/robots.txt` : adresses sur le nouveau domaine ;
   - code source d'une recette : `<link rel="canonical">` et JSON-LD sur le nouveau domaine ;
   - connexion au back-office (Google ne doit pas répondre `redirect_uri_mismatch`) ;
   - back-office → Sauvegarde : « Sauvegarder maintenant » réussit.

### 6. Rediriger l'ancien domaine

Les recettes déjà indexées par Google, épinglées sur Pinterest ou partagées doivent arriver au même endroit sur le nouveau domaine. Une redirection 301 transmet aussi leur référencement.

1. Coolify : retirer l'ancien domaine du service **gateway**.
2. Cloudflare, zone de l'**ancien** domaine (à garder, avec son enregistrement `A` proxifié) : **Rules → Redirect Rules → Create rule**.
   - Si : « All incoming requests ».
   - Alors : **Dynamic**, expression `concat("https://nouveau-domaine.fr", http.request.uri)`, code **301**, cocher « Preserve query string ».
3. Vérifier : `https://les-creations-de-yona.fr/recettes/…` mène à la même recette sur le nouveau domaine.
4. Garder l'ancien domaine et sa redirection **au moins un an** (renouvellement compris).

### 7. Google Search Console, Analytics

1. **Search Console** : ajouter une propriété « Domaine » `nouveau-domaine.fr` (enregistrement TXT chez Cloudflare), y déclarer `https://nouveau-domaine.fr/sitemap.xml`.
2. Dans l'**ancienne** propriété : **Paramètres → Changement d'adresse**, choisir la nouvelle. Google transfère le référencement plus vite (la redirection 301 de l'étape 6 est exigée).
3. **Analytics** : **Administration → Flux de données** → le flux web → modifier l'URL du flux. Même propriété, l'historique est gardé.

### 8. Ailleurs

- Liens vers le site dans les profils des réseaux sociaux (Instagram, TikTok, YouTube, Pinterest…).
- Pinterest : revendiquer le nouveau domaine dans les paramètres du compte, si l'ancien l'était.
- Adresse e-mail de contact si elle est sur le domaine (aujourd'hui non : `CONTACT_EMAIL` dans `legal.ts`).

### 9. Après la bascule

Quelques semaines plus tard, quand la Search Console montre le nouveau domaine indexé :

- retirer les adresses de l'ancien domaine du client OAuth Google (origine et URI de retour) ;
- garder la redirection Cloudflare (voir étape 6).
