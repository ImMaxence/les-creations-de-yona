# Consignes pour Claude

- Pour voir vite le projet, lire [ReadMe.md](ReadMe.md) ; le détail est dans [docs/developpement.md](docs/developpement.md).
- Le projet tourne en local dans Docker Desktop. Je travaille sur plusieurs PC : après un `git pull`, remettre les conteneurs à jour avec `cd devops && docker compose --profile app up -d --build --wait`.
- À chaque changement, monter la version : front (`front/package.json`) et backend (`back/pom.xml`, balise `<version>` du projet, pas celle du parent) toujours ensemble, même numéro. Majeur = casse l'existant, feature = mineure, fix = correctif. Règle complète et fichiers à toucher : [docs/developpement.md](docs/developpement.md#monter-la-version).
- Changelog ([CHANGELOG.md](CHANGELOG.md)) : toujours en anglais, synthétique, en points courts.
- Ne pas modifier à la main `front/src/app/core/api/generated` (généré par `npm run api:generate`).
- Tests : `npm test` dans `front/`, `./mvnw test` dans `back/`.
- Textes affichés sur le site : pas de point à la fin d'un paragraphe, d'un message ou d'une erreur ; les points entre deux phrases restent. Sauf mentions légales et politique de confidentialité.
- Ne pas commiter sans demande explicite.
