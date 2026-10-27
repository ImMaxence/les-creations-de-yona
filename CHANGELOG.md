# Changelog

Les versions du site, front (`front/package.json`) et backend (`back/pom.xml`) montées ensemble, en version sémantique : majeure pour un changement qui casse l'existant, mineure pour des fonctionnalités, correctif pour le reste. Les versions antérieures à 3.1.0 sont résumées dans la [roadmap](docs/roadmap.md).

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

