# Les créations de Yona

Blog de cuisine : recettes, catégories, recherche. Projet monorepo.

Dernière mise à jour : 2026-10-19 22:06.

## Périmètre v1

- Accueil : header de présentation avec image, les 6 dernières recettes (bouton voir plus), rangée de catégories avec image cliquable.
- Page recettes : toutes les recettes, filtre par catégorie, barre de recherche avec autocomplétion sur le titre.
- Page recette : titre, image, catégorie, ingrédients, étapes, date de dernière mise à jour.
- Page à propos : présentation du blog et de son auteur.
- Navigation : navbar (accueil, recettes, catégories, lien administration pour les admins) et footer sur toutes les pages.
- Administration : back-office (recettes, catégories, ingrédients, réseaux sociaux) pour 2 utilisateurs autorisés via Google, pas de création de compte.
- SEO : Angular SSR, balises meta par page, données structurées Recipe (JSON-LD), sitemap.

## Stack

| Partie | Choix |
| --- | --- |
| Frontend | Angular 22 |
| Backend | Spring Boot 4, Java 25 LTS |
| Base de données | PostgreSQL |
| Migrations | Flyway |
| Auth | Google (OIDC) via Spring Security, session serveur (cookie HttpOnly) |
| Images | S3 via AWS SDK v2 (BOM), SeaweedFS en local et sur Coolify, clé S3 stockée en base |
| DevOps | Docker Compose sur Coolify : PostgreSQL et SeaweedFS en conteneurs |
| Validation API | ProblemDetail (RFC 9457) |
| Mapping | MapStruct avec une configuration partagée `@MapperConfig` |
| Boilerplate | Lombok limité (getters et setters des entités, constructeur des services), DTO en records |
| Documentation API | springdoc-openapi exposé par le backend, consommé par le front pour générer ses services |
| Hébergement | Serveur perso sur Coolify, Cloudflare en DNS et proxy |

## Structure

```
back/      API Spring Boot
front/     application Angular
devops/    Docker Compose, configuration d'environnement
ReadMe.md
```

## Modèle de données

