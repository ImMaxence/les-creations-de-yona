# Revue de sécurité

Date : 2026-10-21. Portée : tout le dépôt (`back/`, `front/`, `devops/`), lecture du code et de la configuration, sans test sur un déploiement réel.

Résultat : aucune faille critique, haute ou moyenne. Deux points de faible gravité, corrigés le même jour (voir « Suivi »).

| # | Gravité | Fichier | Lignes | Problème | Confiance |
|---|---------|---------|--------|----------|-----------|
| 1 | Faible | `front/src/server.ts` | 15-46 | Aucun en-tête de sécurité sur le serveur SSR | 9/10 |
| 2 | Faible | `back/src/main/resources/application.yaml`, `back/src/main/java/fr/lescreationsdeyona/security/SecurityConfig.java` | 76-84, 35 | Documentation de l'API publique par défaut | 9/10 |

## 1. Aucun en-tête de sécurité sur le serveur SSR

Le serveur Express sert toutes les pages et tous les fichiers statiques sans `Content-Security-Policy`, `X-Frame-Options` (ou `frame-ancestors`), `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy`. Il annonce aussi `X-Powered-By: Express`. Le backend reçoit ces en-têtes de Spring Security, mais seules les routes `/api/*` passent par lui.

Scénario : un site tiers charge les pages dans une `<iframe>` invisible et piège le clic du visiteur (clickjacking). Impact faible tant que les pages publiques n'offrent aucune action sensible, réel dès que le back-office `/admin` est servi par ce même serveur. Sans CSP, une future injection HTML n'aurait aucun garde-fou.

Correction proposée, avant les handlers statiques et SSR :

