import type { RecipeDetail } from '../app/core/api/generated/models/recipe-detail';
import { recipeToMarkdown } from './recipe-markdown';

function recipe(change: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    title: 'Tarte aux pommes',
    slug: 'tarte-aux-pommes',
    intro: 'Une tarte de grand-mère',
    categories: [{ id: 1, name: 'Tartes', slug: 'tartes' }],
    tags: [{ id: 1, name: 'Végétarien', slug: 'vegetarien' }],
    servings: 6,
    prepMinutes: 20,
    cookMinutes: 35,
    difficulty: 2.5,
    equipment: ['Moule à tarte'],
    questions: [{ question: 'Peut-on la congeler ?', answer: 'Oui, 2 mois' }],
    tip: 'Servez-la **tiède**',
    createdAt: '2026-10-01T10:00:00Z',
    publishedAt: '2026-10-02T10:00:00Z',
    updatedAt: '2026-10-30T10:00:00Z',
    parts: [
      {
        ingredients: [{ name: 'Pommes', quantity: 4 }, { name: 'Sucre', quantity: 50, unit: 'g', note: 'roux' }],
        steps: [
          { description: 'Épluchez les pommes', ingredientPositions: [] },
          { description: 'Enfournez :\n- 35 min\n- à 180 °C', durationMinutes: 35, ingredientPositions: [] },
        ],
      },
    ],
    ...change,
  } as unknown as RecipeDetail;
}

describe('recipeToMarkdown', () => {
  it('gives the whole recipe: facts, ingredients, equipment, steps, tip and questions', () => {
    expect(recipeToMarkdown(recipe())).toBe(
      [
        '# Tarte aux pommes',
        '',
        '> Une tarte de grand-mère',
        '',
        'Une recette de Yona, publiée le 2 octobre 2026 et mise à jour le 30 octobre 2026 sur Les créations de Yona : ' +
          'https://les-creations-de-yona.fr/recettes/tartes/tarte-aux-pommes',
        '',
        '- Catégories : Tartes',
        '- Tags : Végétarien',
        '- Pour 6 personnes',
        '- Préparation : 20 min',
        '- Cuisson : 35 min',
        '- Temps total : 55 min',
        '- Difficulté : 2,5 / 5',
        '',
        '## Ingrédients',
        '',
        '- 4 Pommes',
        '- 50 g Sucre (roux)',
        '',
        '## Matériel',
        '',
        '- Moule à tarte',
        '',
        '## Préparation',
        '',
        '1. Épluchez les pommes',
        '2. Enfournez :',
        '   - 35 min',
        '   - à 180 °C (35 min)',
        '',
        '## Le conseil de Yona',
        '',
        'Servez-la **tiède**',
        '',
        '## Questions fréquentes',
        '',
        '### Peut-on la congeler ?',
        '',
        'Oui, 2 mois',
        '',
      ].join('\n'),
    );
  });

  it('titles the ingredients and steps of each part', () => {
    const markdown = recipeToMarkdown(
      recipe({
        parts: [
          { title: 'La pâte', ingredients: [{ name: 'Farine', quantity: 200, unit: 'g' }], steps: [] },
          { title: 'La garniture', ingredients: [], steps: [{ description: 'Garnissez', ingredientPositions: [] }] },
        ],
      } as Partial<RecipeDetail>),
    );

    expect(markdown).toContain('## Ingrédients\n\n### La pâte\n\n- 200 g Farine\n\n### La garniture\n');
    expect(markdown).toContain('## Préparation\n\n### La pâte\n\n\n### La garniture\n\n1. Garnissez\n');
  });

  it('gives the nutrition facts only when the page shows them', () => {
    const nutrition = {
      servings: 6,
      grams: 900,
      perServing: { kcal: 312.4, proteins: 4.2, carbohydrates: 45, sugars: 22.5, fat: 12, saturatedFat: 7.5, fibre: 2.1, salt: 0.25 },
      total: { kcal: 1874, proteins: 25, carbohydrates: 270, sugars: 135, fat: 72, saturatedFat: 45, fibre: 12.6, salt: 1.5 },
      per100g: { kcal: 208, proteins: 2.8, carbohydrates: 30, sugars: 15, fat: 8, saturatedFat: 5, fibre: 1.4, salt: 0.17 },
      nutriScore: { grade: 'C', score: 9 },
      countedLines: 2,
      missing: [{ name: 'Cannelle', reason: 'NO_VALUES' }],
      ciqualVersion: 'Ciqual 2025',
      fromLabels: false,
    };

    expect(recipeToMarkdown(recipe({ nutrition } as unknown as Partial<RecipeDetail>))).not.toContain('Valeurs nutritionnelles');
    const markdown = recipeToMarkdown(recipe({ showNutrition: true, nutrition } as unknown as Partial<RecipeDetail>));

    expect(markdown).toContain(
      '## Valeurs nutritionnelles\n\nEstimées à partir des ingrédients crus. D\'après la table Ciqual 2025 de l\'Anses. ' +
        'Nutri-Score estimé par le site : C.\n\n| Nutriment | Par portion | Pour 100 g |\n| --- | --- | --- |\n' +
        '| Énergie | 312 kcal | 208 kcal |\n',
    );
    expect(markdown).toContain('| dont sucres | 22,5 g | 15 g |\n| Fibres | 2,1 g | 1,4 g |');
    expect(markdown).toContain('Non comptés : Cannelle\n\n## Le conseil de Yona');
  });
});