- `social_link` : platform (liste fixe : YouTube, TikTok, Instagram, extensible), url, position. Éditable depuis le back-office.
- `category` : name, slug (unique), image_key (facultative).
- `recipe` : title, slug (unique), intro, status (publiée ou brouillon), category_id, servings, prep_minutes, cook_minutes, image_key, created_at, updated_at, created_by, updated_by (email de l'admin, texte).
- `ingredient` : name (unique).
- `recipe_ingredient` : recipe_id, ingredient_id, quantity, unit, note, position. Clé primaire (recipe_id, ingredient_id).
- `recipe_step` : recipe_id, position, description, duration_minutes.

## Décisions

- Ingrédients structurés (table dédiée + table de liaison), pas de texte ou HTML libre.
- Étapes en texte ou Markdown rendu côté Angular, jamais de HTML brut en base.
- Session serveur (cookie HttpOnly, Secure, SameSite), expirée après 7 jours d'inactivité, plutôt que JWT. Sessions en mémoire, sans persistance en base. Bouton de déconnexion.
- Cookies : pas de bandeau tant que seuls les cookies strictement nécessaires existent (session, CSRF). À vérifier, mentions légales et politique de confidentialité requises.
- Flyway plutôt que Liquibase : migrations SQL simples, base PostgreSQL unique.
- Noms de tables, colonnes et code en anglais.
- Authentification Google OIDC. Allowlist des emails admin dans la variable d'environnement `APP_ADMIN_EMAILS`, sans table utilisateur.
- Autorisation par règles d'URL dans Spring Security : `/api/admin/**` réservé aux admins.
- Recherche par JPA Specifications sur titre et catégorie, insensible à la casse et aux accents (extension `unaccent`).
- Pagination offset avec `Pageable`. L'accueil appelle la même route avec `size=6`.
- Routage sur un domaine unique : site à la racine, API sous `/api`.
- Pas de tests pour la v1, ni backend ni frontend.
- Interface en français uniquement.
- Mobile first : conception pour écran de téléphone d'abord (environ 90 % du trafic), puis adaptation desktop. Images servies en plusieurs tailles (srcset).
- Création d'une recette : titre, catégorie, au moins 1 ingrédient et au moins 1 étape obligatoires. Image facultative.
- Erreurs API en ProblemDetail avec un code stable et un message en français, affichables en toast côté Angular.
- Quantité et unité d'ingrédient optionnelles, unité en texte libre.
- Suppression d'une recette : suppression de son préfixe S3.
- Suppression d'une catégorie encore utilisée : bloquée tant qu'elle contient des recettes.
- Réseaux sociaux : plateforme en liste fixe (YouTube, TikTok, Instagram), extensible si besoin.
- Remplacement d'une image : suppression de l'ancienne image S3, puis envoi de la nouvelle.
- Slug (URL de la recette) : généré depuis le titre, suffixe numérique en cas de doublon. Pas de timestamp.
- Google OAuth : deux URL de retour, une pour le local et une pour la production.
- Recette sans image : visuel par défaut côté Angular.
- Sessions en mémoire : un redémarrage ou un redéploiement déconnecte l'admin, accepté.
- Statut de publication : publiée ou brouillon. Un brouillon n'est visible que dans le back-office.
- Champs optionnels : portions, temps de préparation et de cuisson, durée d'une étape.
- Ingrédients : page dédiée dans le back-office (modifier, supprimer). Suppression bloquée si l'ingrédient est utilisé.
- Ingrédients : unicité insensible à la casse et aux accents.
- Footer sur toutes les pages : réseaux sociaux, mentions légales, politique de confidentialité.
- URL des recettes SEO friendly : `/recettes/{slug-categorie}/{slug-recette}`.
- Navbar : accueil, recettes, catégories en menu déroulant (environ 10 au maximum), lien administration visible seulement pour les admins.
- Clic sur une catégorie : la page recettes s'ouvre pré-filtrée (`/recettes?categorie={slug}`).
- Recette recherchée par slug seul. Si le segment catégorie de l'URL ne correspond pas, redirection 301 vers l'URL canonique, gérée par Angular SSR qui interroge l'API par slug.
- Pages d'erreur : 404 pour les URL inconnues, recettes introuvables ou en brouillon, et page d'erreur serveur.
- Recherche par titre : autocomplétion côté backend, avec un endpoint dédié.
- Autocomplétion : 5 suggestions maximum.
- Pas de bouton de connexion sur le site public : l'admin se connecte uniquement via `/admin`.
- Pagination de la page recettes : pages numérotées, avec choix du nombre d'éléments par page.
- Connexion Google d'un email non autorisé : page d'accès refusé.
- Texte alternatif des images : titre de la recette. Meta description : extrait de l'intro.
- Page « à propos » en v1, texte de présentation fourni par l'auteur du blog.
- Logo : fichier en dur dans le projet Angular.
- Couleurs : définies dans un fichier `variables.scss`.
- Domaine : `https://les-creations-de-yona.fr/`, déjà en place. Sert pour les URL Google OAuth, le sitemap et les URL canoniques.
- Ordre des ingrédients et des étapes : glisser-déposer dans le back-office.
- Modification d'une recette : `updated_at` enregistré à chaque sauvegarde, `created_by` et `updated_by` renseignés depuis la session admin.
- Pas de commentaires sur le site, ni en v1 ni prévus.
- Page recette : affichage de la date de dernière mise à jour.
- Menu mobile : bouton hamburger qui ouvre un panneau plein écran (catégories, recettes, accueil, administration pour les admins).
- Accueil : 6 dernières recettes, suivies d'une rangée de catégories avec image, cliquables vers `/recettes?categorie={slug}`.

## Images

- Upload passé par le backend, une image principale par recette, facultative à la création.
- Catégories : une image facultative, même traitement que les recettes. Préfixe `categories/{uuid}/`. Sans image : visuel par défaut côté Angular.
- Accès : bucket S3 privé, images servies par le backend avec cache HTTP. Seul le backend accède au bucket.
- Formats acceptés : JPEG (.jpg, .jpeg) et PNG, vérifiés sur le contenu réel (magic bytes) et non sur l'extension. HEIC non accepté en v1.
- Taille max à l'upload : 10 Mo, et limite de pixels décodés pour bloquer les images piégées.
- Paysage uniquement : largeur minimale 1200 px, hauteur minimale 800 px, ratio largeur/hauteur d'au moins 4:3.
- Suppression des métadonnées EXIF (dont la localisation GPS) et rotation appliquée selon l'EXIF.
- Pas d'agrandissement : une image plus petite que la cible garde sa taille.
- Sorties WebP de 800 px et 1600 px de large, qualité 80.
- En base : uniquement la clé S3 (`image_key`), préfixe `recipes/{uuid}/` contenant `800.webp` et `1600.webp`.
- L'original JPEG ou PNG n'est pas conservé : seules les versions WebP sont stockées.

## Roadmap

- [ ] devops : Docker Compose (PostgreSQL, SeaweedFS), `.env.example`
- [ ] devops : Dockerfile du backend et du frontend
- [ ] devops : déploiement sur Coolify (plus tard, une fois le local fonctionnel)
- [ ] back : init Spring Boot 4, migration Flyway V1, entités et repositories
- [ ] back : service d'upload S3 (validation, resize, conversion) avec tests
- [ ] back : auth Google avec allowlist `APP_ADMIN_EMAILS`, session
- [ ] back : endpoints publics recettes et catégories
- [ ] back : endpoint d'autocomplétion des titres
- [ ] front : page d'accueil (header, 6 dernières recettes)
- [ ] front : page recettes (filtre par catégorie, recherche)
- [ ] front : page recette, navbar avec menu déroulant, footer, page 404
- [ ] back : ProblemDetail et springdoc-openapi exposé
- [ ] back : API admin (recettes, catégories, ingrédients, réseaux sociaux)
- [ ] front : back-office (guard, intercepteur HTTP, formulaires)
- [ ] front : génération des services depuis le openapi du backend
- [ ] front : Angular SSR, meta tags, JSON-LD, sitemap

## Points ouverts

- Mentions légales et politique de confidentialité : à rédiger ensemble.
- Sauvegardes automatiques (dump PostgreSQL, volume S3 vers Google Drive) : plus tard, après la mise en place locale.
- Polices : à choisir sur Google Fonts.
