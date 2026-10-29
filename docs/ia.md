# Remplir une recette avec l'IA (Gemini)

Depuis la 1.8.0, l'éditeur de recettes du back-office a un bouton **« Remplir avec l'IA »** : Gemini, l'IA de Google, lit une recette collée ou photographiée et remplit le formulaire. Gratuit (offre gratuite de l'API Gemini). Retour au [ReadMe](../ReadMe.md).

## Pour Yona

1. Dans une recette (nouvelle ou existante), **« Remplir avec l'IA »** en haut à droite.
2. Coller le texte d'une recette (notes, message, page recopiée) et/ou choisir une photo (recette manuscrite, capture d'écran ; JPEG ou PNG, 10 Mo au plus).
3. **« Remplir le formulaire »** : de quelques secondes à une minute.
4. Si le formulaire contenait déjà quelque chose, une confirmation est demandée avant de le remplacer. La photo, le statut (brouillon ou publiée), la programmation, « à la une » et la vidéo ne changent jamais.
5. Un bandeau rappelle de **tout relire** : quantités, temps, étapes, catégories et tags proposés. Rien n'est enregistré avant « Enregistrer ».

Ce que l'IA remplit : titre, présentation, portions, temps (préparation, repos, cuisson), difficulté si la recette l'indique, parties (s'il y en a), ingrédients (quantité, unité, précision), étapes (durée, ingrédients utilisés), matériel, moule, conseil, et catégories et tags choisis **parmi ceux du site**. Les ingrédients déjà connus gardent leur nom (« oeufs » devient « Œufs » s'il existe), pour éviter les doublons. Elle garde le ton du texte (tutoiement ou vouvoiement) et n'invente rien : ce que la recette ne dit pas reste vide.

N'envoyer que la recette : sur l'offre gratuite, Google peut conserver et relire ce qu'on lui envoie, et s'en servir pour améliorer ses services. Pas de visage, d'adresse ni de document personnel sur la photo.

## Quand le bouton est grisé ou qu'une erreur s'affiche

| Ce que dit le back-office | Pourquoi | Que faire |
| --- | --- | --- |
| « Le remplissage par IA n'est pas configuré » (bouton grisé) | Pas de clé `GEMINI_API_KEY` | L'ajouter (voir plus bas) |
| « Google refuse la clé Gemini » (bouton grisé) | Clé fausse, supprimée ou restreinte | En créer une autre dans Google AI Studio |
| « Les demandes gratuites sont épuisées pour aujourd'hui » (bouton grisé, avec l'heure de reprise) | Quota du jour atteint sur tous les modèles | Attendre : il repart à minuit heure de Californie, soit vers 9 h à Paris (8 h quelques semaines par an, quand les changements d'heure ne tombent pas le même jour) |
| « Trop de demandes en une minute » | Une dizaine de demandes par minute au plus | Réessayer un peu plus tard |
| « Gemini est indisponible pour le moment (très demandé) » | Google surchargé : c'est fréquent, et passager | Réessayer dans quelques minutes |
| « L'IA n'a pas trouvé de recette » | Texte ou photo sans recette lisible | Coller un texte plus complet, ou une photo plus nette |
| « La réponse de Gemini est illisible » | Réponse coupée ou hors format | Réessayer |

Les erreurs passagères (surcharge, trop de demandes) ne grisent pas le bouton : on ne peut pas les prévoir, seulement les constater au clic. Le back-office demande l'état à l'ouverture de l'éditeur, sans consommer de quota (lecture de la fiche du modèle).

## Mise en place

1. Créer une clé sur https://aistudio.google.com/apikey avec un compte Google : gratuite, sans carte bancaire. **Ne pas activer la facturation** sur le projet Google : au-delà du quota gratuit, les demandes deviendraient payantes.
2. En local : `GEMINI_API_KEY=…` dans `devops/.env`, puis recréer le backend (`docker compose --profile app up -d back`).
3. En production : Coolify, **Environment Variables**, `GEMINI_API_KEY`, puis redéployer.
4. Facultatif : `GEMINI_MODELS` (par défaut `gemini-flash-latest,gemini-flash-lite-latest`), les modèles essayés dans l'ordre.

Ne jamais mettre la clé dans le code, ni la donner au navigateur : seul le backend l'utilise.

## Fonctionnement

- Front : `pages/admin/recipe-editor/recipe-ai-dialog.ts` (fenêtre), `fromAiDraft` dans `recipe-draft.ts` (le brouillon reçu devient le formulaire), état du bouton par `GET /api/admin/recipe-ai`.
- Backend (`ai/`) : `POST /api/admin/recipe-ai` (multipart : `text`, 20 000 caractères au plus, et/ou `image`, JPEG ou PNG reconnu à son contenu, 10 Mo). Une seule lecture à la fois (sinon 409). Gemini est appelé hors de toute transaction.
  - `Gemini` : API REST `generateContent` en HTTPS (client HTTP du JDK, comme Google Drive), clé dans l'en-tête `x-goog-api-key`. Réponse structurée imposée par un schéma JSON (`responseJsonSchema`, `RecipeAiPrompt.schema()`). Modèles essayés dans l'ordre, 45 s chacun (deux modèles restent sous les 100 s de Cloudflare) : un modèle surchargé (503, 404 vide, délai dépassé), limité à la minute ou à court de quota du jour passe la main au suivant. Un quota du jour épuisé est retenu par modèle jusqu'à minuit, heure du Pacifique.
  - `RecipeAiPrompt` : la consigne (règles du site, en français) et le message (catégories, tags et ingrédients du site, puis la recette).
  - `RecipeAiReader` : rien de la réponse n'est pris tel quel. Longueurs, nombres et bornes de `RecipeForm`, difficulté arrondie au demi-point, un ingrédient une fois par partie (et les ingrédients des étapes suivent), catégories et tags absents du site écartés, moule rectangulaire sans largeur écarté, partie unique sans titre.
- Essai du 2026-10-28 avec une vraie clé : `gemini-flash-latest` a dépassé les 45 s (forte demande ce jour-là), `gemini-flash-lite-latest` a répondu une recette juste (ingrédients du site repris, catégories et tags choisis dans la liste, durées des étapes). `gemini-2.5-flash` n'est plus ouvert aux nouveaux comptes.
- Tests : classement des erreurs de Google, lecture d'une réponse (bornes, doublons, positions des ingrédients, moule), état du bouton, erreurs rendues au back-office ; front : `fromAiDraft`. Aucun test n'appelle Google.

## Limites de l'offre gratuite

Fin 2026 : modèles Flash et Flash-Lite seulement, environ 10 demandes par minute et de quelques centaines à 1 500 par jour selon le modèle (chiffres indicatifs, ils changent souvent ; voir la page des limites d'AI Studio). Pour quelques recettes par semaine, largement suffisant.

Sources : [conditions de l'API Gemini](https://ai.google.dev/gemini-api/terms), [limites](https://ai.google.dev/gemini-api/docs/rate-limits).
