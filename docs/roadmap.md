# Roadmap

Les versions passées, résumées (le détail depuis la 1.1.0 est dans le [CHANGELOG](../CHANGELOG.md)), et ce qui reste à vérifier. Retour au [ReadMe](../ReadMe.md).

## Versions

- [x] devops : Docker Compose (PostgreSQL 18, SeaweedFS), `.env.example`
- [x] devops : Dockerfile du backend (avec client `pg_dump` 18), service `back` dans la Compose (profil `app`)
- [x] devops : Dockerfile du frontend, passerelle locale (Caddy) pour l'application complète
- [x] devops : Compose de production pour Coolify (`devops/compose.prod.yaml`), passerelle en image autonome
- [x] devops : premier déploiement sur Coolify, déploiement automatique à chaque commit (webhook GitHub)
- [x] back : init Spring Boot 4 avec Maven (nettoyage des fichiers inutiles), migration Flyway V1, entités et repositories
- [x] back : service d'upload S3 (validation, resize, conversion)
- [x] back : auth Google avec allowlist `APP_ADMIN_EMAILS`, session
- [x] back : endpoints publics recettes et catégories
- [x] back : endpoint d'autocomplétion des titres
- [x] front : init Angular 22 (nettoyage des fichiers inutiles)
- [x] front : page d'accueil (recette à la une, à propos, 3 dernières recettes, catégories)
- [x] front : page recettes (filtre par catégorie, recherche)
- [x] front : navbar avec menu déroulant, menu mobile, footer, pages 404 et erreur serveur
- [x] front : page recette
- [x] front : pages mentions légales et politique de confidentialité
- [x] back : ProblemDetail et springdoc-openapi exposé
- [x] back : API admin (recettes, catégories, ingrédients, réseaux sociaux)
- [x] back : API admin galerie images et sauvegarde ZIP
- [x] front : back-office (guard, intercepteur HTTP, formulaires)
- [x] front : application installable (PWA), page « Installer l'application »
- [x] front : génération des services depuis le openapi du backend
- [x] front : Angular SSR, meta tags, JSON-LD
- [x] front : sitemap.xml
- [x] docs : procédure de restauration (dump PostgreSQL et S3)
- [x] sécurité : en-têtes du serveur SSR (CSP à nonce), documentation de l'API coupée en production, rotation des journaux
- [x] thèmes : 5 thèmes de couleurs clair et sombre, polices et arrondi choisis dans le back-office, choix Clair / Auto / Sombre du visiteur
- [x] réseaux sociaux : Facebook, X, Threads, Reddit, WhatsApp
- [x] back-office : galerie qui garde toutes les photos (filtre « Non utilisées », réutilisation), catégorie créée depuis la recette, ingrédients suggérés par usage, liste des recettes paginée
- [x] front : bouton « Retour » sur la page recette
- [x] versions du front et du backend affichées dans le back-office
- [x] recettes : difficulté en étoiles, vidéo YouTube, bouton « Partager » ; accueil limité aux 3 dernières recettes
- [x] recettes : parties facultatives (ingrédients et étapes par partie, total des ingrédients), catégories multiples, majuscule automatique (migration V4)
- [x] envoi de photos depuis la galerie (migration V5)
- [x] composant de modale commun, galerie paginée, progression des envois de photos, page Statistiques (stockage compris)
- [x] back-office : aperçu des recettes (brouillons compris), doublons d'ingrédients et fusion, suppressions groupées, filtres catégorie et ingrédient, miniatures, liens filtrés ; site : recherche par ingrédient, catégories en menu déroulant
- [x] 1.0.0 : tags (migration V7), filtres temps et difficulté, photo Pinterest et bouton « Épingler », favoris, liste de courses, mode cuisine, impression ; restauration d'une sauvegarde (fusion ou remplacement) ; statistiques (recettes à compléter, brouillons oubliés, recettes à rafraîchir, recherches sans résultat, export PDF) ; préréglages d'apparence, 5 thèmes et 5 polices de titres en plus ; photo « À propos » enregistrée avec le bouton ; infobulles à côté des icônes
- [x] 1.0.0 : majuscule aux ingrédients et aux noms commençant par un emoji (migration V8), « Effacer tous les filtres » sur la page Recettes
- [x] 1.1.0 : notifications des nouvelles recettes (Web Push), sauvegarde de nuit sur Google Drive, corbeille, publication programmée, « Dupliquer », brouillon gardé dans le navigateur, glossaire, « Le conseil de Yona », temps de repos et « Organiser mon temps », adaptation au moule, « Vous aimerez aussi », ingrédients par étape et sonnerie du mode cuisine, icônes intégrées sans Lucide (migration V9)
- [x] 1.2.0 : encart des notifications sur l'accueil, dernières recettes avant « À propos » ; mode cuisine : « Mise en place », « + 1 min », minuteurs gardés une fois le mode fermé, minuteur qui part bien de 1:00, vibration légère au rythme de la sonnerie ; « Mes notes » sur chaque recette ; recherche avec plusieurs ingrédients ; « Installer l'application » retiré de la navbar, bandeau d'installation ; page « Nouveautés » (CHANGELOG) dans le back-office ; tests unitaires front (Vitest) et backend (JUnit)
- [x] 1.3.0 : minuteurs gardés sur tout le site, minuteur libre ; liste de courses par rayon (rayon des ingrédients dans le back-office) ; matériel des recettes ; réponse 400 aux adresses mal encodées ; parcours dans Chrome (`e2e/`) ; documentation découpée (`docs/`), captures d'écran, licence MIT (migration V10)
- [x] 1.12.0 : éditeur de photos (recadrage, rotation, miroir, filtres, luminosité, avant chaque envoi et « Retoucher » une photo déjà sur le site), historique détaillé champ par champ (avant, après ; migration V17), recherche dans les étapes et le matériel, temps compris (« en 30 min »), « rapide », « facile », « sans cuisson » ; une seule recette à la une, 3 dernières salées et 3 dernières sucrées sur l'accueil ; barre de recherche de l'accueil tenue dans l'écran du téléphone, plus de zoom en touchant − et + ; mémoire du backend réduite (environ 420 Mo au repos au lieu de 700 à 800)
- [x] 1.11.0 : thème porté par la catégorie (Sucré, Salé ou Les deux, la recette prend celui de sa catégorie principale), menus « Salé » et « Sucré » dans la barre du haut à la place de « Catégories », salé avant sucré partout, catégories existantes classées d'après leur nom (migration V16) ; page Recettes réorganisée (recherche seule sur sa ligne, filtres nommés, compteur − / + du nombre de personnes), statut « Programmée » en bleu dans le back-office avec son filtre
- [x] 1.10.0 : thèmes Sucré et Salé (une recette à la une par thème sur l'accueil, filtres), statut « Échec » des publications programmées (plus de 30 min de retard ou 3 erreurs, « Publier maintenant »), recette programmée mise à la une d'avance, recherche qui comprend le thème, l'ingrédient et le nombre de personnes (« gâteau 8 » avec − et +), « Aucun résultat », « Pour combien de personnes ? » sur la page Recettes, portions modifiables dans la liste de courses, rayons de supermarché (sans « Boulangerie », avec « Rayon frais »), mémoire et processeur dans les statistiques, historique paginé par 20, retours limités (une minute entre deux, 30 par heure pour tout le site), glossaire corrigé (tirets), CHANGELOG en anglais et versions renumérotées de 3.x en 1.x (migration V15)
- [x] 1.9.0 : recherche dans tout le site (loupe, accueil, mots dans les titres, catégories, tags et ingrédients, suggestions par type, quantités pour « 8 personnes »), « Donner mon avis » et page Retours, historique du back-office (6 mois), titres de l'accueil modifiables, corbeille pour les tags, ingrédients et mots du glossaire, « Effacer les filtres » (migration V14)
- [x] 1.8.1 : documentation des réseaux d'entreprise (Bot Fight Mode n'est pas à désactiver à l'aveugle)
- [x] 1.8.0 : « Remplir avec l'IA » dans l'éditeur de recette (Gemini, offre gratuite), visuel par défaut pour les menus sans photo
- [x] 1.7.0 : photo des menus (migration V13), hors connexion immédiat (pages servies depuis l'appareil, plus d'erreur « Forbidden »), application déjà installée reconnue depuis le navigateur, glossaire du back-office trié, étapes des recettes complétées pour Google, pages non gardées par les proxys ; étude IA (Gemini)
- [x] 1.6.0 : corbeille, sélection multiple pour restaurer ou effacer plusieurs éléments à la fois
- [x] 1.5.3 : la liste des recettes du back-office garde sa position quand on change le tri, un filtre ou la recherche
- [x] 1.5.2 : liste des recettes du back-office de nouveau affichée (tris de la 1.5.0 refusés par le serveur)
- [x] 1.5.1 : plus de point à la fin des textes du site et du back-office (hors pages légales), règle écrite dans l'architecture
- [x] 1.5.0 : bouton « Télécharger l'application » (page d'installation), nombre de vues des recettes et « Recettes les plus vues » dans les statistiques, tri de la liste des recettes du back-office, corbeille pour les catégories, les menus et les photos (migration V12) ; plus de captures dans le ReadMe
- [x] 1.4.0 : menus composés par Yona (pages, accueil, back-office ; migration V11), minuteurs retrouvés après un rechargement, accessibilité (axe) et Lighthouse dans le parcours Chrome, compression par la passerelle, corrections d'accessibilité (repère de l'en-tête, titres de la page Recettes, étiquette des notes)

