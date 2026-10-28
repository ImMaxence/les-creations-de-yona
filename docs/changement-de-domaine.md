# Changer de nom de domaine

Liste complète pour passer de `les-creations-de-yona.fr` à un nouveau domaine, appelé ici `nouveau-domaine.fr`. Rien ne change dans la base ni dans les photos : seuls le code, la configuration et les services extérieurs sont concernés.

L'ordre compte : le nouveau domaine doit fonctionner avant que l'ancien redirige vers lui.

## Ce que les visiteurs perdent, et que rien ne peut transférer

Le navigateur range tout par domaine. Sur le nouveau domaine, c'est un autre site pour lui :

- **Favoris et liste de courses** (stockage local du navigateur) : repartent de zéro.
- **Application installée** : celle de l'ancien domaine affiche la redirection, il faut réinstaller depuis le nouveau.
- **Notifications des nouvelles recettes** : les abonnements sont liés à l'ancien domaine. Il faut se réabonner sur le nouveau. Les anciens abonnés restent en base et continuent de recevoir les notifications tant que l'ancien service worker existe chez eux ; un appui ouvre la recette via l'ancien domaine, qui redirige.
- **Choix clair ou sombre, accord cookies** : redemandés.

Prévoir un mot aux visiteurs (réseaux sociaux, encart sur le site) avant la bascule.

## 1. Le code (un commit)

| Fichier | À changer |
| --- | --- |
| `front/src/app/core/seo/page-seo.ts` | `SITE_URL` : adresses canoniques, Open Graph, JSON-LD, sitemap |
| `front/angular.json` | `security.allowedHosts` : hôte accepté par le serveur SSR (sinon erreur 400) |
| `front/public/robots.txt` | ligne `Sitemap:` |
| `front/public/manifest.webmanifest` | `related_applications` : sinon le site ne voit plus, depuis le navigateur, que l'application est installée |
| `front/src/app/core/analytics/analytics.ts` | `MEASURED_HOSTS` : sinon plus aucune mesure d'audience |
| `front/src/app/pages/legal/legal-notice.html` | nom du site dans les mentions légales |
| `front/src/app/pages/legal/legal.ts` | `LEGAL_PAGES_UPDATED_ON` (date de mise à jour) |
| `back/src/main/resources/application.yaml` | valeur par défaut de `PUSH_SUBJECT` (ou la variable dans Coolify) |
| `devops/.env.example`, `devops/compose.prod.yaml` (commentaire), `docs/production.md`, `docs/google.md` | adresses d'exemple et documentation |

Pour vérifier qu'il n'en reste pas : chercher `les-creations-de-yona.fr` dans tout le dépôt, en dehors de `CHANGELOG.md`, qui raconte le passé.

Le backend n'a rien d'autre en dur : il lit le domaine dans les en-têtes `X-Forwarded-*` transmis par Coolify et la passerelle (adresses de retour Google comprises).

Ne pas déployer ce commit avant les étapes 2 à 4 : le serveur refuserait encore le nouveau domaine, ou Google ses adresses de retour.

## 2. DNS et Cloudflare

1. Ajouter `nouveau-domaine.fr` dans Cloudflare (offre gratuite) et changer les serveurs DNS chez le registraire, comme Cloudflare l'indique.
2. Enregistrement `A` du domaine vers l'IP du serveur, **proxifié** (nuage orange). Même chose pour `www` si besoin.
3. **SSL/TLS** : mode **Full (strict)** (ou **Full**), jamais **Flexible** (la page bouclerait).
4. **Scrape Shield → Email Address Obfuscation** : **désactivé** (sinon erreur d'hydratation sur les pages légales). **Rocket Loader** : désactivé.

## 3. Coolify

1. Ressource du site → service **gateway** → **Domains** : ajouter `https://nouveau-domaine.fr`, en gardant l'ancien pour l'instant (séparés par une virgule). Coolify obtient le certificat.
2. Si `PUSH_SUBJECT` est défini dans les variables : le passer sur le nouveau domaine (ou une adresse `mailto:`).

## 4. Google Cloud (client OAuth)

Voir [google.md](google.md). **Google Auth Platform** :

1. **Branding → Domaines autorisés** : ajouter `nouveau-domaine.fr`.
2. **Clients** → le client web :
   - **Origines JavaScript autorisées** : ajouter `https://nouveau-domaine.fr` ;
   - **URI de redirection autorisés** : ajouter `https://nouveau-domaine.fr/api/login/oauth2/code/google` et `https://nouveau-domaine.fr/api/admin/drive/callback`.
3. Garder les adresses de l'ancien domaine jusqu'à la fin de la bascule.

La sauvegarde Google Drive déjà connectée continue sans rien faire : son jeton ne dépend pas du domaine. L'adresse de retour ne sert que pour connecter un compte.

## 5. Déployer et vérifier

1. Pousser le commit de l'étape 1 : Coolify redéploie.
2. Sur `https://nouveau-domaine.fr` :
   - accueil, une recette, `/glossaire` ;
   - `/sitemap.xml` et `/robots.txt` : adresses sur le nouveau domaine ;
   - code source d'une recette : `<link rel="canonical">` et JSON-LD sur le nouveau domaine ;
   - connexion au back-office (Google ne doit pas répondre `redirect_uri_mismatch`) ;
   - back-office → Sauvegarde : « Sauvegarder maintenant » réussit.

## 6. Rediriger l'ancien domaine

Les recettes déjà indexées par Google, épinglées sur Pinterest ou partagées doivent arriver au même endroit sur le nouveau domaine. Une redirection 301 transmet aussi leur référencement.

1. Coolify : retirer l'ancien domaine du service **gateway**.
2. Cloudflare, zone de l'**ancien** domaine (à garder, avec son enregistrement `A` proxifié) : **Rules → Redirect Rules → Create rule**.
   - Si : « All incoming requests ».
   - Alors : **Dynamic**, expression `concat("https://nouveau-domaine.fr", http.request.uri)`, code **301**, cocher « Preserve query string ».
3. Vérifier : `https://les-creations-de-yona.fr/recettes/…` mène à la même recette sur le nouveau domaine.
4. Garder l'ancien domaine et sa redirection **au moins un an** (renouvellement compris).

## 7. Google Search Console, Analytics

1. **Search Console** : ajouter une propriété « Domaine » `nouveau-domaine.fr` (enregistrement TXT chez Cloudflare), y déclarer `https://nouveau-domaine.fr/sitemap.xml`.
2. Dans l'**ancienne** propriété : **Paramètres → Changement d'adresse**, choisir la nouvelle. Google transfère le référencement plus vite (la redirection 301 de l'étape 6 est exigée).
3. **Analytics** : **Administration → Flux de données** → le flux web → modifier l'URL du flux. Même propriété, l'historique est gardé.

## 8. Ailleurs

- Liens vers le site dans les profils des réseaux sociaux (Instagram, TikTok, YouTube, Pinterest…).
- Pinterest : revendiquer le nouveau domaine dans les paramètres du compte, si l'ancien l'était.
- Adresse e-mail de contact si elle est sur le domaine (aujourd'hui non : `CONTACT_EMAIL` dans `legal.ts`).

## 9. Après la bascule

Quelques semaines plus tard, quand la Search Console montre le nouveau domaine indexé :

- retirer les adresses de l'ancien domaine du client OAuth Google (origine et URI de retour) ;
- garder la redirection Cloudflare (voir étape 6).
