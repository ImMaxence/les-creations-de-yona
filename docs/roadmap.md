# Roadmap

Les versions passées, résumées (le détail depuis la 3.1.0 est dans le [CHANGELOG](../CHANGELOG.md)), et ce qui reste à vérifier. Retour au [ReadMe](../ReadMe.md).

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
- [x] 3.0.0 : tags (migration V7), filtres temps et difficulté, photo Pinterest et bouton « Épingler », favoris, liste de courses, mode cuisine, impression ; restauration d'une sauvegarde (fusion ou remplacement) ; statistiques (recettes à compléter, brouillons oubliés, recettes à rafraîchir, recherches sans résultat, export PDF) ; préréglages d'apparence, 5 thèmes et 5 polices de titres en plus ; photo « À propos » enregistrée avec le bouton ; infobulles à côté des icônes
- [x] 3.0.0 : majuscule aux ingrédients et aux noms commençant par un emoji (migration V8), « Effacer tous les filtres » sur la page Recettes
- [x] 3.1.0 : notifications des nouvelles recettes (Web Push), sauvegarde de nuit sur Google Drive, corbeille, publication programmée, « Dupliquer », brouillon gardé dans le navigateur, glossaire, « Le conseil de Yona », temps de repos et « Organiser mon temps », adaptation au moule, « Vous aimerez aussi », ingrédients par étape et sonnerie du mode cuisine, icônes intégrées sans Lucide (migration V9)
- [x] 3.2.0 : encart des notifications sur l'accueil, dernières recettes avant « À propos » ; mode cuisine : « Mise en place », « + 1 min », minuteurs gardés une fois le mode fermé, minuteur qui part bien de 1:00, vibration légère au rythme de la sonnerie ; « Mes notes » sur chaque recette ; recherche avec plusieurs ingrédients ; « Installer l'application » retiré de la navbar, bandeau d'installation ; page « Nouveautés » (CHANGELOG) dans le back-office ; tests unitaires front (Vitest) et backend (JUnit)
- [x] 3.3.0 : minuteurs gardés sur tout le site, minuteur libre ; liste de courses par rayon (rayon des ingrédients dans le back-office) ; matériel des recettes ; réponse 400 aux adresses mal encodées ; parcours dans Chrome (`e2e/`) ; documentation découpée (`docs/`), captures d'écran, licence MIT (migration V10)

## Points ouverts

- Vérification en ligne : connexion Google, upload d'une photo depuis l'iPhone, sauvegarde ZIP, restauration (d'abord une fusion avec une sauvegarde toute fraîche : rien à ajouter attendu).
- Après la mise en ligne : déclarer `https://les-creations-de-yona.fr/sitemap.xml` dans Google Search Console.
- 3.1.0 en ligne : réglages Google Drive (voir « Services Google »), connexion du Drive, puis vérifier une notification de nouvelle recette sur un Android et sur un iPhone avec l'application installée.
- 3.3.0 en ligne : ranger les ingrédients dans leur rayon (back-office, Ingrédients, « sans rayon »), compléter le matériel des recettes, remplacer les captures d'écran de `docs/captures/` (faites avec la base locale) ; vérifier sur un Android la vraie fenêtre d'installation et la vibration.
- 3.2.0 : vérifié sur la pile Docker locale (Chrome) : accueil, recherche à plusieurs ingrédients, notes, mise en place, minuteur, « + 1 min », barre des minuteurs, bandeau d'installation (événement du navigateur simulé). Reste à voir sur un vrai Android : la vraie fenêtre d'installation, et la vibration.
