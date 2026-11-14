import { describe, expect, it } from 'vitest';
import { RecipeNutrition } from '../../core/api/generated/models/recipe-nutrition';
import {
  NUTRIENT_ROWS,
  NUTRI_SCORE_KINDS,
  estimateNote,
  formatGrams,
  formatKcal,
  missingNames,
  missingReason,
  nutriScoreAs,
  nutritionMarkdown,
  nutritionSource,
  proteinClaimLabel,
  shownNutrition,
} from './nutrition';

const facts = { kcal: 1318.7, proteins: 16.94, carbohydrates: 45, sugars: 12.25, fat: 16, saturatedFat: 9.5, fibre: 2, salt: 0.123 };

const nutrition: RecipeNutrition = {
  servings: 4,
  grams: 460,
  perServing: facts,
  total: facts,
  per100g: facts,
  countedLines: 4,
  missing: [
    { name: 'Sel', reason: 'NO_QUANTITY' },
    { name: 'Vanille', reason: 'NO_WEIGHT' },
    { name: 'Vanille', reason: 'NO_VALUES' },
  ],
  ciqualVersion: 'Ciqual 2025',
  fromLabels: false,
  complete: true,
  nutriScoreKind: 'GENERAL',
  proteinEnergyPercent: 5,
  contributors: [],
};

describe('nutrition format', () => {
  it('writes energy and grams the French way', () => {
    // A narrow no-break space between thousands, as Intl writes French
    expect(formatKcal(1318.7)).toBe('1 319 kcal');
    expect(formatGrams(16.94)).toBe('16,9 g');
    expect(formatGrams(0.123, true)).toBe('0,12 g');
  });

  it('lists the rows of a label in order', () => {
    expect(NUTRIENT_ROWS.map((row) => row.label)).toEqual([
      'Énergie',
      'Matières grasses',
      'dont acides gras saturés',
      'Glucides',
      'dont sucres',
      'Fibres',
      'Protéines',
      'Sel',
    ]);
    expect(NUTRIENT_ROWS[4]!.value(facts)).toBe('12,3 g');
  });

  it('names what is left out', () => {
    expect(missingNames(nutrition)).toBe('Sel, vanille');
    expect(missingReason({ name: 'Sel', reason: 'NO_QUANTITY' })).toBe('sans quantité');
    expect(missingReason({ name: 'Ail', reason: 'NO_WEIGHT' })).toBe("poids d'une pièce inconnu");
    expect(missingReason({ name: 'Whey', reason: 'NO_VALUES' })).toBe('sans valeurs nutritionnelles');
  });

  it('cites its sources', () => {
    expect(nutritionSource(nutrition)).toBe("D'après la table Ciqual 2025 de l'Anses");
    expect(nutritionSource({ ...nutrition, fromLabels: true })).toBe(
      "D'après la table Ciqual 2025 de l'Anses et les étiquettes des produits",
    );
  });
  it('shows the facts only when ticked and complete', () => {
    expect(shownNutrition({ showNutrition: true, nutrition })).toBe(nutrition);
    expect(shownNutrition({ showNutrition: false, nutrition })).toBeNull();
    // An ingredient without values: hidden until completed
    expect(shownNutrition({ showNutrition: true, nutrition: { ...nutrition, complete: false } })).toBeNull();
    expect(shownNutrition({ showNutrition: true })).toBeNull();
  });

  it('says how the facts are estimated: raw, or per 100 g of the dish once cooked', () => {
    expect(estimateNote(nutrition)).toBe(
      "Estimation à partir des ingrédients crus, sans os ni épluchures : la perte d'eau à la cuisson n'est pas comptée",
    );
    expect(estimateNote({ ...nutrition, cookedGrams: 1250 })).toBe(
      'Estimation à partir des ingrédients, sans os ni épluchures, pour 100 g du plat cuit (1 250 g en tout)',
    );
  });

  it('names the grid of the Nutri-Score and the claim of the proteins', () => {
    expect(NUTRI_SCORE_KINDS.map((kind) => kind.value)).toEqual(['GENERAL', 'BEVERAGE', 'FATS', 'RED_MEAT', 'CHEESE']);
    expect(nutriScoreAs('BEVERAGE')).toBe('une boisson');
    // A copy kept before 2.17: the general grid
    expect(nutriScoreAs(undefined)).toBe('un aliment');
    expect(proteinClaimLabel('RICH')).toBe('Riche en protéines');
    expect(proteinClaimLabel('SOURCE')).toBe('Source de protéines');
    expect(proteinClaimLabel(undefined)).toBeNull();
  });

  it('writes them in the Markdown page with their grid and claim', () => {
    const markdown = nutritionMarkdown({
      ...nutrition,
      nutriScore: { grade: 'B', score: 1 },
      nutriScoreKind: 'BEVERAGE',
      proteinClaim: 'SOURCE',
      proteinEnergyPercent: 14,
    });
    expect(markdown[2]).toContain('Nutri-Score estimé par le site comme pour une boisson : B.');
    expect(markdown[2]).toContain("Source de protéines (14 % de l'énergie).");
  });
});
