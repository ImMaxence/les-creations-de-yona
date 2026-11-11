# L'IA du back-office : Gemini, Claude et modèles locaux

Depuis la 1.8.0, l'éditeur de recettes du back-office a un bouton **« Remplir avec l'IA »** : Gemini, l'IA de Google, lit une recette collée ou photographiée et remplit le formulaire. Gratuit (offre gratuite de l'API Gemini). Depuis la 2.7.0, Claude d'Anthropic est un troisième choix (payé à l'usage), les articles de Mon CAP ont **« Écrire avec l'IA »**, et les deux fenêtres ont **« Dicter »** (Whisper, sur l'ordinateur). Retour au [ReadMe](../ReadMe.md).

## Pour Yona

1. Dans une recette (nouvelle ou existante), **« Remplir avec l'IA »** en haut à droite.
2. Coller le texte d'une recette (notes, message, page recopiée) et/ou choisir une photo (recette manuscrite, capture d'écran ; JPEG ou PNG, 10 Mo au plus).
3. **« Remplir le formulaire »** : de quelques secondes à une minute.
4. Si le formulaire contenait déjà quelque chose, une confirmation est demandée avant de le remplacer. La photo, le statut (brouillon ou publiée), la programmation, « à la une » et la vidéo ne changent jamais.
5. Un bandeau rappelle de **tout relire** : quantités, temps, étapes, catégories et tags proposés. Rien n'est enregistré avant « Enregistrer ».

Ce que l'IA remplit : titre, présentation, portions, temps (préparation, repos, cuisson), difficulté si la recette l'indique, parties (s'il y en a), ingrédients (quantité, unité, précision), étapes (durée, ingrédients utilisés), matériel, moule, conseil, et catégories et tags choisis **parmi ceux du site**. Les ingrédients déjà connus gardent leur nom (« oeufs » devient « Œufs » s'il existe), pour éviter les doublons. Elle garde le ton du texte (tutoiement ou vouvoiement) et n'invente rien : ce que la recette ne dit pas reste vide.

N'envoyer que la recette : sur l'offre gratuite, Google peut conserver et relire ce qu'on lui envoie, et s'en servir pour améliorer ses services. Pas de visage, d'adresse ni de document personnel sur la photo.

## Écrire un article de Mon CAP (2.7)

1. Dans un article, **« Écrire avec l'IA »** en haut ; ou, dans « Nouvel article », la carte **« Écrire avec l'IA »** (un article vide, la fenêtre ouverte).
2. Choisir la forme : L'IA choisit, Récit (une journée, un examen), Pas à pas (une technique) ou Carnet (plusieurs remarques). Venant d'un modèle de « Nouvel article », sa forme est déjà choisie.
3. Écrire ou dicter ses notes en vrac, et/ou envoyer la photo de notes manuscrites (Gemini et Claude). Quatre boutons d'exemple remplissent le champ (examen blanc, technique pas à pas, remarques de la semaine, journée de stage).
4. **« Écrire l'article »** : titre, sous-titre et blocs proposés (texte en Markdown, grande photo, photo + texte, étapes en photos avec leurs légendes, astuce). Si l'article contenait déjà du texte, une confirmation est demandée ; les photos déjà placées sont gardées, aux places prévues pour des photos (les autres à la fin). Un bandeau rappelle de tout relire et d'ajouter les photos : une place laissée vide n'apparaît pas sur le site.

