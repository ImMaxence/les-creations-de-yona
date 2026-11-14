# Valeurs nutritionnelles, Nutri-Score et besoins du jour

Depuis la 2.15.0, une recette peut afficher ce qu'elle apporte : calories par portion, protéines, glucides, lipides, un tableau par portion et pour 100 g, un **Nutri-Score estimé** et, pour le visiteur, **« Mes besoins du jour »**. Tout est calculé par le site à partir des ingrédients de la recette et de leurs quantités. Retour au [ReadMe](../ReadMe.md).

## Pour les visiteurs

Sur une recette où Yona les affiche :

- **« Énergie »** parmi les repères du haut de la recette (préparation, cuisson…) : les kcal d'une portion, un lien vers les valeurs.
- **Valeurs nutritionnelles**, après la préparation : le Nutri-Score estimé (A à E), quatre chiffres (kcal, protéines, glucides, lipides par portion), le tableau par portion et pour 100 g dans l'ordre des étiquettes (énergie, matières grasses dont saturées, glucides dont sucres, fibres, protéines, sel), les ingrédients non comptés et la source.
- **Mes besoins du jour** : sexe, âge, taille, poids, activité et objectif. Le site donne :
  - les besoins du jour en kcal ;
  - si une portion est légère, équilibrée ou copieuse pour un repas, et la part conseillée ;
  - « Ma part », réglable par quarts de portion, avec une jauge de la part de la journée et le repère d'un repas ;
  - « D'où vient l'énergie » : la part des protéines, des glucides et des lipides, face aux repères de l'Anses.
- Les réponses restent dans le navigateur (stockage local, clé `yona-daily-needs`), reprises sur les recettes suivantes. Rien n'est envoyé au site ; « Effacer mes informations » les supprime.

Une recette sans portions donne les valeurs de la recette entière. Le calculateur est fait pour les adultes (18 à 100 ans).

## Pour Yona

### Afficher les valeurs d'une recette

Dans l'éditeur de recette, panneau **« Valeurs nutritionnelles »** :

- la case **« Afficher les valeurs nutritionnelles sur la recette »** (décochée par défaut : rien ne change sur les recettes existantes) ;
- l'estimation de la recette en cours d'écriture, recalculée pendant la frappe : kcal par portion, Nutri-Score, protéines, glucides, lipides ;
- les ingrédients **non comptés** et pourquoi :
  - sans quantité (« sel, au goût ») ;
  - poids d'une pièce inconnu (« 2 gousses » d'un ingrédient sans équivalent en grammes : à indiquer dans Ingrédients) ;
  - sans valeurs nutritionnelles : l'aliment le plus probable est proposé, **« Lier à … »** en un clic.

Un ingrédient tout juste tapé n'existe qu'une fois la recette enregistrée : on lui donne ses valeurs ensuite.

### Donner ses valeurs à un ingrédient

Dans **Ingrédients**, le bouton carotte de chaque ligne ouvre ses valeurs nutritionnelles. Trois façons de les donner :

1. **Aliment Ciqual** : les aliments les plus proches de son nom sont proposés d'emblée ; on peut aussi chercher (« beurre dou », « farine t55 »). « Choisir » le lie.
2. **Produit du commerce** : pour un produit de marque (Kinder Bueno, whey, biscuits…), chercher son nom ou les chiffres de son code-barres. Les produits d'Open Food Facts s'affichent avec leurs kcal ; « Utiliser ces valeurs » remplit l'étiquette, à vérifier puis enregistrer.
3. **Étiquette** : les 8 valeurs du tableau nutritionnel du paquet, pour 100 g, et leur provenance (facultative).

Un ingrédient a l'un ou l'autre : un aliment Ciqual, ou une étiquette. La ligne montre « Ciqual · 753 kcal » ou « Étiquette · 380 kcal ». Le filtre **« Valeurs nutritionnelles »** et le lien **« N sans valeurs nutritionnelles »** montrent ceux des recettes à compléter.

