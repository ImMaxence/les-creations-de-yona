# Remplir une recette par IA : étude

Étude (3.7.0), rien n'est encore codé. Question posée : peut-on, gratuitement, laisser une IA comme Gemini pré-remplir l'éditeur de recettes du back-office ? Retour au [ReadMe](../ReadMe.md).

## Ce que ça ferait

Dans l'éditeur, un bouton « Remplir avec l'IA » : Yona colle le texte d'une recette (notes, message, page de carnet recopiée) ou envoie la photo d'une recette écrite à la main. L'IA rend une recette structurée, qui remplit le formulaire **sans rien enregistrer** : titre, présentation, portions, temps de préparation, de repos et de cuisson, difficulté, parties, ingrédients (nom, quantité, unité, précision), étapes (texte, durée), matériel, conseil. Yona relit, corrige, choisit les catégories et la photo, puis enregistre comme d'habitude.

L'IA ne publie jamais rien et ne touche pas à la base : elle propose, l'éditeur et ses règles de validation restent les mêmes.

## Faisabilité

Oui, sans difficulté technique :

- **Sortie structurée** : Gemini accepte un schéma JSON (`responseSchema`) et ne répond que dans ce format. Le schéma reprend les champs de `RecipeForm` : pas de texte à analyser, une réponse directement lisible par le front.
- **Texte ou photo** : les modèles Flash lisent aussi les images (recette manuscrite, capture d'écran).
- **Ingrédients** : les noms rendus sont comparés aux ingrédients existants (casse et accents ignorés, comme `SimilarNames`), pour réutiliser « Beurre doux » plutôt que d'en créer un doublon.
- **Unités** : le schéma et la consigne imposent les unités du site (g, ml, c. à soupe…) et des durées en minutes.

## Coût : l'offre gratuite de Gemini

Google propose une offre gratuite de l'API Gemini, avec une clé créée dans Google AI Studio, sans carte bancaire. Fin 2026, elle ne couvre plus que les modèles Flash et Flash-Lite (les modèles Pro sont payants depuis avril 2026), avec des limites d'environ 10 requêtes par minute et 1 500 par jour, selon le modèle et le projet. Pour quelques recettes par semaine, c'est largement suffisant. Les limites changent souvent : à vérifier sur la page des limites d'AI Studio au moment de coder.

Point d'attention, dans les conditions de Google : sur l'offre gratuite, **Google peut utiliser les textes et images envoyés, et les réponses, pour améliorer ses produits**, et des personnes peuvent les relire. Google demande de ne pas y envoyer d'informations personnelles ou confidentielles. Ici, ce qui part est le texte d'une recette que Yona va de toute façon publier : rien de personnel, rien sur les visiteurs. Acceptable, à condition de ne pas envoyer de photo où figure autre chose que la recette (visage, adresse…). Activer la facturation sur le projet Google ferait passer tout l'usage sous le régime payant, où Google n'utilise pas les données, mais ce n'est alors plus gratuit au-delà des quotas.

## Autres pistes

| Piste | Coût | Remarques |
| --- | --- | --- |
| **Gemini Flash (offre gratuite)** | 0 € | Recommandé. Qualité suffisante pour structurer une recette, lit les photos |
| Gemini, Claude ou autre API, en payant | Quelques centimes par recette | Données non réutilisées par le fournisseur. Utile si l'offre gratuite disparaît ou si les quotas baissent |
| Modèle local (Ollama) sur le serveur | 0 € | Pas de tiers, mais lent sur le processeur du serveur Coolify, gourmand en mémoire, moins fiable en français et pour les photos |

## Comment le coder

1. Backend : `POST /api/admin/recipes/ai-draft` (admin seulement, multipart : `text` et/ou `image`), qui appelle Gemini avec la clé `GEMINI_API_KEY` (variable d'environnement dans Coolify, jamais envoyée au navigateur) et rend un `RecipeForm` partiel. Sans clé, la route répond 503 et le bouton n'apparaît pas. Taille limitée (texte de 20 000 caractères, image de 10 Mo, comme les photos), une requête à la fois par admin, délai de 60 s.
2. Front : bouton dans l'éditeur, fenêtre « Coller la recette ou envoyer une photo », puis formulaire rempli et un bandeau « Remplie par l'IA : relisez avant d'enregistrer ». Ne remplace pas un formulaire déjà commencé sans confirmation.
3. Erreurs : quota atteint (429), réponse illisible ou hors schéma : message clair, rien n'est rempli.
4. Tests : lecture de la réponse (schéma, unités, ingrédients rapprochés), sans appeler Google.

Estimation : une petite version mineure (3.8.0), sans migration de base.

## Côté légal

Seule Yona utilise la fonction, avec ses propres textes. Aucune donnée des visiteurs n'est envoyée : la politique de confidentialité n'a pas besoin de changer. Si la fonction voit le jour, ajouter quand même une ligne dans la politique (« les textes de recettes saisis dans le back-office peuvent être transmis à Google Gemini pour être mis en forme ») par transparence, et dans ce document le modèle utilisé.

## Sources

- Conditions de l'API Gemini (offre gratuite et payante, usage des données) : https://ai.google.dev/gemini-api/terms
- Limites de l'offre gratuite (indicatives, à vérifier dans AI Studio) : https://ai.google.dev/gemini-api/docs/rate-limits
