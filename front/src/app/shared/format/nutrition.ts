import { MissingIngredient } from '../../core/api/generated/models/missing-ingredient';
import { NutritionFacts } from '../../core/api/generated/models/nutrition-facts';
import { RecipeNutrition } from '../../core/api/generated/models/recipe-nutrition';

const KCAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const GRAMS = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const SALT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const NUTRI_SCORE_GRADES = ['A', 'B', 'C', 'D', 'E'] as const;

/** 1318.7 → "1 319 kcal". */
export function formatKcal(kcal: number): string {
  return `${KCAL.format(kcal)} kcal`;
}

/** 16.94 → "16,9 g"; salt to the hundredth: 0.12 → "0,12 g". */
export function formatGrams(grams: number, salt = false): string {
  return `${(salt ? SALT : GRAMS).format(grams)} g`;
}

/** The rows of a nutrition table, in the order of the labels (EU regulation 1169/2011). */
export interface NutrientRow {
  label: string;
  /** "dont sucres": a part of the row above. */
  part: boolean;
  value: (facts: NutritionFacts) => string;
}

export const NUTRIENT_ROWS: NutrientRow[] = [
  { label: 'Énergie', part: false, value: (facts) => formatKcal(facts.kcal) },
  { label: 'Matières grasses', part: false, value: (facts) => formatGrams(facts.fat) },
  { label: 'dont acides gras saturés', part: true, value: (facts) => formatGrams(facts.saturatedFat) },
  { label: 'Glucides', part: false, value: (facts) => formatGrams(facts.carbohydrates) },
  { label: 'dont sucres', part: true, value: (facts) => formatGrams(facts.sugars) },
  { label: 'Fibres', part: false, value: (facts) => formatGrams(facts.fibre) },
  { label: 'Protéines', part: false, value: (facts) => formatGrams(facts.proteins) },
  { label: 'Sel', part: false, value: (facts) => formatGrams(facts.salt, true) },
];

/** Why an ingredient is left out, as the back-office says it. */
export function missingReason(missing: MissingIngredient): string {
  switch (missing.reason) {
    case 'NO_QUANTITY':
      return 'sans quantité';
    case 'NO_WEIGHT':
      return "poids d'une pièce inconnu";
    default:
      return 'sans valeurs nutritionnelles';
  }
}

/** "Sel, vanille": the names left out, each once, for the visitors. */
export function missingNames(nutrition: RecipeNutrition): string {
  const names = [...new Set(nutrition.missing.map((item) => item.name))];
  return names.map((name, index) => (index === 0 ? name : name.toLocaleLowerCase('fr'))).join(', ');
}

/** "D'après la table Ciqual 2025 de l'Anses et les étiquettes des produits". */
export function nutritionSource(nutrition: RecipeNutrition): string {
  return `D'après la table ${nutrition.ciqualVersion} de l'Anses${nutrition.fromLabels ? ' et les étiquettes des produits' : ''}`;
}

const SCHEMA_NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, useGrouping: false });

/** schema.org NutritionInformation of a recipe, per serving (or for the whole recipe), as Google reads it. */
export function nutritionInformation(nutrition: RecipeNutrition): object {
  const facts = nutrition.perServing ?? nutrition.total;
  const grams = (value: number) => `${SCHEMA_NUMBER.format(value)} g`;
  return {
    '@type': 'NutritionInformation',
    servingSize: nutrition.perServing ? '1 portion' : 'la recette entière',
    calories: `${Math.round(facts.kcal)} calories`,
    fatContent: grams(facts.fat),
    saturatedFatContent: grams(facts.saturatedFat),
    carbohydrateContent: grams(facts.carbohydrates),
    sugarContent: grams(facts.sugars),
    fiberContent: grams(facts.fibre),
    proteinContent: grams(facts.proteins),
    // Salt is 2,5 times its sodium
    sodiumContent: `${Math.round((facts.salt / 2.5) * 1000)} mg`,
  };
}

/** The "Valeurs nutritionnelles" of the Markdown page of a recipe: a table, its Nutri-Score, what is left out. */
export function nutritionMarkdown(nutrition: RecipeNutrition): string[] {
  const portion = nutrition.perServing ?? nutrition.total;
  const lines = [
    '## Valeurs nutritionnelles',
    '',
    `Estimées à partir des ingrédients crus. ${nutritionSource(nutrition)}.` +
      (nutrition.nutriScore ? ` Nutri-Score estimé par le site : ${nutrition.nutriScore.grade}.` : ''),
    '',
    `| Nutriment | ${nutrition.perServing ? 'Par portion' : 'Recette entière'} | Pour 100 g |`,
    '| --- | --- | --- |',
    ...NUTRIENT_ROWS.map((row) => `| ${row.label} | ${row.value(portion)} | ${row.value(nutrition.per100g)} |`),
    '',
  ];
  const missing = missingNames(nutrition);
  if (missing) {
    lines.push(`Non comptés : ${missing}`, '');
  }
  return lines;
}
