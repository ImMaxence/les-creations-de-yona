# Changelog

Les versions du site, front (`front/package.json`) et backend (`back/pom.xml`) montées ensemble, en version sémantique : majeure pour un changement qui casse l'existant, mineure pour des fonctionnalités, correctif pour le reste. Les versions antérieures à 3.1.0 sont résumées dans la roadmap du [ReadMe](ReadMe.md#roadmap).

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
- Nouvelles routes d'API : recettes proches, glossaire, notifications, corbeille, duplication, Google Drive (détail dans le ReadMe).

### À faire au déploiement

1. Google Cloud : activer **Google Drive API**, ajouter l'URI de retour `https://les-creations-de-yona.fr/api/admin/drive/callback` au client OAuth, la portée `drive.file`, et passer l'application **en production** (en mode « Test », l'accès au Drive expire au bout de 7 jours). Détail dans [docs/google.md](docs/google.md).
2. Back-office → Sauvegarde → « Connecter Google Drive », puis « Sauvegarder maintenant ».
3. Vérifier une notification sur Android et sur un iPhone avec l'application installée.

