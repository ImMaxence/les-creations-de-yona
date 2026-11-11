# Changelog

Le front et le backend partagent un seul numéro de version (versionnage sémantique : la majeure casse l'existant, la mineure ajoute des fonctionnalités, le correctif corrige). Comment publier une version : [docs/developpement.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/developpement.md#monter-la-version). Les versions d'avant la 1.1.0 sont résumées dans la [roadmap](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/roadmap.md)

## 2.8.0 - 2026-11-12

Front et backend 2.8.0. Migration de la base : V25 et V26

### Ajouté

- **Messages** : une page pour s'écrire entre admins, tous dans le même groupe, avec « @ » pour citer une recette, un article, un menu, une catégorie, un ingrédient, un mot du glossaire, un produit ou une commande (un lien vers sa page) ; un badge des messages non lus, en temps réel ; gardés 90 jours
- **Sauvegarde** : les messages entre admins y sont, et reviennent avec « Ajouter ce qui manque » comme avec « Tout remplacer »
- **Back-office en temps réel** : les badges du menu changent aussitôt, sans changer de page, quand un autre admin, un visiteur ou le site agit ; Historique, Corbeille, Retours et Journaux se mettent à jour d'eux-mêmes quand ils sont ouverts
- **Corbeille** : un badge compte ce que les autres admins y ont mis depuis votre dernière visite (comme Historique, vos propres actions ne comptent pas)
- **Mon CAP** : des statuts en couleur comme pour les recettes (Brouillon, Programmé, Publié, Échec) et une publication programmée, faite par le site à l'heure dite ; une sauvegarde restaurée ne publie jamais un article par surprise (sans sa date, ou en échec si l'heure est passée)
- **Mon CAP** : « Dupliquer » un article, depuis la liste ou l'éditeur (un brouillon « … (copie) » avec le même contenu et les mêmes photos)
- **Mon CAP** : un lien vers un autre article dans le texte, avec le bouton « Article » à côté de « Recette »
- **Aperçu d'une recette** : sur ordinateur ou dans un téléphone, comme pour les articles ; l'écran choisi est retenu pour le prochain aperçu

### Modifié

- **Éditeur de Mon CAP** : la même barre du bas que pour les recettes (Retour, Aperçu, Enregistrer le brouillon, Publier), sans l'ombre qui bavait ; le statut et la programmation rejoignent le haut de l'article
- **Aperçus** : les boutons Ordinateur et Téléphone s'éloignent du haut de la fenêtre, en pilule qui glisse

### Corrigé

- **Listes déroulantes et suggestions** : elles passent au-dessus des fenêtres et des encarts au lieu d'être coupées (lien vers une recette, par exemple)
- **Mon CAP** : les boutons de mise en forme (Intertitre, Gras, Liste, Recette) gardent leur taille à côté d'une photo
- **Historique** : l'étiquette du type (« Recette ») ne colle plus au titre

### Technique

- **WebSocket** `/api/admin/live`, réservé aux admins et au site lui-même : il ne dit que le nom du badge qui a changé, chaque admin redemande ses propres nombres
- **Composants partagés** : barre d'éditeur, cadre d'aperçu, statut de publication, recherche par titre, listes flottantes (`yonaFloating`), style des pilules (`styles/_segmented.scss`)
- **Parcours e2e** : le back-office simulé répond aussi pour l'IA de Mon CAP, la Corbeille et le temps réel ; trois vérifications remises à jour (21 sections dans le menu depuis Journaux, voile de la page en cours du menu téléphone qui déborde exprès dans les marges depuis la 2.5.2)

## 2.7.4 - 2026-11-11

Front et backend 2.7.4. Pas de migration de la base

### Modifié

