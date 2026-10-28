# Changelog

Les versions du site, front (`front/package.json`) et backend (`back/pom.xml`) montées ensemble, en version sémantique : majeure pour un changement qui casse l'existant, mineure pour des fonctionnalités, correctif pour le reste (règle complète et fichiers à mettre à jour : [docs/developpement.md](docs/developpement.md#monter-la-version)). Les versions antérieures à 3.1.0 sont résumées dans la [roadmap](docs/roadmap.md).

## 3.8.1 - 2026-10-28

Front 3.8.1, backend 3.8.1. Pas de migration de base.

### Technique

- Documentation : les réseaux d'entreprise. Bot Fight Mode protège le site des robots : on n'ajuste pas cette protection à l'aveugle, on identifie d'abord la règle qui bloque le visiteur (Security → Events).

## 3.8.0 - 2026-10-28

Front 3.8.0, backend 3.8.0. Pas de migration de base.

### Ajouté, dans le back-office

- **« Remplir avec l'IA »** dans l'éditeur de recette : collez le texte d'une recette (notes, message, page recopiée) ou envoyez sa photo (recette manuscrite, capture d'écran), et Gemini, l'IA de Google, remplit le formulaire : titre, portions, temps, ingrédients, étapes (avec leurs durées et leurs ingrédients), matériel, moule, conseil, et des catégories et tags choisis parmi ceux du site. Les ingrédients déjà connus gardent leur nom. **Rien n'est enregistré** : relisez, ajoutez la photo, puis enregistrez comme d'habitude. Un formulaire déjà rempli n'est remplacé qu'après confirmation ; la photo et la publication ne changent pas. Gratuit (offre gratuite de Google).
- Le bouton est grisé, avec la raison, quand il ne peut pas marcher : pas de clé, clé refusée, ou demandes gratuites du jour épuisées (avec l'heure de reprise). Gemini est parfois surchargé : le message dit alors de réessayer dans quelques minutes, et un second modèle est essayé avant d'abandonner.

### Modifié

- **Menus sans photo** : le visuel par défaut, comme une recette sans photo (sur la carte et en haut de la page du menu), au lieu de la photo de leur première recette. Choisissez une photo pour chaque menu dans le back-office.
- Politique de confidentialité : le texte ou la photo d'une recette envoyés à Gemini par un administrateur. Aucune donnée des visiteurs n'y part.

### Technique

- Backend `ai/` : `GET /api/admin/recipe-ai` (état, sans quota), `POST /api/admin/recipe-ai` (multipart `text` et/ou `image`). API REST Gemini (`generateContent`, réponse imposée par un schéma JSON), modèles `gemini-flash-latest` puis `gemini-flash-lite-latest` (`GEMINI_MODELS`), 45 s chacun ; réponse vérifiée champ par champ (`RecipeAiReader`). Variable `GEMINI_API_KEY` (facultative) dans les deux fichiers Docker Compose et `.env.example`. Détail : [docs/ia.md](docs/ia.md).
- 68 tests front, 86 tests backend (aucun n'appelle Google). Parcours Chrome : la vérification « Plus tard » du bandeau d'installation attend le rendu suivant (elle échouait parfois).

## 3.7.0 - 2026-10-28

Front 3.7.0, backend 3.7.0. Migration de base : V13.

### Ajouté, pour les visiteurs

- **Une photo pour chaque menu** : sur sa carte (page Menus, accueil) et en grand en haut de sa page, au-dessus du titre sur téléphone, à côté sur ordinateur. C'est aussi l'image montrée quand le menu est partagé. Sans photo choisie, le menu montre celle de sa première recette, comme avant.

### Ajouté, dans le back-office

- **Menus : choisir une photo** (« Nouvelle photo », « Choisir dans la galerie » ou « Retirer »), enregistrée tout de suite. Pour un nouveau menu, l'éditeur reste ouvert après « Enregistrer » pour lui choisir sa photo. La galerie montre les menus qui affichent une photo, et un filtre « Envoyées pour un menu ». Une photo de menu mise à la corbeille puis restaurée revient sur son menu ; un menu restauré retrouve sa photo.

### Corrigé

- **Hors connexion** : l'application ne restait plus bloquée 30 secondes avant d'afficher une erreur « Forbidden ». Les pages déjà vues s'ouvrent maintenant tout de suite, avec ou sans réseau, même derrière un réseau qui bloque ou répond mal (Wi-Fi sans Internet, réseau d'entreprise). Les menus et les tags restent aussi lisibles hors connexion.
- **« L'application est déjà installée »** : le site le sait aussi depuis le navigateur, une fois l'application installée ou ouverte sur l'appareil (Android, ordinateur), et ne propose plus de la télécharger. Sur iPhone, Safari ne peut toujours pas le savoir.
- **Glossaire du back-office** dans l'ordre alphabétique, le même que la page du site.
- **Google (Search Console)** : les étapes des recettes ont maintenant un nom, une adresse et une image, et les temps de préparation et de cuisson sont toujours donnés quand la recette a un temps. Une recette sans aucun temps reste signalée : la compléter (Statistiques, « Recettes à compléter »).
- Plus de point à la fin de l'aide sous les photos.

### Modifié

- Une nouvelle version du site est prise au changement de page suivant, sans rien faire. Dans le back-office, au prochain rechargement.
- Politique de confidentialité : la mémoire « application installée » gardée dans le navigateur (clé `yona-app-installed`).

### Technique

- Service worker : pages servies depuis l'appareil (`navigationRequestStrategy: performance` au lieu de `freshness`, qui attendait le réseau sans limite et servait telle quelle la réponse d'un proxy), données du site en 3 s au plus au lieu de 4, `/api/menus` et `/api/tags` mis en cache. Mises à jour par `SwUpdate` (`core/pwa/app-updates.ts`). Vérifié dans Chrome : hors connexion, une page déjà vue s'affiche en 60 ms ; derrière un faux proxy (30 s puis 403), en 6 s depuis le cache au lieu de l'erreur.
- Pages rendues par le serveur en `Cache-Control: private, no-cache` : un proxy d'entreprise ne les garde plus. Les erreurs des réseaux d'entreprise (« tunnel connection failed », 504) viennent du proxy : démarches à faire en ligne dans [production](docs/production.md#réseaux-dentreprise).
- Installation : `related_applications` dans le manifeste (`getInstalledRelatedApps`), clé `yona-app-installed`.
- API : `PUT /api/admin/menus/{id}/image` et `…/image-choice` ; `imageId` dans le menu du back-office et la page d'un menu ; `menus` dans les photos de la galerie. Migration V13 : `menu.image_id`, type de photo `MENU` (dossier `menus/`). Fusion d'une sauvegarde : la photo d'un menu suit, si le site l'a.
- JSON-LD des recettes : étapes avec `name`, `text` sans Markdown, `url` (ancre `#etape-2`, `#partie-1-etape-2`, aussi posée sur la page) et `image`.
- Étude « remplir une recette par IA » (Gemini, offre gratuite) : [docs/ia.md](docs/ia.md).
- 66 tests front, 73 tests backend.

## 3.6.0 - 2026-10-28

Front 3.6.0, backend 3.6.0. Pas de migration de base.

### Ajouté, dans le back-office

- **Corbeille : sélection multiple**, comme sur les autres listes. Cases à cocher et « Tout sélectionner » (ce qui est affiché, ou seulement un type : les recettes, les photos…), puis :
  - **Restaurer** : chaque élément revient comme s'il était restauré seul, les photos et les catégories d'abord, pour qu'une recette et sa catégorie restaurées ensemble se retrouvent. Ce qui ne peut pas revenir (catégories disparues, titre de menu déjà pris) reste dans la corbeille, toujours coché, avec la raison dans un message ; le reste est restauré.
  - **Effacer définitivement** la sélection, après confirmation. « Vider la corbeille » efface toujours tout d'un coup.

### Technique

- API : `POST /api/admin/trash/restore?ids=` (chaque élément dans sa transaction, réponse `restored` et `failed`), `DELETE /api/admin/trash/selection?ids=` (tout ou rien) ; 500 éléments au plus.
- Barre de sélection du back-office (`bulk-bar`) : action « Restaurer » facultative.
- Règle des versions écrite dans la documentation ([développement](docs/developpement.md#monter-la-version)) : quand monter la majeure, la mineure ou le correctif, et les fichiers à mettre à jour.
- 71 tests backend.

## 3.5.3 - 2026-10-28

Front 3.5.3, backend 3.5.3. Pas de migration de base.

### Corrigé

- **Liste des recettes du back-office : on reste où on est** en changeant le tri, un filtre ou la recherche, au lieu de remonter en haut de la page. La liste précédente reste affichée, estompée, le temps que la nouvelle arrive. Changer de page ramène toujours en haut, pour lire la nouvelle page depuis le début.

### Technique

- `shared/routing/kept-scroll.ts` : garder la position à travers une navigation qui ne change que les paramètres de l'adresse, partagé avec la page Recettes (nombre par page).

## 3.5.2 - 2026-10-27

Front 3.5.2, backend 3.5.2. Pas de migration de base.

### Corrigé

- **Liste des recettes du back-office vide**, avec le message « Ce tri n'est pas autorisé » : depuis la 3.5.0, la liste demande ses recettes triées (et départagées par leur identifiant), mais le serveur n'acceptait encore que les tris du site public. Tous les tris de la liste marchent de nouveau, dont « Les plus vues ».

### Technique

- Test des tris de la liste du back-office, et de ceux refusés au site public (les vues) : 66 tests backend.

## 3.5.1 - 2026-10-27

Front 3.5.1, backend 3.5.1. Pas de migration de base.

### Modifié

- **Plus de point à la fin des textes**, sur tout le site et dans le back-office : paragraphes, aides, messages, confirmations, erreurs (y compris celles envoyées par le serveur), notification d'une nouvelle recette, descriptions pour Google. Les points entre deux phrases restent. Les mentions légales et la politique de confidentialité ne changent pas.

### Technique

- La règle est écrite dans la documentation ([architecture](docs/architecture.md), « Général »), à suivre pour chaque nouveau texte.

## 3.5.0 - 2026-10-27

Front 3.5.0, backend 3.5.0. Migration de base : V12.

### Ajouté, pour les visiteurs

- **« Télécharger l'application »** : un grand bouton en haut de la page « Installer l'application ». Sur Android et sur ordinateur (Chrome, Edge), un appui ouvre la fenêtre d'installation du navigateur et l'application rejoint l'écran d'accueil. Sur iPhone et iPad, Apple ne laisse aucun site s'installer d'un seul bouton : il affiche les deux gestes à faire dans Safari. Ouverte depuis Instagram, TikTok ou Facebook, la page dit d'abord de passer dans le vrai navigateur, ces applications ne sachant pas installer de site.

### Ajouté, dans le back-office

- **Nombre de vues des recettes** : chaque recette compte ses visites sur le site, une fois par visite. Les visites des admins connectés ne comptent pas. Visible dans la liste des recettes.
- **Statistiques** : « Recettes les plus vues » (les 10 premières, liées à leur page d'édition) et le total des vues.
- **Trier la liste des recettes** : dernières modifiées (comme avant), dernières créées, plus anciennes, titre de A à Z ou de Z à A, les plus vues. Le tri reste dans l'adresse, comme les filtres.
- **La corbeille garde aussi les catégories, les menus et les photos**, 30 jours comme les recettes, avec un filtre par type. Restaurés, ils reviennent à leur place :
  - une recette retrouve ses vues et ses menus (à sa place dans chaque menu qui existe encore et a de la place) ;
  - une catégorie retrouve son nom, son adresse et sa photo ;
  - un menu retrouve ses recettes qui existent encore, dans l'ordre ;
  - une photo revient dans la galerie, et sur les recettes, catégories et « À propos » qui l'affichaient, s'ils n'ont pas reçu d'autre photo entre-temps. Ses fichiers ne sont effacés du stockage qu'avec elle, au bout des 30 jours ou à « Effacer définitivement ».

### Modifié

- Supprimer une catégorie, un menu ou une photo les met à la corbeille, au lieu de les effacer tout de suite.
- Une recette restaurée retrouve aussi une catégorie mise à la corbeille puis restaurée entre-temps (par son adresse).

### Technique

- API : `POST /api/recipes/{slug}/views` (public, sans jeton CSRF), `/api/admin/trash` (remplace `/api/admin/recipe-trash` ; `GET …/{id}/image` pour une photo à la corbeille), tri `createdAt`, `viewCount` et `id` sur `/api/admin/recipes`, champs `createdAt` et `viewCount` des recettes du back-office, `mostViewedRecipes`, `recipes.views` et `trashedItems` (au lieu de `trashedRecipes`) dans les statistiques.
- Migration V12 : colonne `recipe.view_count` ; la table `recipe_trash` devient `trash_item`, avec le type (`kind`), les emplacements à rendre (`links`) et les vues.
- Politique de confidentialité : le comptage des vues (anonyme, sans cookie).
- Tests : 64 tests backend, 63 tests front.

## 3.4.0 - 2026-10-27

Front 3.4.0, backend 3.4.0. Migration de base : V11.

### Ajouté, pour les visiteurs

- **Menus** : des recettes réunies pour une occasion (« Menu de Noël », « Goûter d'anniversaire »), sur une page à elles, avec « Tout ajouter à ma liste de courses ». Une page « Menus », « Nos menus » sur l'accueil et « Menus » dans la barre du haut, dès qu'un menu est publié.
- **Les minuteurs survivent à un rechargement** : si la page est rechargée, ou fermée par le téléphone en arrière-plan (fréquent sur iPhone), les minuteurs sont retrouvés à l'heure. Le téléphone ne laisse sonner qu'après un appui : « Touchez pour réactiver la sonnerie » le rappelle.

### Ajouté, dans le back-office

- Page **Menus** : titre, présentation, recettes dans l'ordre voulu (12 au plus), publié ou non.

### Corrigé

- Accessibilité : l'en-tête du site est reconnu comme tel par les lecteurs d'écran, les titres de la page Recettes se suivent dans l'ordre, le champ « Mes notes » a une vraie étiquette.

### Technique

- Parcours dans Chrome : l'accessibilité de chaque page publique vérifiée par axe, et la vitesse et la qualité par Lighthouse (seuils : performance 70, accessibilité 100, bonnes pratiques 95, SEO 100) ; 56 vérifications.
- Pages et API compressées par la passerelle (moins de données entre le serveur et Cloudflare, et une mesure locale fidèle).
- API : `GET /api/menus`, `GET /api/menus/{slug}`, `/api/admin/menus`.

## 3.3.0 - 2026-10-27

Front 3.3.0, backend 3.3.0. Migration de base : V10.

### Ajouté, pour les visiteurs

- **Les minuteurs ne se perdent plus** : ils continuent en allant voir une autre recette ou une autre page du site. Une barre en bas de chaque page les montre, avec « Reprendre » qui ramène à la recette, au bon endroit ; quand l'un sonne, « + 1 min » et « Arrêter » sont là aussi.
- **Minuteur libre** dans le mode cuisine, pour les étapes sans durée (« Laisser refroidir », « Réserver au frais ») : on choisit les minutes avec − et +, même sonnerie.
- **Liste de courses rangée par rayon** : fruits et légumes, crèmerie, épicerie sucrée… dans l'ordre d'un passage au magasin. Les listes déjà faites se rangent aussi dès qu'un rayon est choisi.
- **Matériel nécessaire** sur la recette (moule, fouet, poche à douille…), sous les ingrédients, et à cocher dans la « Mise en place » du mode cuisine.

### Ajouté, dans le back-office

- Éditeur de recette : champ **Matériel**, un ustensile par ligne.
- Page **Ingrédients** : le **rayon** de chaque ingrédient, choisi dans sa ligne ou pour toute une sélection, un filtre par rayon et le nombre d'ingrédients encore « sans rayon ».

### Corrigé

- Une adresse mal écrite (envoyée par un robot, le plus souvent) n'est plus notée comme une erreur du serveur.

### Technique

- Parcours dans Chrome gardé dans le projet (`e2e/`, `npm test`) : 37 vérifications sur le site lancé en local, avant chaque mise en ligne ; `npm run captures` refait les captures d'écran du ReadMe.
- Documentation découpée : un ReadMe court, avec des captures d'écran, et le détail dans `docs/` (fonctionnalités, développement, production, architecture, roadmap).
- Licence MIT pour le code (`LICENSE`) ; les contenus du site (recettes, photos, textes) restent à leur autrice.
- API : `GET /api/ingredients/aisles`, `PUT /api/admin/ingredients/aisle`, champ `equipment` des recettes ; réponse 400 à une adresse que le serveur ne sait pas décoder (c'était une erreur 500).

## 3.2.0 - 2026-10-27

Front 3.2.0 (dont les retours publiés en front 3.1.1), backend 3.2.0. Pas de migration de base.

### Ajouté, pour les visiteurs

- **« Qu'est-ce que je peux faire avec… »** : recherche avec plusieurs ingrédients à la fois (5 au plus), ajoutés un par un en puces ; seules les recettes qui les ont tous sortent.
- **Mes notes** sur chaque recette (« 10 min de plus dans mon four »), gardées dans le navigateur seulement, sans compte, et rappelées dans le mode cuisine.
- **Mode cuisine** :
  - écran **« Mise en place »** avant la première étape : tous les ingrédients à cocher une fois sortis et pesés ;
  - **« + 1 min »** quand le minuteur sonne : le gâteau pas tout à fait cuit, il repart pour une minute sans tout remettre à zéro ;
  - les minuteurs continuent **une fois le mode fermé** : une barre en bas de la recette les montre, avec « Reprendre », puis « + 1 min » et « Arrêter » quand ils sonnent ;
  - vibration légère et saccadée au rythme de la sonnerie (Android).
- **Bandeau d'installation** de l'application, seulement quand le navigateur peut l'installer tout de suite ; « Plus tard » le cache un mois.
- Accueil : encart « Ne ratez aucune nouvelle recette » avec le bouton des notifications mis en avant.

### Ajouté, dans le back-office

- Page **Nouveautés** : ce journal des versions, en lecture seule, une section dépliable par version (la dernière ouverte), pour voir ce qui a changé sur le site à chaque mise à jour (aussi depuis le lien à côté des versions, en haut du back-office).

### Modifié

- Accueil : les dernières recettes juste sous la recette à la une, « À propos » et les notifications après.
- « Installer l'application » quitte la navbar pour le pied de page (toujours dans le menu mobile).
- Politique de confidentialité : notes et choix « Plus tard » du bandeau d'installation, gardés dans le navigateur.
- API : `GET /api/recipes` accepte `ingredient` répété (tous exigés) ; un seul `ingredient` marche comme avant.

### Corrigé

- Mode cuisine : un minuteur d'une minute affichait d'abord 1:01 (et la reprise après une pause quelques secondes de trop) ; il part bien de 1:00.

### Technique

- Tests unitaires : front avec Vitest (`npm test`), backend avec JUnit 5, AssertJ et Mockito (`./mvnw test`). Voir « Décisions » dans [docs/architecture.md](docs/architecture.md) pour ce qu'ils couvrent.

## 3.1.0 - 2026-10-26

Front 3.1.0, backend 3.1.0. Migration de base : V9.

### Ajouté, pour les visiteurs

- **Notifications des nouvelles recettes** (Web Push) : bouton « Me prévenir des nouvelles recettes » dans le pied de page et sur la page « Installer l'application ». Une notification à chaque recette publiée pour la première fois, même site fermé ; un appui ouvre la recette. Sur iPhone et iPad, dans l'application installée seulement (iOS 16.4+).
- **Adapter la recette à son moule** : le visiteur indique son moule (rond, carré ou rectangle, en cm) et les quantités suivent sa surface, avec le facteur (« × 1,44 ») et les portions approximatives.
- **Organiser mon temps** : « Je commence à 14 h » donne « Prête vers 15 h 30 », « Je veux servir à 19 h » donne l'heure où commencer, repos compris.
- **Temps de repos** (pousse, prise au froid…) affiché avec la préparation et la cuisson, et compté dans le temps total et le filtre « temps ».
- **Le conseil de Yona** : encadré facultatif après les étapes (astuce, conservation, variante).
- **Vous aimerez aussi** : 3 recettes proches en bas de chaque recette (mêmes tags, puis mêmes catégories).
- **Glossaire de pâtisserie** : page `/glossaire` (mots par lettre, données structurées pour Google), et mots soulignés dans les étapes, avec leur définition au toucher.
- **Mode cuisine** :
  - ingrédients de l'étape affichés avec elle, quand la recette les indique ;
  - sonnerie de fin de minuteur fiable : programmée dès le lancement, elle sonne à l'heure même si le téléphone ralentit la page, passe outre le mode silencieux de l'iPhone, et se répète 30 secondes jusqu'à « Arrêter la sonnerie » ;
  - « Commencé à… · prête vers… » en haut de l'écran.
- Cartes de recettes datées de leur publication, listes triées de la plus récemment publiée à la plus ancienne.

### Ajouté, dans le back-office

- **Corbeille** : une recette supprimée y reste 30 jours, restaurable d'un clic telle qu'elle était (même adresse, mêmes dates, ses photos), puis effacée automatiquement.
- **Publication programmée** : « publier samedi à 10 h » pour un brouillon ; publié à la minute près, abonnés prévenus.
- **Dupliquer une recette** (éditeur et liste), pour partir d'une recette proche.
- **Brouillon gardé automatiquement** dans le navigateur : rien n'est perdu si l'onglet se ferme ou si le téléphone se met en veille ; « Reprendre » ou « Ignorer » à la réouverture.
- **Sauvegarde automatique sur Google Drive** : chaque nuit vers 3 h, les 7 dernières gardées ; « Sauvegarder maintenant », état de la dernière sauvegarde.
- Éditeur : temps de repos, moule, « Le conseil de Yona », ingrédients utilisés par chaque étape.
- Page **Glossaire** : mots, définitions et autres formes (verbes conjugués, pluriels), avec proposition automatique des formes courantes.
- Statistiques : publications programmées, recettes dans la corbeille, mots du glossaire, abonnés aux notifications.
- Restauration d'une sauvegarde : glossaire et ingrédients des étapes pris en compte.

### Modifié

- Supprimer une recette la met à la corbeille au lieu de l'effacer.
- Recette à la une par défaut et « 3 dernières recettes » de l'accueil : les dernières **publiées** (et non plus créées).
- Politique de confidentialité : notifications et sauvegardes Google Drive.
- Sauvegardes : les abonnements aux notifications, les clés des notifications et le compte Google Drive n'y figurent pas, et une restauration n'y touche jamais.

### Technique

- **Icônes intégrées au site** à la place de la bibliothèque `@lucide/angular` : seules les 91 icônes utilisées. JavaScript du premier chargement de 730 à 505 Ko bruts (bundle principal de 448 à 223 Ko), nouvelles fonctionnalités comprises ; poids transféré quasi inchangé (135 → 133 Ko compressés).
- Web Push sans dépendance : chiffrement RFC 8291 et signature VAPID RFC 8292 avec le JDK, vérifiés contre une implémentation indépendante. Clés VAPID créées en base au premier démarrage.
- Nouvelles routes d'API : recettes proches, glossaire, notifications, corbeille, duplication, Google Drive (détail dans [docs/developpement.md](docs/developpement.md)).

### À faire au déploiement

1. Google Cloud : activer **Google Drive API**, ajouter l'URI de retour `https://les-creations-de-yona.fr/api/admin/drive/callback` au client OAuth, la portée `drive.file`, et passer l'application **en production** (en mode « Test », l'accès au Drive expire au bout de 7 jours). Détail dans [docs/google.md](docs/google.md).
2. Back-office → Sauvegarde → « Connecter Google Drive », puis « Sauvegarder maintenant ».
3. Vérifier une notification sur Android et sur un iPhone avec l'application installée.