L'IA n'invente rien (ni fait, ni quantité, ni note), garde les mots et les nombres des notes, écrit à la première personne. Côté backend : `CapAiPrompt` (consigne et schéma), `CapAiReader` (blocs bornés à 20, longueurs de l'éditeur, liens retirés, « # » devenu intertitre, 2 à 8 étapes, côté des photos + texte alternés), `CapAiService` ; `POST /api/admin/cap-ai` (multipart : `text`, `image`, `form`, `engine`), `POST /api/admin/cap-ai/local-prompt` et `…/local-draft` pour l'IA locale. Essai du 2026-11-11 avec Gemini Flash-Lite : article juste en 2 s (Flash avait dépassé les 45 s ce jour-là).

## Claude (2.7)

Troisième choix des deux fenêtres, avec son logo : **Claude Haiku 5.5** d'Anthropic par défaut, rapide et peu cher, assez pour ranger un texte ou des notes dans le format du site. Payé à l'usage (environ un dixième de centime par recette ou article : 0,10 $ le million de mots-jetons lus, 0,50 $ le million écrits), sans offre gratuite ; Anthropic ne s'entraîne pas sur ce qu'on lui envoie par l'API.

- Mise en place : créer une clé sur https://console.anthropic.com (API Keys) et y mettre du crédit. Dans Coolify : `ANTHROPIC_API_KEY` (la clé), et facultatif `CLAUDE_MODEL` (par défaut `claude-haiku-5-5` ; `claude-sonnet-5-5` ou `claude-opus-5-5` pour lire des photos de recettes manuscrites difficiles, plus cher). En local : les mêmes dans `devops/.env`.
- Sans clé, Claude est grisé avec la raison. Une clé refusée ou un compte sans crédit le grisent 10 minutes (rien n'est demandé à Anthropic pour le savoir : chaque question est payée).
- Backend : SDK Java officiel (`com.anthropic:anthropic-java`), `Claude` (réponse au format JSON imposé par `output_config.format`, schéma de Gemini rendu strict : objets fermés, types nullables en `anyOf`), effort `medium`, 90 s au plus, aucun nouvel essai automatique ; avec Sonnet 5.5, Opus 5.5 ou Fable 5.2, une demande refusée par Claude passe à un autre modèle d'Anthropic (`fallbacks: "default"`) ; Haiku n'a pas ce repli, un refus s'affiche. `OnlineAi` choisit Gemini ou Claude ; la réponse passe par les mêmes contrôles (`RecipeAiReader`, `CapAiReader`). État : `GET /api/admin/claude`.

## Dictée (2.7)

**« Dicter »** sous le champ de texte des deux fenêtres : le navigateur demande le micro, Whisper large-v3-turbo d'OpenAI (licence MIT, 570 Mo en `q4f16`) écrit ce qui a été dit, en français, dans un worker, sur l'ordinateur : rien n'est envoyé, l'enregistrement n'est pas gardé. Le texte s'ajoute au champ ; l'IA choisie le lit au clic sur le bouton principal. 5 minutes au plus par dictée. Pendant l'enregistrement, un spectre en direct montre ce que le micro entend (2.7.2) ; rien pendant 3 secondes, un message dit de vérifier le micro. Sur téléphone, le bouton n'apparaît pas : le micro du clavier fait la même chose. Front : `core/local-ai/speech.worker.ts`, `transcribe-locally.ts` (enregistrement en 16 kHz mono), `shared/ui/dictation`.

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

## IA locale (1.21)

Dans **« Remplir avec l'IA »**, le bouton **« IA locale »** lit une recette collée sur l'ordinateur, sans passer par Google : utile quand le quota Gemini est épuisé, ou pour ne rien envoyer. **« Générer avec l'IA »**, sur chaque champ photo du back-office, dessine une image à partir d'une description ; elle passe ensuite par l'éditeur de photos, comme un fichier.

| | Modèle | Téléchargement | Licence |
| --- | --- | --- | --- |
| Lire une recette collée (texte seul) | Gemma 4 E4B de Google (`q4f16`) | 4,8 Go | Apache 2.0 |
| Générer une image (1024 × 768, ou 768 × 1024 en portrait) | FLUX.2 klein 4B de Black Forest Labs, avec Qwen3 4B d'Alibaba qui lit la description | 6,1 Go | Apache 2.0 |

- Chaque modèle se télécharge une fois, directement depuis Hugging Face (le serveur du site n'en sert aucun), puis reste dans le cache de ce navigateur, sur le disque de cet ordinateur. **« Supprimer »** rend la place ; effacer les données du site dans le navigateur le supprime aussi, il faudra alors le retélécharger.
- Sur téléphone et tablette, l'IA locale est grisée : ils n'ont pas assez de mémoire graphique.
- Il faut un navigateur récent avec WebGPU (Chrome, Edge, Safari) et assez de mémoire : fermer les applications lourdes.
- Gemma n'a pas de format imposé : on lui demande du JSON, que le backend contrôle comme une réponse de Gemini.
- L'IA locale ne lit pas les photos, seulement le texte collé : essayé le 2026-11-08, le modèle lisait mal les quantités d'une recette manuscrite (250 g lu 350 g) et oubliait des étapes. Pour une photo, Gemini.
- Essai du 2026-11-08 (Chrome, Radeon RX 5700 XT) : recette tapée, juste en 83 s ; image 1024 × 768, environ 5 min. À mesurer sur le MacBook M2 16 Go, qui sera plus lent.

Fonctionnement :

- Front (`core/local-ai/`) : `local-models.ts` (fichiers et commit figés), `model-store.ts` (téléchargement dans le Cache storage, hors service worker), `recipe-reader.worker.ts` (Transformers.js), `image.worker.ts` et `generate-image.ts` (ONNX Runtime Web).
- Un worker par réseau de neurones, terminé avant le suivant : c'est la seule façon de rendre la mémoire graphique. Le WebAssembly d'ONNX Runtime est servi par le site (`/ort/`, copié par `angular.json`), pas par un CDN.
- Changer de modèle : mettre à jour `local-models.ts` (dépôt, commit, fichiers et tailles).
- Backend : `GET /api/admin/recipe-ai/local-prompt` (consigne, schéma, noms du site) et `POST /api/admin/recipe-ai/local-draft` (la réponse, passée à `RecipeAiReader`).

## Fonctionnement de Gemini

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