**« Proposer les valeurs nutritionnelles »** (en haut de la page) : pour chaque ingrédient des recettes sans valeurs, le plus utilisé d'abord, les trois aliments les plus probables, le premier choisi. On vérifie, on change ou on choisit « Aucun », puis **« Lier N ingrédients »** les lie tous d'un coup.

Chaque changement est dans l'Historique (« Valeurs nutritionnelles » : avant, après).

### Une nouvelle version de la table Ciqual

L'Anses met à jour la table tous les quelques années. **« Table Ciqual »** (en haut d'Ingrédients) montre la version du site et son nombre d'aliments. Pour la remplacer :

1. Télécharger le fichier Excel (`.xlsx`) de la nouvelle version sur [ciqual.anses.fr](https://ciqual.anses.fr/) (ou sur [recherche.data.gouv.fr](https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY) pour la 2025).
2. **« Importer une nouvelle version »**, choisir le fichier, confirmer.
3. Le site lit les colonnes par leur titre, quel que soit leur ordre. Il garde les aliments par leur code (les ingrédients restent liés, les recettes suivent les nouvelles valeurs), ajoute les nouveaux et retire ceux qui ont disparu.
4. Le résultat : nombre d'aliments, ajoutés, retirés, et les ingrédients dont l'aliment a disparu, à lier de nouveau.

Tout ou rien : un fichier qui n'est pas la table (une colonne manque, moins de 500 aliments, pas un `.xlsx`) ne change rien, et le message nomme ce qui manque. 10 Mo au plus (la table 2025 pèse 1,5 Mo). La version (« Ciqual 2025 ») vient du nom du fichier ; un fichier renommé est nommé par sa date d'import.

## D'où viennent les valeurs

### La table Ciqual de l'Anses

La [table Ciqual](https://ciqual.anses.fr/) est la table officielle de composition des aliments en France. La version 2025, publiée le 19/11/2025, compte 3 484 aliments génériques (« Beurre à 80% MG minimum, doux », « Oeuf cru », « Spéculoos »), sous [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/) : réutilisation libre, source citée (sous les valeurs, et dans les mentions légales).

Elle est **dans la base du site** (tables `ciqual_food` et `ciqual_table`), installée par la migration V32. Le site ne l'interroge jamais en ligne. Il garde, pour 100 g, ce qu'il affiche :

| Colonne | Constituant Ciqual |
| --- | --- |
| `kcal` | Énergie, Règlement UE N° 1169/2011 (kcal/100 g) |
| `proteins` | Protéines, N x 6,25 (comme les étiquettes), sinon N x facteur de Jones |
| `carbohydrates`, `sugars` | Glucides, Sucres |
| `fat`, `saturated_fat` | Lipides, AG saturés |
| `fibre` | Fibres alimentaires |
| `salt` | Sel chlorure de sodium |

« traces » et « < x » comptent pour 0, « - » (non donné) est gardé vide et compte pour 0 dans les calculs. Sans énergie donnée, elle est déduite (4 kcal par gramme de protéines ou de glucides, 9 de lipides, 2 de fibres). Le sous-groupe de l'aliment (`subgroup_code`) dit s'il est un fruit, un légume ou une légumineuse (0204, 0201, 0203), ce que le Nutri-Score compte.

Sauvegardes : les tables Ciqual sont sauvegardées et remises par « Tout remplacer » ; « Fusionner » garde la version du site et ne reprend le lien d'un ingrédient ajouté que si son aliment existe sur le site.

### Les aliments proposés pour un ingrédient

`CiqualSearch` compare les mots (majuscules, accents, pluriels et petits mots ignorés) :

- pour les ingrédients les plus courants, un aliment habituel est proposé en premier : « Farine » → farine T45 pour pâtisserie, « Beurre » → beurre doux, « Œufs » → œuf cru, « Sucre » → sucre blanc, « Crème liquide » → crème 30 % fluide…
- sinon, les aliments qui ont le premier mot de l'ingrédient, et le plus possible des autres ;
- à égalité, d'abord un aliment nommé par ce mot, un « aliment moyen » de la table, un aliment cru ; ensuite seulement les aliments cuits, les plats préparés et les aliments infantiles ; un nom court passe avant un long.

### Open Food Facts, pour les produits du commerce

[Open Food Facts](https://fr.openfoodfacts.org/) est la base ouverte et collaborative des produits alimentaires (licence ODbL). Le site **ne la copie pas** : elle compte des millions de produits du monde entier et change chaque jour. Le backend l'interroge **seulement quand Yona cherche un produit** dans le back-office :

- par nom : `https://search.openfoodfacts.org/search?q=…` ;
- par code-barres (8 à 14 chiffres) : `https://world.openfoodfacts.org/api/v2/product/{code}.json`.

Seul le texte cherché est envoyé, avec un `User-Agent` générique. 10 produits au plus, ceux dont l'étiquette donne l'énergie. Valeurs manquantes : 0 ; énergie en kJ convertie en kcal ; sel déduit du sodium (× 2,5) ; sucres et graisses saturées ramenés aux glucides et aux matières grasses s'ils les dépassent.

Les valeurs choisies sont **recopiées sur l'ingrédient** (son étiquette, avec sa provenance). Les visiteurs ne déclenchent jamais d'appel à Open Food Facts. Si Open Food Facts ne répond pas (8 secondes), l'admin voit « Open Food Facts ne répond pas pour le moment » et peut saisir l'étiquette à la main : rien d'autre n'en dépend.

## Le calcul

Pour chaque ligne de la recette, recettes liées dépliées (une pâte sablée × 0,5 compte pour moitié) :

1. **La quantité en grammes** (`common/Quantities`, partagé avec le prix de revient) : g, kg, mg ; ml, cl, dl, l (1 ml compté comme 1 g) ; cuillère à soupe 15 ml, à café 5 ml ; pincée 0,5 g ; toute autre unité (gousse, sachet, rouleau, aucune) compte des pièces, au poids d'une pièce de l'ingrédient (« 1 œuf = 50 g », dans Ingrédients).
2. **Ses valeurs** : celles de son aliment Ciqual ou de son étiquette, pour 100 g, multipliées par les grammes.
3. Une ligne sans quantité, sans poids d'une pièce ou sans valeurs est laissée de côté et nommée.

Les totaux donnent **la recette entière**, **une portion** (divisée par le nombre de portions de la recette) et **100 g** (divisée par le poids des ingrédients comptés). Ce poids est celui des ingrédients **crus** : l'eau perdue à la cuisson n'est pas comptée, une estimation donc, comme le dit la page.

La recette publique est calculée à la demande et gardée dans le cache des réponses publiques (oublié à chaque changement du back-office, un lien d'ingrédient compris).

## Le Nutri-Score estimé

Calculé pour 100 g de la recette, avec l'**algorithme 2023 de Santé publique France pour les aliments en général** (`NutriScore`) :

| Points | Seuils (pour 100 g, un point de plus à chaque seuil dépassé) |
| --- | --- |
| Énergie, 0 à 10 | 335, 670, 1 005, 1 340, 1 675, 2 010, 2 345, 2 680, 3 015, 3 350 kJ |
| Sucres, 0 à 15 | 3,4 · 6,8 · 10 · 14 · 17 · 20 · 24 · 27 · 31 · 34 · 37 · 41 · 44 · 48 · 51 g |
| Acides gras saturés, 0 à 10 | 1 à 10 g, de 1 en 1 |
| Sel, 0 à 20 | 0,2 à 4 g, de 0,2 en 0,2 |
| Protéines, 0 à 7 (en moins) | 2,4 · 4,8 · 7,2 · 9,6 · 12 · 14 · 17 g |
| Fibres, 0 à 5 (en moins) | 3,0 · 4,1 · 5,2 · 6,3 · 7,4 g |
| Fruits, légumes, légumineuses (en moins) | 1 point au-delà de 40 %, 2 au-delà de 60 %, 5 au-delà de 80 % du poids |

Score = points des quatre premiers − points des trois derniers ; les protéines ne comptent plus dès 11 points des premiers. Classes : **A** jusqu'à 0, **B** 1 à 2, **C** 3 à 10, **D** 11 à 18, **E** au-delà. Les règles propres aux boissons, aux matières grasses, aux fromages et aux viandes rouges ne sont pas appliquées : une recette est comptée comme un aliment.

Le **logo officiel** du Nutri-Score est une marque de Santé publique France, réservée aux produits enregistrés selon son règlement d'usage. Le site affiche donc son propre badge, « Nutri-Score estimé », les cinq lettres et celle de la recette en couleur, et le dit sous les valeurs et dans les mentions légales.

## Mes besoins du jour

- **Énergie au repos** (Mifflin-St Jeor, 1990) : 10 × poids (kg) + 6,25 × taille (cm) − 5 × âge, + 5 pour un homme, − 161 pour une femme.
- **Activité** : × 1,2 sédentaire, 1,375 peu actif, 1,55 actif, 1,725 très actif, 1,9 sportif intensif.
- **Objectif** : × 0,85 pour perdre du poids, × 1 pour le garder, × 1,1 pour prendre du muscle. Arrondi à 10 kcal.
- **Un repas principal** : un tiers de la journée (le repère de la jauge). Une portion sous le quart de la journée est **légère**, au-delà des deux cinquièmes **copieuse** : la part conseillée est alors celle qui fait un tiers de la journée, par quarts de portion, de ¼ à 4. Entre les deux, une portion fait un repas équilibré.
- **D'où vient l'énergie** : protéines (4 kcal/g), glucides (4 kcal/g), lipides (9 kcal/g) en part de leur total, face aux repères de l'Anses pour un adulte : protéines 10 à 20 %, glucides 40 à 55 %, lipides 35 à 40 %. Le repère vaut pour la journée entière, pas pour un plat : il donne une idée, et le dit.

Code : `core/kitchen/daily-needs.ts` (formules, profil gardé), `pages/recipe/nutrition/` (bloc, et calculateur chargé à part quand le visiteur arrive jusqu'à lui).

## API

| Route | Rôle |
| --- | --- |
| `GET /api/recipes/{slug}` | `showNutrition`, et `nutrition` quand la recette les affiche |
| `POST /api/admin/recipes/nutrition` | Estimation de la recette en cours d'écriture (lignes, recettes liées, portions) |
| `PUT /api/admin/ingredients/{id}/nutrition` | `{ ciqualCode }`, ou `{ label, labelSource }`, ou `{}` pour retirer |
| `PUT /api/admin/ingredients/ciqual` | `{ links: [{ ingredientId, ciqualCode }] }`, tout ou rien |
| `GET /api/admin/ingredients/nutrition-suggestions` | Les ingrédients sans valeurs et leurs aliments probables (`name=` pour ceux-là seulement) |
| `GET /api/admin/nutrition/ciqual` | Version de la table, nombre d'aliments, date d'import |
| `POST /api/admin/nutrition/ciqual` | Import d'une nouvelle version (multipart, `file`) |
| `GET /api/admin/nutrition/ciqual/foods?q=` | Recherche dans la table, 20 aliments au plus |
| `GET /api/admin/nutrition/open-food-facts?q=` | Produits d'Open Food Facts, par nom ou code-barres ; 502 s'il ne répond pas |

Données structurées : `NutritionInformation` (calories, matières grasses, sucres, protéines, sodium… par portion) dans le JSON-LD `Recipe` ; section « Valeurs nutritionnelles » de la version Markdown de la recette.