## Points ouverts

- 1.12.0 en ligne : choisir la recette à la une (la plus récente publiée des deux d'avant est gardée) ; depuis l'iPhone, envoyer une photo et la recadrer, puis « Retoucher » une photo déjà en ligne (elle change partout, l'ancienne est dans la corbeille) ; modifier une recette et regarder le détail dans Historique ; chercher « dessert en 30 min », « tarte facile », un ustensile ; toucher vite − et + sur une recette sans que la page zoome ; dans Statistiques, la mémoire du backend après une journée (environ 420 Mo attendus au repos, contre 700 à 800 avant).

- 1.11.0 en ligne : dans Catégories, vérifier le thème de chaque catégorie (deviné d'après son nom ; « Les deux » pour celles qui n'ont rien évoqué) et le corriger, les recettes suivent ; choisir le thème des recettes des catégories « Les deux » ; regarder les menus « Salé » et « Sucré » sur ordinateur et téléphone.

- 1.10.0 en ligne : choisir la recette à la une de chaque thème ; ranger à nouveau les ingrédients de l'ancien rayon « Boulangerie » (filtre « Sans rayon » de la page Ingrédients) ; regarder « Mémoire et processeur » dans les statistiques ; vérifier qu'une publication programmée passe bien à l'heure.

- 1.9.0 en ligne : chercher « petit déjeuner », « chocolat », « tarte 8 personnes » depuis l'accueil et la loupe ; envoyer un message depuis « Donner mon avis » et le voir dans Retours ; vérifier l'historique après quelques modifications ; ajuster les titres de l'accueil dans Préférences.

- 1.8.0 en ligne : ajouter `GEMINI_API_KEY` dans Coolify puis redéployer, essayer « Remplir avec l'IA » avec un texte et une photo ; choisir une photo pour les menus qui n'en ont pas (ils montrent le visuel par défaut).

- 1.7.0 en ligne : sur un téléphone, ouvrir l'application installée en mode avion (pages déjà vues affichées tout de suite) ; sur Android, vérifier « déjà installée » sur la page d'installation depuis Chrome ; choisir la photo des premiers menus ; Search Console, « Valider la correction » des rapports Recettes ; demander le classement du domaine chez les éditeurs de filtres d'entreprise ([production](production.md#réseaux-dentreprise)).

- Vérification en ligne : connexion Google, upload d'une photo depuis l'iPhone, sauvegarde ZIP, restauration (d'abord une fusion avec une sauvegarde toute fraîche : rien à ajouter attendu).
- 1.1.0 en ligne : réglages Google Drive (voir « Services Google »), connexion du Drive, puis vérifier une notification de nouvelle recette sur un Android et sur un iPhone avec l'application installée.
- 1.5.0 en ligne : vérifier la corbeille avec une vraie session (mettre à la corbeille puis restaurer une catégorie vide, un menu, une photo utilisée par une recette), voir les vues monter dans Statistiques après quelques visites (pas connecté), et le bouton « Télécharger l'application » sur un Android.
- 1.4.0 en ligne : composer les premiers menus (back-office, Menus).
- 1.3.0 en ligne : ranger les ingrédients dans leur rayon (back-office, Ingrédients, « sans rayon »), compléter le matériel des recettes, remplacer les captures d'écran de `docs/captures/` (faites avec la base locale) ; vérifier sur un Android la vraie fenêtre d'installation et la vibration.
- 1.2.0 : vérifié sur la pile Docker locale (Chrome) : accueil, recherche à plusieurs ingrédients, notes, mise en place, minuteur, « + 1 min », barre des minuteurs, bandeau d'installation (événement du navigateur simulé). Reste à voir sur un vrai Android : la vraie fenêtre d'installation, et la vibration.
