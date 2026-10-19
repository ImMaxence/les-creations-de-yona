# Les créations de Yona

Blog de cuisine : recettes, catégories, recherche. Projet monorepo.

## Périmètre v1

- Accueil : header de présentation avec image, les 6 dernières recettes (bouton voir plus), bloc contact avec les réseaux sociaux.
- Page recettes : toutes les recettes, filtre par catégorie, barre de recherche.
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

- `social_link` : platform, url, position. Éditable depuis le back-office.
- `category` : name, slug (unique).
- `recipe` : title, slug (unique), intro, category_id, servings, prep_minutes, cook_minutes, image_key, created_at, updated_at.
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
- Création d'une recette : titre, catégorie, image, au moins 1 ingrédient et au moins 1 étape obligatoires.
- Erreurs API en ProblemDetail avec un code stable et un message en français, affichables en toast côté Angular.

## Images

- Upload passé par le backend, une image principale par recette, obligatoire à la création.
- Formats acceptés : JPEG (.jpg, .jpeg) et PNG, vérifiés sur le contenu réel (magic bytes) et non sur l'extension. HEIC non accepté en v1.
- Taille max à l'upload : 10 Mo, et limite de pixels décodés pour bloquer les images piégées.
- Paysage uniquement : largeur minimale 1200 px, hauteur minimale 800 px, ratio largeur/hauteur d'au moins 4:3.
- Suppression des métadonnées EXIF (dont la localisation GPS) et rotation appliquée selon l'EXIF.
- Pas d'agrandissement : une image plus petite que la cible garde sa taille.
- Sorties WebP de 800 px et 1600 px de large, qualité 80.
- En base : uniquement la clé S3 (`image_key`), préfixe `recipes/{uuid}/` contenant `800.webp` et `1600.webp`.

## Roadmap

- [ ] devops : Docker Compose (PostgreSQL, SeaweedFS), `.env.example`
- [ ] devops : Dockerfile du backend et du frontend
- [ ] devops : déploiement sur Coolify (plus tard, une fois le local fonctionnel)
- [ ] back : init Spring Boot 4, migration Flyway V1, entités et repositories
- [ ] back : service d'upload S3 (validation, resize, conversion) avec tests
- [ ] back : auth Google avec allowlist `APP_ADMIN_EMAILS`, session
- [ ] back : endpoints publics recettes et catégories
- [ ] front : page d'accueil (header, 6 dernières recettes, contact)
- [ ] front : page recettes (filtre par catégorie, recherche)
- [ ] back : ProblemDetail et springdoc-openapi exposé
- [ ] back : API admin (recettes, catégories, ingrédients, réseaux sociaux)
- [ ] front : back-office (guard, intercepteur HTTP, formulaires)
- [ ] front : génération des services depuis le openapi du backend
- [ ] front : Angular SSR, meta tags, JSON-LD, sitemap

## Points ouverts

- Quantité et unité d'ingrédient : optionnelles, unité en texte libre (à confirmer).
- Affichage des images : bucket S3 en lecture publique, ou images servies par le backend ? (à trancher)
- Remplacement de l'image d'une recette : suppression de l'ancien préfixe S3 (proposition : oui).
- Suppression d'une recette : suppression de son préfixe S3 (proposition : oui).
- Suppression d'une catégorie encore utilisée : bloquée tant qu'elle contient des recettes (proposition : oui).
- Réseaux sociaux : plateforme en liste fixe (Instagram, Facebook, etc.) ou texte libre (proposition : liste fixe).
- Google OAuth : deux URI de redirection à déclarer, une pour le local et une pour la production.
- Slug : généré depuis le titre, avec un suffixe numérique en cas de doublon (proposition : oui).
- Sauvegardes automatiques (dump PostgreSQL, volume S3 vers Google Drive) : plus tard, après la mise en place locale.