- **Choix en pilule** : la pastille du choix glisse d'une option à l'autre (Tout, Sucré, Salé ; Clair, Auto, Sombre ; période et lignes de la comptabilité ; style et forme des articles de Mon CAP ; photos de la galerie ; appareil de la page d'installation)

### Corrigé

- **Menu du back-office replié** : la page prend la place libérée par le menu au lieu de rétrécir sur un grand écran
- **Menu du back-office** : le survol du bouton pour le replier n'est plus coupé par le bord du menu
- **Comptabilité** : le graphique garde des chiffres et des mois à leur taille sur un grand écran (ils grossissaient avec la page) ; les mois en initiales sur téléphone, les barres sans se chevaucher
- **Comptabilité** : « 1 € » n'apparaît plus deux fois sur l'échelle d'une année encore vide (0 €, 0,5 €, 1 €)

## 2.7.3 - 2026-11-11

Front et backend 2.7.3. Pas de migration de la base

### Modifié

- **Chargements du back-office** : plus de formes grises qui clignotent ; elles n'apparaissent que si la réponse met plus d'une demi-seconde, sinon la page attend sans rien montrer
- **Menu du back-office** : il se replie et se déplie plus doucement, la page suit au même rythme, et son bouton devient deux chevrons qui se retournent ; replié, « Retour au site » est une maison, pour ne pas le confondre avec lui
- **Apparence** : « Personnalisé » mis en avant (fond teinté, contour en pointillés, « Mes propres couleurs ») ; une icône de coin arrondi pour « Arrondi des coins », à la place du carré pris pour une case à cocher

### Corrigé

- **Accordéons** (Apparence, Statistiques) : une liste déroulante ouverte n'est plus coupée par le bord de son encart, ni le contour du thème choisi
- **Accordéons** : un espace sous le titre, dont le survol ne se mélange plus avec les encarts du dessous
- **Produits** : « La boutique » ne montre plus « Fermée » un instant avant le vrai choix ; rien n'est coché tant que la réponse n'est pas arrivée

## 2.7.2 - 2026-11-11

Front et backend 2.7.2. Pas de migration de la base

### Ajouté

- **Dicter** : un spectre audio en direct pendant l'enregistrement, qui bouge avec la voix, pour voir que le micro entend bien
- **Dicter** : un message si le micro ne capte rien pendant 3 secondes (débranché, coupé ou mauvais micro choisi)

## 2.7.1 - 2026-11-11

Front et backend 2.7.1. Pas de migration de la base

### Corrigé

- **Fenêtres** : la page ne s'élargit plus puis ne se resserre plus à l'ouverture et à la fermeture d'une fenêtre (sur ordinateur Windows) : la place de la barre de défilement reste réservée, assombrie comme la page tant que la fenêtre est ouverte
- **Dicter** : le micro n'est plus refusé d'office ; le site avait interdit son usage à toutes les pages, il l'autorise maintenant pour lui-même (le navigateur demande toujours la permission)

## 2.7.0 - 2026-11-11

Front et backend 2.7.0. Deux migrations de la base (V23, V24), appliquées au démarrage. Claude : variable `ANTHROPIC_API_KEY` à ajouter dans Coolify (facultative)

### Ajouté

- **Mon CAP** : « Écrire avec l'IA » dans un article, à partir de notes tapées, dictées ou en photo : titre, sous-titre et blocs proposés (récit, pas à pas ou carnet), les photos déjà placées gardées ; quatre exemples de notes d'un clic ; aussi depuis « Nouvel article »
- **Claude d'Anthropic** : troisième IA au choix dans « Remplir avec l'IA » et « Écrire avec l'IA », à côté de Gemini et de l'IA locale (payée à l'usage)
- **Logos des IA** : chaque choix montre la marque de qui fait le travail (Gemini, Claude, Google, OpenAI)
- **Dictée** : « Dicter » dans les deux fenêtres de l'IA ; Whisper d'OpenAI écrit ce que vous dites, sur l'ordinateur, puis l'IA choisie s'en sert
- **Journaux** : une page du back-office avec les erreurs et avertissements du serveur et des navigateurs des visiteurs, regroupés et comptés, et un badge dans le menu pour les nouvelles erreurs
- **Statistiques** : un encart « Versions et santé » (versions du site et de l'API, base de données, stockage des photos, Spring Boot et Java, depuis quand le serveur tourne, erreurs du jour)
- **Statistiques** : l'historique de la mémoire et du processeur sur 7, 30 ou 90 jours, mesuré toutes les 10 minutes
- **Historique** : ce que les autres ont fait depuis votre dernière visite marqué « Nouveau », et compté dans un badge du menu
- **Nouveautés** : un badge « Nouveau » dans le menu tant que la version en ligne n'a pas été lue
- **Apparence** : des couleurs personnalisées (fond, cartes, texte, accent, en clair et en sombre), avec une alerte si le texte devient difficile à lire
- **Apparence** : 12 nouvelles polices (Bricolage Grotesque, Newsreader, Shantell Sans, Grandstander, Imbue, Playpen Sans, Raleway, Rubik, Outfit, Figtree, Crimson Pro, Bitter)
- **Menu du back-office** : un bouton en haut pour le replier en colonne d'icônes sur ordinateur, retenu d'une visite à l'autre
- **Chargements** : des skeletons partout à la place de « Chargement… » (listes, galerie, statistiques, formulaires), une page grise le temps qu'arrive une page lente du site, et les photos qui respirent avant d'apparaître
- **SEO de Mon CAP** : chaque article dans llms.txt avec son résumé, leur texte entier dans llms-full.txt, et des données structurées plus riches (Blog, sujet, mots-clés, longueur)

### Modifié

- **Statistiques** : les encarts en accordéons (Versions et santé, Serveur, Recettes, À faire, Visiteurs), chacun retenu ouvert ou fermé
- **Apparence** : Mes préréglages, Couleurs, Polices et Arrondi en accordéons, le choix actuel dans leur titre ; chaque police montrée dans son propre style dans la liste
- **Filtres des statuts** : Publiées, Programmées, Brouillons et En échec aux couleurs de leurs badges (recettes et commandes)
- **Listes déroulantes** : aussi larges que leur choix le plus long, sans texte coupé, et ouvertes vers la gauche au bord de l'écran
- **Menu du site sur ordinateur** : une pastille douce au survol des liens, à la place du trait qui glissait
- **Accueil** : Sucré avant Salé dans les dernières recettes
- **Pages légales** : les nouvelles polices, Claude et Whisper dans les crédits ; la politique de confidentialité parle de Claude, de la dictée et du journal des erreurs des navigateurs

### Technique

- **Claude** : SDK Java officiel d'Anthropic, réponses au format JSON imposé, modèle réglable (`CLAUDE_MODEL`, Claude Haiku 5.5 par défaut : rapide et peu cher, assez pour ranger un texte)
- **Journaux** : un appender Logback garde les WARN et ERROR, écrits en base toutes les 20 secondes, 30 jours et 2 000 lignes au plus ; les navigateurs envoient leurs erreurs (30 par minute au plus pour tout le site)
- **Base** : tables `admin_seen` (ce que chaque admin a vu), `app_log` (journal) et `server_sample` (mémoire et processeur, 90 jours) ; thème « Personnalisé » et nouvelles polices

## 2.6.1 - 2026-11-11

Front et backend 2.6.1. Pas de migration de la base

### Technique

- **Backend** : la JVM sur ses réglages par défaut, sans les limites des versions 1.12 et 1.13 (compilateur C1 seul, 2 cœurs) ; plus rapide à plein régime ; mémoire Java limitée à 512 Mo (256 Mo avant)
- **Base de données et serveur web** : 10 connexions à la base et 200 threads Tomcat au plus, les valeurs par défaut (5 et 40 avant)

## 2.6.0 - 2026-11-11

Front et backend 2.6.0. Pas de migration de la base

### Modifié

- **Site dans le navigateur** : plus rien n'est gardé sur l'appareil, chaque page vient du serveur et est toujours à jour, sans « Une nouvelle version du site est prête » à chaque mise en ligne
- **Hors connexion** : réservé à l'application installée (et aux appareils qui reçoivent les notifications) ; l'installation se propose toujours depuis le navigateur
- **Notifications** : depuis le navigateur, la demande d'autorisation arrive dès l'appui sur « Me prévenir »
- **Politique de confidentialité** : la copie des pages sur l'appareil concerne l'application installée et les notifications, plus le simple navigateur

### Corrigé

- **Menu téléphone** : la fermeture de Catégories est fluide, sans lignes coupées qui traînent ni saut du menu
- **Installer l'application** : l'icône de « L'application est déjà installée » garde sa taille sur téléphone

### Technique

- **Service worker** : enregistré seulement pour l'application installée et les notifications ; celui déjà installé dans un onglet est retiré, avec ses copies

## 2.5.2 - 2026-11-11

Front et backend 2.5.2. Pas de migration de la base

### Corrigé

- **Vous aimerez aussi** : les cartes ne débordent plus de l'écran sur téléphone quand une catégorie a un nom long
- **Menu sur les pages recette** : le bouton du menu ne sort plus de l'écran sur téléphone
- **Menu téléphone** : la page en cours est alignée sur les autres lignes, sans le trait de la ligne du dessus

## 2.5.1 - 2026-11-10

Front et backend 2.5.1. Pas de migration de la base

### Ajouté

- **Paramètres par défaut** : un bouton dans le menu Clair / Sombre et sur la page Accessibilité remet le site comme il vient (taille du texte, contraste, animations, police, liens, espacement, et clair ou sombre selon l'appareil)

### Modifié

- **Icône de l'accessibilité** : le symbole universel, une personne bras ouverts dans un cercle, à la place de l'icône qui se lisait comme un fauteuil roulant
- **Menu Clair / Sombre** : « Accessibilité » à la place de « Plus de réglages »
- **Nouveautés** : le CHANGELOG entièrement réécrit en français, avec les rubriques Ajouté, Modifié, Corrigé, Retiré et Technique

## 2.5.0 - 2026-11-10

Front et backend 2.5.0. Pas de migration de la base

### Ajouté

- **Page Accessibilité** : taille du texte, contraste renforcé, moins d'animations, police simple, liens soulignés, texte espacé, clair ou sombre ; appliqués tout de suite sur toutes les pages et gardés dans le navigateur
- **Déclaration d'accessibilité** : une page légale sur le modèle du RGAA (état de conformité, vérifications faites, limites connues, contact, voies de recours), liée depuis le pied de page
- **Infobulles** : les icônes de la barre du haut (recherche, favoris, liste de courses, affichage) et toute icône sans texte montrent leur nom au survol ou au clavier
- **Nouveautés** : les versions rangées sous Version 2 et Version 1 ; chaque version en tableau, une pastille de couleur par type de changement (Ajouté, Modifié, Corrigé, Retiré, Technique)

### Modifié

- **Menu téléphone** : la page en cours sur un voile clair dans les marges, plus d'espace sous la recherche et entre les pages et les sections
- **Sections du menu téléphone** : le + devient × sur place, sans glisser ; une section se déplie là où elle est, sans faire défiler le menu
- **Bouton de fermeture du menu téléphone** : plus de cercle autour de la croix
- **Menu Clair / Sombre** : « Plus de réglages » mène à la page Accessibilité

### Technique

- Réglages d'affichage écrits sur `<html>` avant le premier affichage (script en ligne de `index.html`), comme le choix clair ou sombre
- Tests : 287 front, 326 backend, 212 vérifications dans Chrome, dont les infobulles, le menu téléphone, la page Accessibilité et sa déclaration, et l'affichage à 320 px

## 2.4.0 - 2026-11-10

Front et backend 2.4.0. Migrations de la base : V21, V22

### Ajouté

- **Mon CAP en articles** : la frise montre un aperçu de chaque article (photo, titre, sous-titre, premières lignes, « Lire la suite »), toute la carte ouvre sa page, `/mon-cap/<titre>`
- **Page d'un article** : date, titre et sous-titre au-dessus de la grande photo, puis les blocs : texte, grande photo, photo + texte (à gauche ou à droite), étapes en photos, astuce. Le texte en colonne étroite ; chaque photo s'ouvre en grand
- **Éditeur d'articles** : partir d'un modèle (Récit, Pas à pas, Carnet, Vide) ; déplacer, dupliquer, supprimer ou ajouter des blocs avec « + » ; boutons de mise en forme et liens vers les recettes ; style Classique ou Carnet ; aperçu ordinateur et téléphone ; sous-titre ; « Coup de cœur »
- **Accueil** : « À propos », les notifications et le dernier article (ou le « Coup de cœur ») dans un cadre dessiné par quatre coins
- **Boutique** : des produits avec leur propre nom et leur photo, vendus à l'unité ou par lot (prix à la pièce affiché), prix TTC ; des produits sans recette ; recherche, filtres par catégorie, grille compacte
- **Demande de la boutique** : « Ma demande » dans un volet sur ordinateur, une barre fixée en bas sur téléphone, gardée en quittant la page ; une demande peut se faire par le seul message
- **Position de la boutique** : fermée, pour les proches (bandeau, hors du menu et de Google) ou ouverte à tous (menu, accueil)
- **Comptabilité** : par mois, trimestre ou année ; chiffres clés (commandes, panier moyen, marge, évolution sur l'année d'avant) ; graphique mois par mois ; où part l'argent ; meilleures ventes et leur marge ; marge de chaque vente
- **Achats** : une dépense détaillée ligne par ligne à partir des ingrédients du site, prix au kilo ou à la pièce calculé, dernier prix payé retenu ; coût de revient de chaque produit ; photo du ticket de caisse
- **Glossaire depuis l'éditeur de recettes** : les mots sélectionnés dans une étape, ou le bouton « Glossaire », ouvrent une fenêtre pour les ajouter ; « Garder pour plus tard » (affiché nulle part tant qu'il n'est pas défini, compté) ; les mots connus soulignés dans les étapes
- **Factures** : « Générer la facture » sur une commande récupérée ; numérotées sans trou chaque année (2026-0001…), vendeur et client recopiés, remise affichée ; une feuille à imprimer ou à enregistrer en PDF
- **Informations de facturation** : nom, adresse, SIRET, contact et mention de TVA du vendeur, réglés depuis la comptabilité, qui liste les factures de l'année
- **Brouillon des articles gardé** : l'éditeur d'articles garde ce qui est tapé dans le navigateur jusqu'à l'enregistrement, et le propose à la réouverture (« Reprendre », « Ignorer »)

### Modifié

- **Navigation** : « Sucré » avant « Salé » dans le menu des recettes et le menu téléphone
- **Comptabilité** : « + Ajouter » ouvre une fenêtre ; lignes regroupées par mois, avec filtres et recherche
- **Notifications de l'accueil** : un bandeau discret, « Activer » dans la couleur du site
- **Boutique** : plus de texte de présentation
- **Icône de la liste de courses** : une liste à cocher, plus le panier de la boutique
- **Page de connexion** : motif vichy et bord festonné de boîte de pâtisserie
- **Dates** : « 1er novembre », comme le français écrit le premier du mois
- **Une commande facturée** garde son statut et son montant et ne peut plus être supprimée

### Retiré

- **Mes observations** : la page, son bouton et la partie sous les recettes. Chaque observation est devenue un article en brouillon, sa recette en lien ; `/mon-cap/observations` mène à Mon CAP

### Technique

- Migration V21 : articles (sous-titre, adresse, style, blocs en JSON, mise en avant), observations converties puis supprimées, position de la boutique, formats des produits, produit de chaque ligne de commande, lignes d'achat, tickets de caisse (hors de la galerie, servis aux admins seulement), mots du glossaire sans définition
- Sauvegardes : articles, produits, achats et tickets fusionnés ; les anciennes sauvegardes migrées à la restauration
- Mise en page des articles par requêtes de conteneur : la même sur un téléphone et dans l'aperçu de l'éditeur
- Migration V22 : texte de présentation de la boutique retiré, informations de facturation, factures et leurs lignes
- Sauvegardes : factures fusionnées ; chaque table vérifiée fusionnée ou écartée exprès (`BackupCoverageTest`)
- Accès à l'API vérifié pour chaque contrôleur (`EndpointAccessTest`)
- Accessibilité : messages et fenêtres de confirmation bien annoncés, un titre de page dans le back-office
- Tests : 267 front, 326 backend, 181 vérifications dans Chrome (boutique, factures, comptabilité et brouillons d'articles sur des données simulées)
- Documentation : restauration à la main et changement de domaine déplacés dans le guide de production ; captures du ReadMe pour la boutique, Mon CAP, la comptabilité et une facture

## 2.3.0 - 2026-11-09

Front et backend 2.3.0. Pas de migration de la base

### Ajouté

- **Menu téléphone** : la page affichée ressort, et sa section arrive dépliée
- **Page de connexion** : un motif en écailles sur le panneau de gauche

### Corrigé

- **Menu téléphone** : le texte tapé dans la recherche, et ses suggestions, étaient invisibles

## 2.2.0 - 2026-11-09

Front et backend 2.2.0. Pas de migration de la base

### Ajouté

- **Panneau du back-office** : chaque groupe s'ouvre et se ferme, et reste comme on l'a laissé

### Modifié

- **Menu téléphone** : les pages d'abord, puis les sections ; des lignes simples dans une section ; la fermeture est plus rapide

### Corrigé

- **Back-office** : plus de transition de page, qui bloquait le défilement et les clics pendant un changement de section
- **Choix clair / sombre** : « Sombre » ne touche plus le bord dans le panneau

## 2.1.1 - 2026-11-09

Front et backend 2.1.1. Pas de migration de la base

### Modifié

- **Menu téléphone** : refait dans la couleur du site, une seule liste en grands caractères ; une flèche mène à une page, un plus en déplie plusieurs
- **Panneau du back-office** : titres de groupe plus marqués, plus de barre de défilement

### Corrigé

- **Photo de l'admin** : le service worker bloquait la photo du compte Google
- **Panneau du back-office** : les icônes du choix clair / sombre sont de retour ; l'e-mail complet s'affiche au survol

## 2.1.0 - 2026-11-09

Front et backend 2.1.0. Pas de migration de la base

### Ajouté

- **Tableau de bord du back-office** : la barre et le pied du site laissent place à un panneau latéral avec toutes les sections ; sur téléphone, une barre ouvre le même panneau, en grandes lignes
- **Page de connexion** (`/admin/connexion`) : le bouton de Google en couleur, aussi affiché quand une session expire
- **Photo de l'admin** : la photo du compte Google, ou la première lettre du nom
- **Défilement infini** : chaque liste paginée se charge en descendant, à la place des numéros de page et du « par page ». Les cartes loin de l'écran ne sont pas dessinées, et le retour arrière revient au même endroit

### Modifié

- **Navigation** : un seul panneau « Recettes » dans la barre
- **Menu téléphone** : de grandes lignes pour les pages seules, des cartes dépliables pour les sections de plusieurs pages, et la recherche en haut
- **En-tête sur téléphone** : le nom du site sur une ligne, à côté du seul bouton du menu
- **Recettes sur téléphone** : tous les filtres repliés derrière un bouton « Filtres » qui montre combien sont actifs
- **Bouton des notifications** : plus court sur l'accueil ; une fois activées, l'état et « Désactiver » sont séparés
- **Téléphones** : boutons de navigation plus grands dans le pied de page et la barre du back-office

## 2.0.1 - 2026-11-09

Front et backend 2.0.1. Pas de migration de la base

### Modifié

- **Menu du back-office** : trois entrées (Blog, Boutique, Site), chacune ouvrant un panneau, à la place de trois rangées de liens
- **Observations, produits de la boutique** : la recette se trouve avec un champ de recherche plutôt qu'une liste déroulante
- **Commandes** : l'alerte des nouvelles commandes dit clairement ce qu'elle fait

### Corrigé

- **Comptabilité** : un long e-mail ne déborde plus du formulaire et n'est plus coupé dans le filtre par admin

## 2.0.0 - 2026-11-09

Front et backend 2.0.0. Migration de la base : V20

### Ajouté

- **Boutique** (`/boutique`, fermée tant qu'elle n'est pas ouverte dans le back-office) : des recettes choisies par l'admin, avec un prix, un texte libre et le captcha de Google. Aucun paiement sur le site
- **Commandes** : des statuts de « Nouvelle » à « Récupérée » ou « Annulée », un lien de suivi secret pour le client, sans compte
- **Alertes de commande** : une pastille dans le back-office, et une notification sur les appareils des admins qui la demandent
- **Comptabilité** : les commandes récupérées entrent d'elles-mêmes, les dépenses se saisissent à la main, chaque ligne comptée pour un admin ; totaux par mois et par admin, export CSV
- **Mon CAP** (`/mon-cap`) : une frise datée du diplôme, avec du texte et des photos
- **Mes observations** (`/mon-cap/observations`) : des notes sur une recette ou sur aucune, montrées aussi sur la page de la recette
- **Recettes utilisées comme parties** : une recette peut être une partie d'une autre, entière ou multipliée (« Pâte sablée × 0,5 »), jusqu'à 3 niveaux. Total, mode cuisine, liste de courses, recherche et données structurées suivent
- **Équivalents des ingrédients** : le poids d'une pièce, pour afficher « 400 g (≈ 8 œufs) », selon les portions

### Modifié

- **Back-office** : les sections en trois groupes, Blog, Boutique et Site
- **Suppression d'une recette** : refusée tant qu'une autre recette l'utilise, ou qu'elle est dans la boutique
- **Pages légales** : la boutique et ses données ; les commandes sont dans les sauvegardes, et effacées 12 mois après être terminées

### Technique

- Sauvegarde et restauration : nouvelles tables comprises et fusionnées, commandes aussi (retrouvées par leur lien de suivi, chacune gardant son numéro s'il est libre) ; la numérotation des commandes continue après la comptabilité sur un nouveau serveur
- `RecaptchaBox` partagé par les formulaires d'avis et de la boutique
- Backend : `POST /api/shop/orders` limité à une commande par minute et 5 par heure par adresse, 30 par heure pour tout le site

## 1.22.0 - 2026-11-08

Front et backend 1.22.0. Pas de migration de la base

### Ajouté

- **IA locale, téléchargement** : quantité téléchargée, reste à télécharger, débit et temps restant
- **IA locale, téléchargement** : un lien pour signaler un échec sur GitHub, déjà rempli
- **IA locale, pendant le travail** : la liste de ce qui se fait, le temps écoulé, le temps restant pour une image, et l'avertissement que l'ordinateur peut ralentir
- **Téléphones et tablettes** : IA locale grisée, avec la raison
- **ReadMe** : les IA du back-office, avec des captures
- **Éditeur de recettes** : un bouton « Publier » toujours visible dans la barre, avec confirmation, à côté de « Enregistrer le brouillon »

### Modifié

- **Modèles nommés en entier** : Gemma 4 E4B de Google, FLUX.2 klein 4B de Black Forest Labs, Qwen3 4B d'Alibaba ; d'où ils viennent (Hugging Face) et où ils sont gardés (le cache du navigateur)
- **Remplir avec l'IA** : champ de texte plus haut
- **Pages légales** : les trois modèles locaux nommés, avec leurs auteurs ; gardés dans le cache du navigateur jusqu'à leur suppression

## 1.21.1 - 2026-11-08

Front et backend 1.21.1. Pas de migration de la base

### Corrigé

- **Remplir avec l'IA** : le choix entre Gemini et l'IA locale ressemble à deux vrais boutons, et dit ce que chacun lit

### Modifié

- **Remplir avec l'IA, Générer avec l'IA** : le modèle utilisé est nommé (Gemini, Gemma 4 E4B, FLUX.2 klein 4B) ; une photo est annoncée comme lue par Gemini
- **Remplir avec l'IA** : « Essayer avec un exemple » écrit une recette d'exemple dans le champ vide
- **Politique de confidentialité** : nomme les modèles locaux, et dit qu'une photo de recette ne va qu'à Gemini

## 1.21.0 - 2026-11-08

Front et backend 1.21.0. Pas de migration de la base

### Ajouté

- **Remplir avec l'IA, modèle local** : Gemma 4 E4B tourne dans le navigateur de l'admin (WebGPU), pour un texte collé seulement, à côté de Gemini ; téléchargé une fois depuis Hugging Face (5,2 Go), gardé dans le navigateur, supprimable. Utilisable même quand le quota de Gemini est épuisé
- **Générer avec l'IA** : chaque champ photo du back-office peut dessiner une image dans le navigateur avec FLUX.2 klein 4B (6,5 Go), puis l'envoyer à l'éditeur de photos

### Modifié

- **Pages légales** : politique de confidentialité et mentions légales couvrent les modèles qui tournent dans le navigateur de l'admin

### Technique

- Front : `core/local-ai/` (fichiers de modèle épinglés, stockage Cache, un Web Worker par réseau pour libérer la mémoire graphique) ; le WebAssembly d'ONNX Runtime servi par le site (`/ort/`)
- Backend : `GET /api/admin/recipe-ai/local-prompt` et `POST /api/admin/recipe-ai/local-draft` : mêmes règles et mêmes vérifications que Gemini
- CSP : `wasm-unsafe-eval`, et Hugging Face dans `connect-src`

## 1.20.1 - 2026-11-08

Front et backend 1.20.1. Pas de migration de la base

### Corrigé

- **Donner mon avis** : le reCAPTCHA ne se chargeait pas, ou restait sur « Chargement… », dans les navigateurs avec le service worker : sa Content-Security-Policy n'autorisait pas les scripts de Google

### Modifié

- **Donner mon avis** : le reCAPTCHA s'affiche dès l'ouverture de la page, sans premier clic ; politique de confidentialité mise à jour
- **`devops/.env.example`** : `RECAPTCHA_SITE_KEY` et `RECAPTCHA_SECRET_KEY` réglées sur les clés de test publiques de Google, avec où créer celles de la production

### Technique

- Service worker enregistré à une nouvelle adresse (`ngsw-worker.js?v=2`), pour que les navigateurs installés remplacent celui qui gardait l'ancienne politique

## 1.20.0 - 2026-11-08

Front et backend 1.20.0. Pas de migration de la base. Nouvelles variables obligatoires en production : `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`

### Modifié

- **Donner mon avis** : la case Google reCAPTCHA v2 à la place de la vérification de la 1.19.0, chargée seulement après le clic du visiteur
- **Politique de confidentialité** : ce que Google reçoit avec le reCAPTCHA

### Technique

- Backend : `GET /api/feedback/captcha` remplace `GET /api/feedback/challenge` ; chaque réponse vérifiée auprès de Google hors de toute transaction, 20 vérifications par heure et par adresse, message refusé quand Google ne répond pas
- Serveur SSR : CSP ouverte au reCAPTCHA de Google (scripts et cadre)
- Clés : [docs/google.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/google.md#5-recaptcha) ; les clés de test publiques de Google par défaut sur la pile locale

## 1.19.0 - 2026-11-08

Front et backend 1.19.0. Pas de migration de la base

### Ajouté

- **Donner mon avis** : case « Je ne suis pas un robot », obligatoire pour envoyer un message. Le navigateur résout un défi unique du backend : aucun service tiers, aucun cookie

### Corrigé

- **Statistiques, mémoire de la machine** : le cache disque ne compte plus comme utilisé (un serveur allumé depuis un moment semblait presque plein) ; la tuile met maintenant en avant la mémoire utilisée, pas la part libre
- **Donner mon avis** : un message refusé montre la vraie raison (un par minute, trop de messages…) au lieu d'une erreur de connexion générique

### Technique

- Backend : `GET /api/feedback/challenge`, `feedback/FeedbackCaptcha` (preuve de travail SHA-256 signée) ; `POST /api/feedback` refusé sans défi résolu
- Backend : mémoire disponible lue dans `MemAvailable`, ou mémoire libre plus cache disque inactif dans un conteneur limité

## 1.18.1 - 2026-11-02

Front et backend 1.18.1. Migration de la base : V19

### Corrigé

- **Sécurité, notifications** : nouveaux abonnements limités à 10 par heure par adresse et 300 par heure pour tout le site, pour qu'un script ne puisse plus remplir les 20 000 places ; un abonnement refusé 3 fois de suite par son service (400, 403…) est retiré
- **Sécurité, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`** : une adresse avec des paramètres est redirigée (301) vers l'adresse simple, au lieu d'être refaite depuis l'API en passant le cache de Cloudflare
- **Dépendances** : Angular 22.2.4 (outils de build 22.2.5, Vite 8.3.5) et body-parser 2.4.0, `npm audit` sans alerte

### Technique

- Backend : l'adresse du visiteur pour les limites publiques dans `common/ClientAddress` (avis et notifications)
- Revue de sécurité du 2 novembre 2026 dans [SECURITY-REVIEW.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/SECURITY-REVIEW.md)

## 1.18.0 - 2026-11-02

Front et backend 1.18.0. Pas de migration de la base

### Ajouté

- **Chaque page en Markdown** : l'adresse d'une page indexable + `.md` (`/index.md` pour l'accueil, `/recettes.md?categorie=desserts` pour une catégorie, `…/index.md` aussi), ou l'adresse de la page demandée avec `Accept: text/markdown`. Annoncée par chaque page, l'adresse canonique restant celle de la page
- **`/llms-full.txt`** : tout le texte du site en un fichier (Yona, chaque recette en entier, les menus, le glossaire), lié depuis `/llms.txt`

### Modifié

- **robots.txt** : tous les robots autorisés, entraînement des IA compris (GPTBot, ClaudeBot, CCBot…), nommés avec les robots de recherche des IA. Gardé une heure en cache au lieu d'un jour
- **Conditions d'utilisation** : l'entraînement des IA n'est plus refusé (fouille de textes et de données, article L122-5-3) ; reproduire les contenus demande toujours l'accord de l'autrice
- **Installer l'application** : les étapes pour iPhone, Android et ordinateur sont toutes dans la page, lisibles sans JavaScript
- **Cartes de partage** : l'icône du site pour une page sans photo, la photo de la catégorie pour une page de catégorie

### Technique

- Serveur SSR : pages en Markdown dans `front/src/server/markdown.ts`, écrites depuis l'API (`page-markdown.ts`) ou converties depuis la page rendue avec Turndown (`rendered-markdown.ts` : installation, pages légales)

## 1.17.0 - 2026-11-01

Front et backend 1.17.0. Pas de migration de la base

### Ajouté

- **Page Conditions d'utilisation** (`/conditions-d-utilisation`) : accès libre, recettes à réaliser avec prudence (allergies, hygiène, quantités et minuteurs indicatifs), messages des visiteurs, usages interdits, partage et réutilisation des contenus, assistants IA bienvenus pour citer avec un lien, entraînement des IA refusé (article L122-5-3 du Code de la propriété intellectuelle). Liée depuis le pied de page, les mentions légales, la page d'avis, le sitemap et `/llms.txt`

## 1.16.0 - 2026-11-01

Front et backend 1.16.0. Migration de la base : V18

### Ajouté

- **Questions fréquentes** dans l'éditeur de recettes : questions et réponses affichées sous la recette, données aux moteurs de recherche en FAQPage et gardées dans l'historique, la corbeille et les sauvegardes
- **Page « À propos de Yona »** (`/a-propos`) : le texte, la photo et les réseaux de l'« À propos » de l'accueil, liée depuis l'accueil, le pied de page et chaque recette (« Une recette de Yona »)
- **`/llms.txt`** : le site décrit pour les assistants IA, avec chaque recette, menu et page publiés, refait à chaque demande comme le sitemap
- **Recettes en Markdown** : l'adresse d'une recette + `.md` (`/recettes/tartes/tarte-aux-pommes.md`), annoncée par chaque page, l'adresse canonique restant celle de la page
- **IndexNow** : Bing (ChatGPT Search, Copilot) et les autres moteurs IndexNow sont prévenus aussitôt de chaque recette publiée, modifiée, dépubliée ou supprimée. En production seulement
- **Statistiques, « Visites venant des assistants IA »** : les visites venues de ChatGPT, Perplexity, Gemini, Copilot, Claude… sur 30 jours et 12 mois, comptées une fois par onglet, sans rien sur le visiteur

### Modifié

- **robots.txt** : les assistants IA qui répondent avec un lien (OAI-SearchBot, PerplexityBot, Claude-SearchBot…) nommés et bienvenus ; les robots qui collectent pour l'entraînement des IA (GPTBot, ClaudeBot, CCBot…) refusés. Google-Extended reste autorisé (les réponses de Gemini)
- **Données structurées** : un graphe JSON-LD par page, le site (`WebSite`) et Yona (`Person`) partagés par chaque page ; les recettes avec `BreadcrumbList`, leur vidéo YouTube (`VideoObject`) et leur langue ; les listes de recettes et les menus en `CollectionPage` et `ItemList`

### Technique

- Serveur SSR : appels à l'API du sitemap, de `llms.txt` et des versions Markdown dans un seul module (`front/src/server/api.ts`)
- Backend : `app.site-url` (`SITE_URL`) et `app.indexnow` (`INDEXNOW_ENABLED`, réglé dans `compose.prod.yaml`), fichier de clé `front/public/f5d890788ccc4557ecd282dea7299d26.txt`

## 1.15.0 - 2026-10-31

Front et backend 1.15.0. Pas de migration de la base

### Ajouté

- **Restauration, « Ajouter ce qui manque »** : reprend aussi les Préférences de la sauvegarde (textes et photo de l'accueil, pied de page) et l'Apparence quand celles du site n'ont jamais été modifiées, par exemple sur un nouveau serveur. Celles déjà modifiées restent telles quelles
- **Restauration** : les menus sont comptés, listés parmi ce qui manque et dans le compte rendu ; les recherches sans résultat (Statistiques) sont fusionnées aussi

### Corrigé

- **La restauration refusait toute archive contenant la photo d'un menu** (« archive invalide ») : le dossier `menus/` n'était pas accepté. Les dossiers acceptés viennent désormais des types de photo, pour qu'un nouveau type ne puisse plus être oublié

### Modifié

- **Page Sauvegarde** : liste tout ce que contient l'archive, et ce qui reste sur le serveur (historique, messages des visiteurs, abonnés aux notifications, compte Google Drive)

## 1.14.1 - 2026-10-29

Front et backend 1.14.1. Pas de migration de la base

### Corrigé

- **Pages publiques lentes à charger** (1 à 5 s par requête) : le service worker, occupé à installer une nouvelle version, retenait chaque réponse de l'API. La page interroge maintenant l'API directement, comme le back-office, et garde sa propre copie dans le navigateur pour la lecture hors connexion (utilisée quand le réseau ne répond pas en 3 s)

## 1.14.0 - 2026-10-29

Front et backend 1.14.0. Pas de migration de la base

### Ajouté

- **Connexion perdue / retrouvée** : un message dit que le site est hors connexion (les recettes déjà ouvertes restent lisibles) jusqu'au retour de la connexion, puis « Connexion retrouvée »
- **« Mettre à jour »** : une page ouverte avant un déploiement propose la nouvelle version dans un message dès qu'elle est prête, sans attendre un changement de page

### Modifié

- **Pages plus rapides** : les réponses de l'API publique (recettes, catégories, menus, textes, thème, suggestions de recherche) sont gardées dans la mémoire du backend, vidées à chaque changement fait dans le back-office, publication programmée ou sauvegarde restaurée. Environ 10 ms au lieu de 15 à 50 ms chacune ; pages rendues par le serveur en 80 à 100 ms au lieu de 110 à 200 ms (mesures locales)
- **Back-office toujours à jour** : jamais servi depuis la copie du service worker, il charge la version du serveur

### Technique

- Chaque réponse de l'API donne la version du backend (`X-App-Version`) ; un front plus ancien cherche aussitôt sa nouvelle version
- Spring Cache avec Caffeine : 500 réponses par cache au plus, 10 minutes au plus
- 134 tests backend, 104 tests front, 82 vérifications dans Chrome

## 1.13.0 - 2026-10-29

Front et backend 1.13.0. Pas de migration de la base

### Ajouté

- **Courbes du serveur en direct** dans les Statistiques (« Suivre en direct ») : processeur et mémoire du backend mesurés toutes les 1, 2 ou 5 s, les 60 dernières mesures dessinées, valeurs au survol
- **Rotation libre** dans l'éditeur de photos : une molette à presser et tourner, qui s'arrête sur 0, 90, 180 et 270° ; le cadre reste sur la photo inclinée, sans coin vide

### Modifié

- **Photos plus petites acceptées** : paysage ou carré, 800 × 450 px au moins (1200 × 800 et 4:3 avant) ; Pinterest 600 × 800 (1000 × 1333). Toute image que le navigateur ouvre (HEIC de l'iPhone, WebP) passe par l'éditeur, envoyée en JPEG ; 10 Mo au plus

### Corrigé

- Statistiques exportées en PDF : graphiques imprimés, boutons « Actualiser » laissés de côté

### Technique

- **Mémoire du backend** d'environ 370 à 400 Mo au repos (420 Mo en 1.12.0) : tas plafonné à 256 Mo, compilateur rapide (C1) seulement
- API : `GET /api/admin/stats/server` (mémoire et processeur seuls, pour les courbes en direct) ; `PUT /api/admin/images/{id}` suit les mêmes règles de taille qu'un envoi
- 131 tests backend, 100 tests front, 82 vérifications dans Chrome

## 1.12.0 - 2026-10-29

Front et backend 1.12.0. Migration de la base : V17

### Ajouté

- **Éditeur de photos** avant chaque envoi et sur les photos déjà en ligne (« Retoucher », aussi dans la galerie) : recadrage (libre, 4:3, 3:2, 16:9 ; 2:3, 3:4 pour Pinterest), quarts de tour, miroir, filtres (Lumineux, Gourmand, Doux, Contrasté, Frais, Noir et blanc), luminosité, contraste, couleurs et chaleur. Une photo retouchée remplace l'originale partout où elle s'affiche ; l'originale va à la corbeille
- **Détail de l'historique** : chaque modification liste les champs changés, l'ancienne valeur barrée, la nouvelle à côté ; pour les ingrédients, les étapes et les autres listes, les lignes retirées et ajoutées. Les changements de photo d'une recette sont notés aussi
- **Recherche plus fine** : les mots sont aussi cherchés dans les étapes et le matériel ; un temps est compris (« dessert en 30 min », « brioche 1h30 »), comme « rapide », « facile » et « sans cuisson »

### Modifié

- **Une seule recette à la une** de nouveau sur l'accueil (la dernière publiée quand aucune n'est choisie)
- **Accueil** : les 3 dernières recettes salées et les 3 dernières sucrées, chacune avec un lien vers toutes les recettes du thème, au lieu des 3 dernières
- Les photos de plus de 2400 px sont réduites dans le navigateur avant l'envoi : plus rapide depuis un téléphone

### Corrigé

- La barre de recherche de l'accueil dépassait l'écran d'un téléphone quand un nombre de personnes était tapé ; texte indicatif long coupé par des points de suspension
- Toucher vite − et + (portions) zoomait la page sur iPhone

### Technique

- **Mémoire du backend** d'environ 420 Mo au repos au lieu de 700 à 800 Mo : tas plafonné à 320 Mo, G1 qui rend la mémoire au repos, fils du ramasse-miettes et du compilateur pour 2 cœurs, mémoire native réduite, 5 connexions à la base, 40 fils web au plus
- API : `changes` sur les lignes de l'historique, `PUT /api/admin/images/{id}` (photo retouchée), `theme` de `/api/featured-recipe` gardé pour les applications installées seulement
- 131 tests backend, 98 tests front, 82 vérifications dans Chrome

## 1.11.0 - 2026-10-29

Front et backend 1.11.0. Migration de la base : V16. Comprend la 1.10.1, jamais publiée

### Ajouté

- **Les thèmes appartiennent aux catégories** : chaque catégorie est Sucré, Salé ou Les deux. Une recette prend le thème de sa catégorie principale ; il ne se choisit à la main que dans une catégorie « Les deux »
- **Menus « Salé » et « Sucré »** dans la barre du haut (et sur téléphone) à la place de « Catégories » : chaque thème avec ses catégories et « Toutes les recettes salées ». Une catégorie « Les deux » apparaît dans chaque menu dont elle a des recettes, en n'ouvrant que celles-là
- **Catégories du back-office** : le thème de chaque catégorie ; le changer déplace ses recettes (après confirmation)
- **Statut « Programmée »** (bleu) dans le back-office pour un brouillon avec une heure de publication, avec son propre filtre

### Modifié

- Le salé avant le sucré partout (menus, filtres, accueil), comme un repas
- **Page des recettes** réorganisée : la recherche sur sa propre ligne, puis des filtres titrés (Type, Nombre de personnes, Ingrédients, Catégorie)
- **Nombre de personnes** : un compteur − / + (nombre à taper, × pour revenir) à la place du menu « Comme la recette »
- Les catégories existantes classées d'après leur nom, les recettes suivant leur catégorie principale (corrige la migration tout-sucré de la 1.10.0)

### Technique

- API : `theme` et `publishedThemes` sur les catégories, `PUT /api/admin/categories/{id}` renommé `updateCategory` (nom et thème), `theme` facultatif dans le formulaire de recette, filtre `scheduled` sur `/api/admin/recipes`
- 122 tests backend, 89 tests front, 81 vérifications dans Chrome

## 1.10.0 - 2026-10-29

Front et backend 1.10.0. Migration de la base : V15

### Ajouté

- **Thèmes sucré et salé** : chaque recette est l'un ou l'autre ; filtre par thème sur la page des recettes et dans le back-office
- **Accueil** : une recette à la une par thème, côte à côte
- **Mettre à la une une recette programmée** : elle devient celle de son thème une fois publiée
- **Statut « Échec »** (rouge) à côté de Brouillon (gris) et Publiée (vert) : une recette programmée en retard de plus de 30 min (site arrêté, vieille sauvegarde restaurée) ou en échec 3 fois de suite n'est pas publiée ; raison affichée, bouton « Publier maintenant »
- **Recherche plus fine** : « cake salé » propose le thème salé (et trouve toujours « caramel au beurre salé »), « gâteau au yaourt » propose l'ingrédient Yaourt, « gâteau 8 » montre une pastille « 8 pers. » avec − et + ; message « Aucun résultat » avec une icône
- **Page des recettes** : « Pour combien de personnes ? » reporté sur les recettes ouvertes
- **Liste de courses** : − et + par recette ; les articles se lisent « Beurre (90 g) »
- **Statistiques** : mémoire et processeur utilisés, publications en échec, nombre de recettes sucrées et salées
- **Nouveautés** : boutons GitHub et Coolify

### Modifié

- Changelog en anglais, versions renumérotées de 3.x en 1.x
- Rayons nommés comme au supermarché : « Boulangerie » retiré (ses ingrédients laissés sans rayon), « Frais » ajouté, une aide pour chacun
- Historique : 20 lignes par page, pagination au-dessus et au-dessous de la liste
- Avis des visiteurs : un message par minute par adresse, 30 par heure pour tout le site, doublons gardés une fois

### Corrigé

- Glossaire : un mot avec un tiret désactivait tous les mots ; tirets, tirets bas et espaces se valent désormais
- Page d'avis : bordure du champ e-mail ; cartes des avis dans le back-office : contour gardé sur les messages non lus
- Les liens du changelog ouvrent le fichier sur GitHub au lieu d'une page absente du site

### Technique

- API : `theme` sur les recettes, `GET /api/featured-recipe?theme=`, `POST /api/admin/recipes/{id}/publish`, `themes` dans les suggestions de recherche, `server` dans les statistiques, `theme` lu par l'IA
- 117 tests backend, 84 tests front, 74 vérifications dans Chrome (thèmes, recherche fine, statut d'échec, portions de la liste de courses, liens GitHub)

## 1.9.0 - 2026-10-28

Front et backend 1.9.0. Migration de la base : V14

### Ajouté

- Recherche dans tout le site : loupe de l'en-tête et barre de l'accueil, mots cherchés dans les titres, catégories, tags et ingrédients, suggestions par type ; « tarte 8 personnes » ouvre les recettes pour 8
- Formulaire « Donner mon avis » pour les visiteurs ; page « Retours » dans le back-office
- Historique du back-office (qui a fait quoi, gardé 6 mois), titres de l'accueil modifiables
- La corbeille garde aussi les tags, les ingrédients et les mots du glossaire

### Technique

- `GET /api/search-suggestions`, `POST /api/feedback` (champ piège, 5 par heure par adresse), `/api/admin/feedback`, `/api/admin/history`

## 1.8.1 - 2026-10-28

Front et backend 1.8.1. Pas de migration de la base

### Technique

- Documentation : réseaux d'entreprise et Bot Fight Mode de Cloudflare

## 1.8.0 - 2026-10-28

Front et backend 1.8.0. Pas de migration de la base

### Ajouté

- « Remplir avec l'IA » dans l'éditeur de recettes : Gemini lit un texte collé ou une photo et remplit le formulaire, sans rien enregistrer ([docs/ia.md](https://github.com/ImMaxence/les-creations-de-yona/blob/main/docs/ia.md))

### Modifié

- Les menus sans photo montrent le visuel par défaut

## 1.7.0 - 2026-10-28

Front et backend 1.7.0. Migration de la base : V13

### Ajouté

- Une photo pour chaque menu

### Corrigé

- Hors connexion : les pages déjà vues s'ouvrent tout de suite, plus d'attente de 30 s puis « Forbidden »
- Application installée reconnue depuis le navigateur ; étapes des recettes complétées pour la Search Console

## 1.6.0 - 2026-10-28

Front et backend 1.6.0. Pas de migration de la base

### Ajouté

- Corbeille : sélection multiple pour restaurer ou effacer

## 1.5.3 - 2026-10-28

Front et backend 1.5.3. Pas de migration de la base

### Corrigé

- La liste des recettes du back-office garde sa position quand on trie ou filtre

## 1.5.2 - 2026-10-27

Front et backend 1.5.2. Pas de migration de la base

### Corrigé

- Liste des recettes du back-office vide (« tri non autorisé »)

## 1.5.1 - 2026-10-27

Front et backend 1.5.1. Pas de migration de la base

### Modifié

- Plus de point à la fin des textes affichés sur le site

## 1.5.0 - 2026-10-27

Front et backend 1.5.0. Migration de la base : V12

### Ajouté

- Bouton « Télécharger l'application » ; nombre de vues des recettes et recettes les plus vues ; liste des recettes du back-office triable
- La corbeille garde aussi les catégories, les menus et les photos, restaurés à leur place

## 1.4.0 - 2026-10-27

Front et backend 1.4.0. Migration de la base : V11

### Ajouté

- Menus (des recettes pour une occasion) avec « Tout ajouter à ma liste de courses »
- Les minuteurs survivent à un rechargement de la page

### Technique

- Vérifications d'accessibilité (axe) et Lighthouse dans le parcours Chrome ; compression par la passerelle

## 1.3.0 - 2026-10-27

Front et backend 1.3.0. Migration de la base : V10

### Ajouté

- Minuteurs gardés d'une page à l'autre, minuteur libre ; liste de courses rangée par rayon ; liste du matériel

### Technique

- Parcours de bout en bout dans Chrome (`e2e/`), documentation découpée dans `docs/`, licence MIT

## 1.2.0 - 2026-10-27

Front et backend 1.2.0. Pas de migration de la base

### Ajouté

- Recherche à plusieurs ingrédients, notes personnelles, « Mise en place » et « + 1 min » du mode cuisine, bandeau d'installation, page « Nouveautés »

### Technique

- Tests unitaires : Vitest (front), JUnit (backend)

## 1.1.0 - 2026-10-26

Front et backend 1.1.0. Migration de la base : V9

### Ajouté

- Notifications des nouvelles recettes, adaptation à la taille du moule, « Organiser mon temps », temps de repos, conseils, recettes proches, glossaire
- Back-office : corbeille, publication programmée, dupliquer, brouillon enregistré automatiquement, sauvegarde de nuit sur Google Drive

### Technique

- Icônes intégrées à la place de `@lucide/angular` (premier chargement de 730 à 505 Ko)
