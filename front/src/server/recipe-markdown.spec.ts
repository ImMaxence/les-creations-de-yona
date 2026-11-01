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
});
