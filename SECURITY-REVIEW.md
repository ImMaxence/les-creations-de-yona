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