- `app.disable('x-powered-by')` ;
- `X-Frame-Options: DENY` (ou `frame-ancestors 'none'` dans la CSP) ;
- `X-Content-Type-Options: nosniff` ;
- `Referrer-Policy: strict-origin-when-cross-origin` ;
- `Permissions-Policy` restrictive ;
- HSTS, ici ou dans Cloudflare ;
- une CSP, par exemple `default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Le JSON-LD n'est pas exécuté et n'a pas besoin de `unsafe-inline` ; vérifier les styles inline d'Angular (hash ou nonce).

## 2. Documentation de l'API publique par défaut

L'OpenAPI et Swagger UI sont activés par défaut (`API_DOCS_ENABLED:true`), sous `/api`, donc routés vers le backend en production, et ouverts à tous (`permitAll` sur `/api/docs/**`).

Scénario : n'importe qui ouvre `https://les-creations-de-yona.fr/api/docs` et obtient la carte complète de l'API d'administration (routes, paramètres, schémas, sauvegarde, connexion). Les routes admin restent protégées : divulgation d'information seulement.

Correction proposée : désactiver par défaut (`${API_DOCS_ENABLED:false}`), activer seulement en local (le client du front est généré depuis un backend local), et retirer `/api/docs/**` du `permitAll` en production.

## Suivi

| # | Statut | Correction |
|---|--------|------------|
| 1 | Corrigé | `front/src/server/security-headers.ts` : CSP sans `unsafe-inline` pour les scripts (hash des scripts du build, nonce par réponse pour celui du rendu), `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-Powered-By` retiré. Vérifié dans le navigateur : aucune violation de CSP sur les pages publiques ni sur le back-office. |
| 2 | Corrigé | `API_DOCS_ENABLED` vaut `false` par défaut, `/api/docs/**` n'est autorisé que si la documentation est active. En production, `/api/docs` répond 401 comme toute route inconnue. |

## Points vérifiés sans faille exploitable

- Accès admin : email Google vérifié et présent dans la liste autorisée, rôle admin exigé sur `/api/admin/**`, toute autre route refusée.
- CSRF : cookie `XSRF-TOKEN` `Secure` et `SameSite=Strict`, déconnexion en POST avec jeton.
- Vues des recettes (1.5) : `POST /api/recipes/{slug}/views`, public et sans jeton CSRF comme les abonnements aux notifications. Le pire d'une requête forgée ou répétée : gonfler le compteur d'une recette publiée, montré au seul back-office. Une requête SQL à paramètre lié, aucune donnée sur le visiteur gardée, aucune session créée.
- « Donner mon avis » (1.9, durci en 1.10) : `POST /api/feedback`, public et sans jeton CSRF. Champ piège pour les robots ; par adresse (`CF-Connecting-IP`, que Cloudflare écrase toujours ; sinon l'adresse lue derrière les proxys), une minute entre deux messages et 5 par heure ; 30 messages par heure pour tout le site, quelles que soient les adresses (un réseau de machines ne peut pas inonder le back-office) ; un même message gardé une fois ; 500 non lus au plus. Tout en mémoire, rien sur le visiteur n'est écrit. Le pire d'un envoi en masse : 30 messages par heure à supprimer.
- Corbeille (1.5) : sous `/api/admin/**` ; la miniature d'une photo supprimée est lue depuis son dossier S3 enregistré par le serveur, jamais depuis une saisie.
- Redirections OAuth : cibles fixes, pas de redirection ouverte.
- Injection SQL : paramètres liés, jokers `LIKE` échappés, tri limité à une liste de champs.
- Clés S3 : UUID générés par le serveur, jamais issus d'une saisie.
- Upload d'images : format vérifié sur le contenu, nombre de pixels plafonné avant décodage.
- Sauvegarde : `pg_dump` lancé avec une liste d'arguments (sans shell), mot de passe passé par l'environnement.
- Erreurs : réponses génériques, sans trace de pile.
- Réécriture SSR vers l'API interne : limitée à l'hôte du site et à `/api/`, `allowedHosts` configuré.
- Markdown : passe par le sanitizer d'Angular. Seul `bypassSecurityTrust*` du projet : l'URL du lecteur YouTube (`shared/ui/youtube-video`), construite à partir d'un identifiant vérifié (`^[A-Za-z0-9_-]{11}$`, aussi imposé par la base) et d'une origine fixe.
- JSON-LD : `<` échappé.
- Réseaux sociaux : seules les URL `https` sont acceptées.
- Conteneurs : utilisateurs non root, ports PostgreSQL, SeaweedFS et backend liés à `127.0.0.1`.
- Secrets : `devops/.env` ignoré par git, jamais commité.

## Audit du 22 octobre 2026

Revue rapide après l'ajout des thèmes, de la galerie réutilisable, de la difficulté et des vidéos : aucune faille exploitable trouvée.

- Thème : valeurs en listes fermées (formulaire, contrainte CHECK, tables du front), rayon borné à 0–999 : le `style` écrit sur `<html>` ne peut contenir que des constantes. Modification réservée aux admins.
- Script inline de `index.html` (choix clair/sombre) : n'applique que `light` ou `dark`, autorisé par son hash dans la CSP.
- Galerie et `image-choice` : réservés aux admins, identifiants typés (nombre, UUID), requêtes paramétrées.
- Compose de production : aucun port publié, seule la passerelle a un domaine ; `/actuator` et l'admin SeaweedFS injoignables de l'extérieur.

### Incident : route de connexion de test déployée (corrigé)

Le 22 octobre 2026, un fichier de test local, `TmpDevLogin.java` (route `/api/tmp-login` ouvrant une session admin sans Google), a été commité par erreur avec le reste du travail (`e257b16`) et déployé automatiquement. Exposition : environ 6 minutes (17:46 à 17:53). Correction : suppression (`3d0ddcf`), redéploiement, la route répond 401 ; le redémarrage a effacé toutes les sessions (en mémoire). Aucune trace d'utilisation possible (pas de journal des requêtes) : contrôle manuel du back-office conseillé. Prévention : plus de contournement d'authentification dans le dépôt, même temporaire ; les tests du back-office passent par l'API et la base.

## Audit du 26 octobre 2026 (version 2.1.0)

Portée : tout ce qui a changé depuis la 2.0 : restauration d'une sauvegarde depuis le back-office, tags, photo Pinterest, préréglages d'apparence, recherches sans résultat, statistiques, favoris, liste de courses, mode cuisine, impression. Lecture du code, plus des tests réels de la restauration sur une pile Docker jetable (voir plus bas).

Résultat : aucune faille critique, haute ou moyenne. Quatre renforcements faits pendant l'audit (tableau ci-dessous), deux risques acceptés.

### Restauration d'une sauvegarde (`back/src/main/java/fr/lescreationsdeyona/backup/`)

C'est la fonction la plus sensible : elle exécute le SQL d'un fichier envoyé par l'admin, puis remplace ou complète toute la base.

- Accès : `/api/admin/restore/**`, réservé aux admins comme tout `/api/admin/**`, avec le jeton CSRF sur chaque écriture (envoi des morceaux compris).
- Le dump n'est jamais rejoué avec les droits du site. `pg_restore` le charge dans une base à part (`yona_restore_…`), avec un rôle créé pour l'occasion : sans droits d'administration, mot de passe aléatoire gardé en mémoire, base et rôle supprimés à la fin (ou au nettoyage suivant après un redémarrage). Un dump piégé ne peut donc ni lancer de programme (`COPY … TO PROGRAM` refusé, testé), ni lire de fichier du serveur, ni toucher la base du site.
- La base temporaire est ensuite vérifiée : mêmes tables et colonnes que le site, et aucune vue, fonction (hors extension `unaccent`), trigger ou règle qui pourrait exécuter du code à la lecture. Elle est lue avec le même rôle limité.
- Les données passent dans la base du site par des requêtes paramétrées (fusion) ou par `COPY` binaire, colonne par colonne (remplacement), en une seule transaction. Les contraintes du site s'appliquent à l'écriture : une valeur hors norme annule tout.
- Archive ZIP : seules les entrées attendues sont acceptées (`database.dump`, `manifest.json`, `images/` avec des clés de la forme exacte `{type}/{uuid}/{800|1600}.webp`), sinon l'archive est refusée. Aucun nom de l'archive ne sert de chemin sur le disque. Les tailles sont plafonnées (2 Go pour le dump, 20 Mo par image, 200 000 entrées) et la décompression s'arrête à la taille annoncée (bombe ZIP). Chaque image doit avoir un en-tête WebP avant d'être envoyée au stockage.
- Envoi par morceaux de 32 Mio, dans l'ordre, un à la fois, archive de 20 Go au plus, espace disque vérifié avant de commencer. Une seule restauration à la fois, abandonnée au bout d'une heure sans activité.
- « Tout remplacer » exige le mot REMPLACER, vérifié par le serveur.
- Les sorties de `pg_restore` ne sont pas journalisées (elles pourraient contenir des données).

Testé le 26 octobre 2026 sur une pile Docker séparée (base et stockage vides, réseau à part), avec une copie de la base locale :

| Test | Résultat |
| --- | --- |
| Analyse d'une sauvegarde (rôle limité, comparaison) | OK |
| Fusion vers un site vide, puis nouvelle analyse | Tout ajouté, puis « rien à ajouter » |
| Recette supprimée, catégorie renommée, tag ajouté, fichier orphelin dans le stockage, puis « Tout remplacer » | État de la sauvegarde retrouvé, orphelin supprimé, séquences recalées |
| « Tout remplacer » sans le mot REMPLACER | Refusé (`RESTORE_CONFIRMATION_REQUIRED`) |
| Archive avec un fichier inattendu, faux dump | Refusées (`RESTORE_ARCHIVE_INVALID`) |
| Morceau envoyé dans le désordre | Refusé (`RESTORE_CHUNK_INVALID`) |
| Archive de 40 Mo en 2 morceaux | Bien reconstituée |
| Sauvegarde au format de la 2.0 (schéma V6) | Mise à niveau en V7 par le rôle limité, puis fusionnée |
| Préréglage d'apparence au thème inconnu dans la sauvegarde | Refusée à l'analyse |
| Bases et rôles temporaires après les tests | Tous supprimés |

Ces tests ont utilisé une image du backend construite localement avec la route de restauration ouverte, pour l'appeler sans Google. Cette modification n'a existé que le temps de construire l'image : le code a été remis à l'identique aussitôt (vérifié), rien n'a été commité, et l'image comme la pile ont été supprimées après les tests (cf. l'incident du 22 octobre).

### Autres changements

- Recherches sans résultat (`search/SearchMissService.java`) : écriture déclenchée par une route publique (`GET /api/recipes?q=`). Bornée : 100 caractères, 500 textes distincts au plus (au-delà, seuls les textes déjà notés sont comptés), une même recherche comptée une fois par minute, effacement après 12 mois. Rien sur le visiteur (ni IP, ni cookie). Affichées dans le back-office par interpolation Angular (échappées). Mentionné dans la politique de confidentialité.
- Tags : routes d'écriture réservées aux admins, lecture publique en `GET` seulement (`/api/tags`), noms de 40 caractères au plus, slug généré par le serveur.
- Photo Pinterest : même contrôle que les autres photos (contenu, pixels, EXIF retiré), format vertical vérifié ; une photo de la galerie ne peut servir qu'à sa place (paysage ou vertical, `IMAGE_NOT_LANDSCAPE` / `IMAGE_NOT_PORTRAIT`). Le bouton « Épingler » est un simple lien (paramètres encodés par `URLSearchParams`, `rel="noopener noreferrer"`) : aucun script de Pinterest, CSP inchangée.
- Préréglages d'apparence : thème, polices et arrondi validés comme ceux du site (listes fermées, 0–999 px), nom de 50 caractères au plus.
- Favoris et liste de courses : stockage local du navigateur uniquement, relu avec vérification de forme, affiché par interpolation et liens du routeur (segments encodés). Partage WhatsApp par `encodeURIComponent`.
- Mode cuisine : étapes rendues par le pipe Markdown existant (sanitizer d'Angular) ; son et vibration sans autorisation particulière, `Permissions-Policy` inchangée.
- Sauvegarde : nouveau `manifest.json` (date et version), écrit par le serveur sans donnée externe.

### Renforcements faits pendant l'audit

| # | Gravité | Fichier | Problème | Correction |
|---|---------|---------|----------|------------|
| 3 | Faible | `backup/RestoredData.java` | La table `appearance_preset` n'a pas de contrainte CHECK sur ses listes fermées : une sauvegarde trafiquée pouvait y glisser une valeur inconnue et casser la page Apparence | Valeurs vérifiées à l'analyse (`checkValues`), sauvegarde refusée sinon (testé) |
| 4 | Faible | `backup/RestoredData.java` | Noms de colonnes, repris de la base temporaire, écrits sans guillemets dans l'`INSERT` de la fusion (déjà vérifiés identiques à ceux du site) | Toujours entre guillemets |
| 5 | Faible | `search/SearchMissService.java` | La mémoire anti-doublon pouvait grossir sans limite pendant une minute de recherches en rafale | Vidée au-delà de 5 000 textes |
| 6 | Faible | `backup/RestoreService.java` | Une archive en cours restait dans `/tmp` du conteneur après un redémarrage | Dossiers `yona-restore-*` orphelins supprimés au nettoyage périodique |

### Risques acceptés

- Le rôle temporaire de restauration peut se connecter à la base du site (droit `CONNECT` par défaut de PostgreSQL) mais n'y a aucun droit sur les tables, et seul le backend connaît son mot de passe, le temps d'une restauration.
- Une restauration n'est pas annulable une fois appliquée : « Tout remplacer » est volontairement caché (zone danger repliée, avertissements, case à cocher, mot REMPLACER, confirmation finale), et la page conseille de télécharger une sauvegarde juste avant.

## Audit du 2 novembre 2026 (version 1.18.1)

Portée : tout le dépôt, en priorité ce qui a changé depuis le 26 octobre (1.10 à 1.18) : retours des visiteurs, visites venant des assistants IA, « Remplir avec l'IA », sauvegardes Google Drive, IndexNow, pages en Markdown, `llms.txt` et `llms-full.txt`. Lecture du code et de la configuration, `npm audit`, recherche de secrets dans tout l'historique git, puis tests des corrections sur la pile Docker locale.

Résultat : aucune faille critique ni haute. Un point moyen-faible et deux faibles corrigés, un point faible à vérifier sur le serveur.

| # | Gravité | Fichier | Problème | Statut |
|---|---------|---------|----------|--------|
| 7 | Moyenne-faible | `push/PushService.java` | Abonnements aux notifications sans limite de débit : un script pouvait remplir les 20 000 places avec des abonnements forgés, et ceux que le service refusait (400, 403) restaient pour toujours | Corrigé |
| 8 | Faible | `front/package-lock.json` | `npm audit` : Vite 8.3.0 (serveur de développement seulement) et body-parser 2.3.0 (non utilisé par le serveur SSR, aucun `express.json()`) | Corrigé |
| 9 | Info | `front/src/server/llms.ts`, `sitemap.ts` | Une adresse avec paramètres (`/llms-full.txt?x=1`) passe à côté du cache de Cloudflare ; chaque requête coûte 1 + N appels à l'API (amortis par le cache du backend) | Corrigé |
| 10 | Faible | `feedback/FeedbackController.java`, déploiement | Les limites par adresse se fient à `CF-Connecting-IP` : si le serveur répond à qui l'appelle directement par son IP, sans Cloudflare, l'en-tête peut être falsifié et les limites par adresse contournées (celles de tout le site tiennent) | À vérifier sur le serveur |

### Corrections

- 7 : nouveaux abonnements limités à 10 par heure par adresse et 300 par heure pour tout le site, en mémoire seulement (`PUSH_TOO_MANY`, `PUSH_BUSY`, 429) ; un réabonnement du même navigateur n'est pas compté. Un abonnement refusé 3 fois de suite par son service (4xx hors 404, 410 et 429) est supprimé (migration V19, colonne `failures`, remise à 0 après un envoi réussi). Un refus n'est compté que si l'envoi est passé pour d'autres abonnés : une panne du site (clés, horloge) ne vide pas la table. L'adresse du visiteur est lue au même endroit pour les avis et les abonnements (`common/ClientAddress`). Testé sur la pile locale : 10 abonnements acceptés, le 11e refusé (429), réabonnement accepté.
- 8 : Angular 22.2.4, outils de build 22.2.5 (Vite 8.3.5), body-parser 2.4.0 ; `npm audit` sans vulnérabilité, `e2e/` aussi.
- 9 : `/sitemap.xml`, `/llms.txt` et `/llms-full.txt` avec paramètres redirigés (301) vers l'adresse sans paramètre. Les pages `.md` font un seul appel à l'API, déjà en cache : laissées telles quelles.
- 10 : rien à changer dans le code. Vérifier que le serveur refuse les connexions qui ne viennent pas de Cloudflare (pare-feu limité aux [plages d'IP de Cloudflare](https://www.cloudflare.com/ips/), ou Authenticated Origin Pulls). La commande de vérification est dans la [roadmap](docs/roadmap.md#points-ouverts).

### Points vérifiés sans faille exploitable

- Notifications : seuls les services des navigateurs (Google, Mozilla, Apple, Microsoft), en `https` sur le port 443, sans identifiants dans l'adresse : un abonnement ne peut pas faire appeler une autre adresse par le serveur (SSRF).
- Aperçu des liens des messages (2.9, `message/LinkFetcher`) : le serveur lit la page d'une adresse écrite par un admin. `http` ou `https` sur les ports 80 et 443 seulement, sans identifiants dans l'adresse ; chaque adresse IP du nom doit être publique (ni la machine, ni un réseau privé, ni le lien local des métadonnées d'un hébergeur 169.254.0.0/16, ni l'espace partagé 100.64.0.0/10, ni leurs formes IPv6), redirections suivies à la main et revérifiées (4 au plus) ; 8 secondes, 1 Mo de page et 5 Mo d'image lus au plus, sans cookie ni rien du site envoyé (agent neutre). Réservé aux admins (`/api/admin`). Reste possible, faute de résoudre le nom une seule fois : un nom qui change d'adresse entre la vérification et la lecture (rebinding DNS), sur une adresse qu'un admin aurait écrite. L'image est décodée puis réencodée en WebP par le serveur (formats JPEG, PNG, WebP, GIF, 100 mégapixels au plus), jamais servie telle quelle.
- Photos des messages (2.9) : type d'image `MESSAGE`, refusé par `/api/images` (public) et par la galerie ; `/api/admin/messages/images/{id}` ne les sert qu'aux membres du groupe du message ou du groupe dont c'est la photo, en `Cache-Control: private`.
- Retours des visiteurs et visites venant des assistants IA : routes publiques sans jeton CSRF, bornées comme décrit plus haut ; l'assistant est une liste fermée (`AiAssistant`), compté par jour sans rien sur le visiteur. Le pire : gonfler un compteur du back-office (risque déjà accepté pour les vues).
- Google Drive : `state` aléatoire gardé dans la session de l'admin et effacé à la première réponse, adresse de retour fixe, portée `drive.file` vérifiée ; le jeton est conservé dans une table propre au serveur, jamais sauvegardée.
- « Remplir avec l'IA » : réservé aux admins, clé Gemini envoyée dans un en-tête (jamais dans l'URL ni dans les journaux), image vérifiée à son contenu, réponse bornée aux règles du formulaire.
- Pages en Markdown, `llms.txt` : l'API est appelée sans cookie (`fetch` du serveur, slugs encodés), donc les brouillons répondent 404 ; adresses absolues construites sur une constante (`SITE_URL`), `allowedHosts` fixé en production ; CSP et en-têtes de sécurité appliqués à toutes les réponses.
- Routes publiques `GET` : recettes et menus publiés seulement, recherche et tri bornés.
- Affichage : le seul contournement du sanitizer d'Angular reste le lecteur YouTube ; Markdown et glossaire passent par `[innerHTML]` et le sanitizer.
- Secrets : aucune clé Google, AWS ou privée, ni aucun `.env`, dans l'historique git.

## Audit du 10 novembre 2026 (version 2.4.0)

Portée : ce qui a changé depuis la 2.0 : Mon CAP en articles (blocs en JSON, Markdown, photos), boutique (produits, demande gardée dans le navigateur, demande par le seul message), comptabilité (achats détaillés, photos de tickets de caisse), factures, glossaire depuis l'éditeur, fusion des nouvelles tables à la restauration, et la réorganisation des règles d'accès (`SecurityConfig.PUBLIC_READS`). Lecture du code et de la configuration, appels sans session sur la pile locale, `npm audit`, recherche de secrets dans les changements en cours.

Résultat : aucune faille critique, haute ni moyenne. Un point faible (transparence) corrigé, un renforcement ajouté.

| # | Gravité | Fichier | Problème | Statut |
|---|---------|---------|----------|--------|
| 11 | Faible | `front/src/app/pages/legal/privacy-policy.html` | La demande de la boutique (nom, e-mail, téléphone, message) est gardée dans le navigateur (`yona-shop-request`), les coordonnées même après l'envoi, sans que la politique de confidentialité le dise ; sur un appareil partagé, la personne suivante les voit | Corrigé |
| 12 | Info | `security/SecurityConfig.java` | Les règles d'accès ne sont vérifiées par aucun test : une nouvelle route publique oubliée dans la liste est refusée (page cassée), une écriture publique ajoutée par erreur passerait inaperçue | Renforcé |

### Corrections

- 11 : paragraphe ajouté à la politique de confidentialité (clé, contenu, ce qui reste après l'envoi, conseil pour un appareil partagé) ; date des pages légales au 10 novembre 2026. La demande relue du navigateur est aussi vérifiée champ par champ (une quantité qui n'est pas un nombre entier de 1 à 50 l'écarte), pour qu'une valeur trafiquée ne fausse pas le total affiché.
- 12 : `SecurityConfig.PUBLIC_READS` et les adresses d'écriture publiques sont lus par `EndpointAccessTest`, qui parcourt chaque contrôleur par réflexion : tout `Admin…Controller` sous `/api/admin`, chaque lecture publique listée, aucune écriture publique hors abonnements, vues, visites d'assistants IA, retours et commandes, aucune adresse listée sans route derrière, factures et tickets réservés aux admins.

### Points vérifiés sans faille exploitable

- Factures : routes sous `/api/admin` (401 sans session, 403 sans jeton CSRF), numéro pris sous verrou (`SELECT … FOR UPDATE` sur `shop_settings`) et unique en base ; une facture copie vendeur, client et lignes et n'est jamais modifiée ; une commande facturée ne peut plus changer de statut ni de montant, ni être supprimée. Données du client gardées 10 ans (obligation comptable), écrit dans la politique de confidentialité.
- Tickets de caisse : type `RECEIPT` refusé par la route publique des images (404), servi aux admins seulement avec `Cache-Control: no-store`, hors du cache du service worker (seul `/api/images/**` y est), hors de la galerie ; format vérifié sur le contenu, pixels plafonnés, 10 Mo au plus ; stockage S3 sans port publié en production.
- Articles de Mon CAP : blocs bornés (60, astuce de 1 000 caractères, photos de la galerie seulement, types connus), texte en Markdown rendu par `[innerHTML]` et le sanitizer d'Angular (aucun `bypassSecurityTrustHtml` dans le projet) ; titre et sous-titre dans le JSON-LD `BlogPosting`, `<` échappé ; brouillon et adresse inconnue répondent 404. Un lien du texte n'est suivi par le routeur que s'il mène au site (`/…`, ni `//` ni `/\`).
- Boutique : prix, format et disponibilité relus sur le serveur à chaque demande (rien ne vient du navigateur que l'identifiant et la quantité) ; demande par le seul message soumise aux mêmes limites (champ piège, reCAPTCHA, une minute entre deux, 5 par heure par adresse, 30 pour tout le site, 500 en attente).
- Restauration : les lignes des factures, des achats et des produits viennent d'une base temporaire dont les tables et colonnes doivent être exactement celles du site, sans fonction, déclencheur ni règle (`ScratchDatabases.checkSchema`) ; noms de colonnes entre guillemets, valeurs en paramètres liés ; contraintes de la base (numéro, montant, SIRET) vérifiées à l'insertion. `BackupCoverageTest` oblige chaque nouvelle table à être fusionnée ou écartée exprès.
- Brouillons des articles dans le navigateur de l'admin (`yona-article-draft-…`) : comme ceux des recettes, sur l'appareil de l'admin seulement, oubliés à l'enregistrement.
- Appels sans session sur la pile locale : `GET /api/admin/invoices`, `…/settings`, `…/{id}`, `/api/admin/accounting/{id}/receipt` répondent 401 ; `POST …/orders/{id}/invoice` et `PUT …/invoices/settings` 403 ; `PUT /api/shop` 403, `DELETE /api/shop/orders` 401 ; `/api/cap/entries/..%2F..%2Fadmin%2Fme` 400. En-têtes de sécurité (CSP avec nonce, `X-Frame-Options`, HSTS, `nosniff`, `Referrer-Policy`) présents sur les pages.
- Dépendances : `npm audit` sans vulnérabilité pour `front/` et `e2e/`. Le backend suit les versions gérées par Spring Boot 4 (aucun outil d'analyse des dépendances Java dans le projet : à ajouter si besoin, par exemple OWASP Dependency-Check en CI).
- Secrets : aucune clé Google, AWS, GitHub ou privée dans les changements en cours (diff et nouveaux fichiers), aucun `.env` ajouté.

### Risques acceptés

- Tous les admins voient toutes les factures, commandes et tickets : une seule équipe, comme pour le reste du back-office.
- Une facture ne se supprime pas, même générée par erreur : c'est la règle comptable (numérotation sans trou). Une erreur se corrige par une facture d'avoir, à faire à la main pour l'instant.
- Les coordonnées gardées dans le navigateur après l'envoi d'une demande : un confort pour la demande suivante, dit dans la politique de confidentialité.
