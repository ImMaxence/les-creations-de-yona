import { ActivatedRouteSnapshot } from '@angular/router';
import { Part } from '../../core/api/generated/models/part';
import { RecipeDetail } from '../../core/api/generated/models/recipe-detail';
import { Step } from '../../core/api/generated/models/step';
import { recipeSeo } from './recipe.resolver';

const URL = 'https://les-creations-de-yona.fr/recettes/desserts/tarte';

function step(description: string): Step {
  return { description, ingredientPositions: [] };
}

function recipe(parts: Part[], change: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    title: 'Tarte',
    slug: 'tarte',
    imageId: 'photo',
    categories: [{ id: 1, name: 'Desserts', slug: 'desserts' }],
    tags: [],
    equipment: [],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z',
    parts,
    ...change,
  } as unknown as RecipeDetail;
}

/** The JSON-LD given to Google for this recipe. */
function jsonLd(detail: RecipeDetail): Record<string, unknown> {
  return recipeSeo({ data: { recipe: detail } } as unknown as ActivatedRouteSnapshot).jsonLd as Record<string, unknown>;
}

describe('recipeSeo', () => {
  it('gives each step a name, its address on the page and an image, as Google asks', () => {
    const steps = jsonLd(
      recipe([
        {
          ingredients: [],
          steps: [
            step('**Fouettez** les [blancs](https://example.com) en neige. Ajoutez le sucre.'),
            step('Enfournez'),
          ],
        },
      ]),
    )['recipeInstructions'];

    expect(steps).toEqual([
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Fouettez les blancs en neige',
        text: 'Fouettez les blancs en neige. Ajoutez le sucre.',
        url: `${URL}#etape-1`,
        image: 'https://les-creations-de-yona.fr/api/images/photo/1600.webp',
      },
      expect.objectContaining({ name: 'Enfournez', url: `${URL}#etape-2` }),
    ]);
  });

  it('numbers the steps within their part, as their anchors on the page', () => {
    const sections = jsonLd(
      recipe([
        { title: 'La pâte', ingredients: [], steps: [step('Sablez')] },
        { title: 'La crème', ingredients: [], steps: [step('Chauffez le lait')] },
      ]),
    )['recipeInstructions'] as { itemListElement: { url: string }[] }[];

    expect(sections.map((section) => section.itemListElement[0]!.url)).toEqual([
      `${URL}#partie-1-etape-1`,
      `${URL}#partie-2-etape-1`,
    ]);
  });

  it('counts an empty time as none once another is given, and gives none without any time', () => {
    const steps: Part[] = [{ ingredients: [], steps: [step('Mélangez')] }];

    expect(jsonLd(recipe(steps, { prepMinutes: 20, restMinutes: 60 }))).toMatchObject({
      prepTime: 'PT20M',
      cookTime: 'PT0M',
      totalTime: 'PT1H20M',
    });
    expect(jsonLd(recipe(steps))['cookTime']).toBeUndefined();
  });
});
