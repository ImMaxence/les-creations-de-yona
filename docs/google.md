# Services Google : connexion admin, Google Drive, Analytics, Search Console

Tout ce que le site attend de Google, et comment le régler. L'interface de la console Google change souvent : les noms de menus ci-dessous sont ceux d'octobre 2026 ; en cas de doute, la barre de recherche en haut de la console retrouve chaque page par son nom.

## Le projet Google Cloud

| | |
| --- | --- |
| Console | https://console.cloud.google.com |
| Nom affiché | « My Maps Project » (nom d'un ancien test, sans importance ; modifiable dans **IAM et administration → Paramètres**) |
| Numéro du projet | `894227614182` |
| ID du projet | `august-ensign-394808` |
| Client OAuth | `894227614182-d19k….apps.googleusercontent.com` (valeur complète dans les variables Coolify) |

Pour reconnaître le bon projet : l'identifiant du client OAuth commence toujours par le **numéro du projet**. Si `GOOGLE_CLIENT_ID` commence par `894227614182-`, c'est ce projet.

Un seul projet et un seul client OAuth servent au local et à la production, pour deux usages :

- la **connexion au back-office** (portées `openid`, `email`, `profile`) ;
- la **sauvegarde de nuit sur Google Drive** (portées `openid`, `email`, `drive.file`).

## 1. Client OAuth (connexion admin)

Menu **Google Auth Platform** (anciennement « API et services → Identifiants » et « Écran de consentement OAuth »).

### Branding

- Nom de l'application : « Les créations de Yona », affiché sur la page de connexion de Google.
- Adresse e-mail d'assistance et du développeur : une adresse des admins.
- Domaine autorisé : `les-creations-de-yona.fr`.

### Clients

Un client de type **Application Web**. Il donne `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.

**Origines JavaScript autorisées** :

```
https://les-creations-de-yona.fr
```

**URI de redirection autorisés**, à l'identique (`localhost` et `127.0.0.1` sont différents pour Google) :

```
https://les-creations-de-yona.fr/api/login/oauth2/code/google
https://les-creations-de-yona.fr/api/admin/drive/callback
http://localhost:8000/api/login/oauth2/code/google
http://localhost:8000/api/admin/drive/callback
http://localhost:4200/api/login/oauth2/code/google
http://localhost:4200/api/admin/drive/callback
http://localhost:8080/api/login/oauth2/code/google
http://localhost:8080/api/admin/drive/callback
```

- `…/login/oauth2/code/google` : retour de la connexion admin.
- `…/admin/drive/callback` : retour de « Connecter Google Drive ».
- 8000 : application complète dans Docker ; 4200 : `npm start` ; 8080 : backend seul.

Une modification peut mettre quelques minutes à s'appliquer.

Le **secret** n'est affiché qu'à sa création. Pour en changer : **Clients** → le client → **Ajouter un secret**, le mettre dans Coolify (`GOOGLE_CLIENT_SECRET`) et dans `devops/.env`, redéployer, puis désactiver l'ancien. Après un changement de secret, reconnecter Google Drive (le jeton du Drive est lié au secret).

### Audience

- Type d'utilisateur : **Externe**.
- État de publication : **En production**. En mode « Test », seuls les « utilisateurs test » listés peuvent se connecter, et Google fait expirer l'accès au Drive au bout de 7 jours : les sauvegardes de nuit s'arrêteraient.
- Publier ne donne accès à rien : n'importe qui peut atteindre la page de connexion de Google, mais le site refuse toute adresse absente de `APP_ADMIN_EMAILS` (page « Accès refusé »).
- Avec les seules portées `openid`, `email`, `profile` et `drive.file` (dites « non sensibles »), Google ne demande aucune validation de l'application.

### Accès aux données

Portées déclarées :

| Portée | Pour |
| --- | --- |
| `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` | Connexion admin : adresse et nom |
| `.../auth/drive.file` | Sauvegardes : le site ne voit et ne modifie que les fichiers qu'il a créés lui-même, rien d'autre du Drive |

### Ajouter ou retirer un admin

Rien à faire chez Google : c'est la variable `APP_ADMIN_EMAILS` (adresses séparées par des virgules) dans Coolify, puis redéploiement. En local : `devops/.env`.

## 2. Sauvegarde de nuit sur Google Drive

### Comment ça marche

- Un seul Drive pour tout le site, pas un par admin. Celui qui clique sur « Connecter Google Drive » choisit sur la page de Google **le compte qui reçoit les sauvegardes** : le sien, celui de Yona, ou un compte dédié.
- Chaque nuit vers 3 h (heure de Paris), le backend envoie la même archive que « Sauvegarder mes données » dans le dossier **« Les créations de Yona · sauvegardes »** de ce Drive. Les 7 plus récentes sont gardées, les plus anciennes supprimées.
- L'autre admin voit le compte connecté et la dernière sauvegarde, et peut « Sauvegarder maintenant » ou « Déconnecter ».
- Connecter un autre compte remplace le premier. Les sauvegardes déjà faites restent dans l'ancien Drive.
- Pour qu'un autre compte voie les sauvegardes : partager le dossier depuis Google Drive (clic droit → Partager). Les fichiers restent comptés sur l'espace du propriétaire.
- Place prise : 7 × (base + toutes les photos). Le poids des photos est sur la page Statistiques du back-office. 15 Go gratuits par compte Google, partagés avec Gmail et Photos.
- Le jeton durable (refresh token) est gardé en base (`google_drive_link`), jamais dans les sauvegardes. Seul, il ne sert à rien : il faut aussi le secret du client OAuth, qui n'est que dans l'environnement. « Déconnecter » le retire aussi chez Google.

### Mise en place (une fois)

1. **API et services → Bibliothèque** : chercher **Google Drive API** → **Activer**.
2. **Google Auth Platform → Clients** : vérifier les URI `…/api/admin/drive/callback` (voir plus haut).
3. **Google Auth Platform → Accès aux données** : « Ajouter ou supprimer des niveaux d'accès », chercher `drive.file`, cocher `.../auth/drive.file`, **Mettre à jour**, puis **Enregistrer**.
4. **Google Auth Platform → Audience** : **Publier l'application** (passage « En production »).
5. Back-office → **Sauvegarde** → **Connecter Google Drive** → choisir le compte → laisser **cochée** la case Google Drive → Continuer. Retour sur la page avec « Google Drive connecté ».
6. **Sauvegarder maintenant**, attendre quelques minutes, vérifier le dossier dans Google Drive.

### Problèmes courants

| Message | Cause et solution |
| --- | --- |
| `Erreur 400 : redirect_uri_mismatch` | L'URI de retour n'est pas dans le client OAuth, ou pas à l'identique. « Détails de l'erreur » sur la page de Google montre l'adresse envoyée : l'ajouter telle quelle. |
| « L'accès à Google Drive n'a pas été autorisé » | La case Google Drive a été décochée sur la page de Google : recommencer en la laissant cochée. |
| « Accès bloqué : l'application n'a pas terminé la procédure de validation » | Application encore « En test » et compte absent des utilisateurs test : publier l'application (étape 4). |
| « L'accès à Google Drive a été retiré ou a expiré : reconnectez le compte » | Accès retiré depuis le compte Google (Sécurité → Applications tierces), secret OAuth changé, ou application restée « En test » plus de 7 jours : reconnecter. |
| « Impossible de … sur Google Drive (erreur 403) » | Drive plein le plus souvent : libérer de la place ou changer de compte. |
| « La sauvegarde n'a pas pu être préparée sur le serveur » | Côté serveur (espace disque, base) : voir les journaux du backend dans Coolify. |

Un échec est affiché dans le back-office, et un nouvel essai a lieu automatiquement la nuit suivante.

## 3. Google Analytics 4

- https://analytics.google.com, propriété `G-914Y0MV42H`, écrite dans `front/src/app/core/analytics/analytics.ts`, qui ne mesure que les domaines de `MEASURED_HOSTS`.
- Chargé seulement après accord du visiteur (bandeau cookies).
- **Administration → Flux de données** : l'URL du flux est celle du site. **Mesure améliorée** : « Changements de page basés sur les événements de l'historique du navigateur » doit rester **désactivé**, sinon chaque page est comptée deux fois.
- Vérifier : **Rapports → Temps réel** montre une visite dans la minute (autre navigateur, cookies acceptés, sans bloqueur de publicité).

## 4. Google Search Console

- https://search.google.com/search-console, propriété « Domaine » `les-creations-de-yona.fr` (validée par un enregistrement DNS TXT chez Cloudflare).
- **Sitemaps** : `https://les-creations-de-yona.fr/sitemap.xml`, état « Opération effectuée ».
- **Pages** : les exclusions par `noindex` (favoris, liste de courses, recherches filtrées, back-office) sont voulues. Les 404 sont des recettes supprimées ou d'anciennes adresses : sans gravité.
- **Inspection de l'URL** sur une recette, puis « Tester l'URL en ligne » : page indexable, recette détectée.
- Test des données structurées : https://search.google.com/test/rich-results.
