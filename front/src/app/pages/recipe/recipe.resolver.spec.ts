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
    questions: [],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z',
    parts,
    ...change,
  } as unknown as RecipeDetail;
}

/** The node of that type in the page's JSON-LD. */
function node(nodes: object[] | undefined, type: string): Record<string, unknown> {
  return (nodes as Record<string, unknown>[]).find((candidate) => candidate['@type'] === type)!;
}

/** The JSON-LD given to Google for this recipe. */
function jsonLd(detail: RecipeDetail): Record<string, unknown> {
  return node(recipeSeo({ data: { recipe: detail } } as unknown as ActivatedRouteSnapshot).jsonLd, 'Recipe');
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

  it('links the recipe to the site and to its author, and gives its video', () => {
    const steps: Part[] = [{ ingredients: [], steps: [step('Mélangez')] }];

    expect(jsonLd(recipe(steps, { youtubeVideoId: 'dQw4w9WgXcQ', publishedAt: '2026-10-03T10:00:00Z' }))).toMatchObject({
      '@id': `${URL}#recette`,
      isPartOf: { '@id': 'https://les-creations-de-yona.fr/#site' },
      author: { '@id': 'https://les-creations-de-yona.fr/a-propos#yona', name: 'Yona' },
      video: {
        '@type': 'VideoObject',
        thumbnailUrl: ['https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'],
        uploadDate: '2026-10-03T10:00:00Z',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      },
    });
  });

  it('gives the path to the recipe, its questions, and its Markdown version', () => {
    const seo = recipeSeo({
      data: {
        recipe: recipe([{ ingredients: [], steps: [step('Mélangez')] }], {
          questions: [{ question: 'Peut-on la congeler ?', answer: 'Oui, 2 mois' }],
        }),
      },
    } as unknown as ActivatedRouteSnapshot);

    expect(seo.markdownPath).toBe('/recettes/desserts/tarte.md');
    expect(node(seo.jsonLd, 'BreadcrumbList')['itemListElement']).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://les-creations-de-yona.fr/' },
      { '@type': 'ListItem', position: 2, name: 'Recettes', item: 'https://les-creations-de-yona.fr/recettes' },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Desserts',
        item: 'https://les-creations-de-yona.fr/recettes?categorie=desserts',
      },
      { '@type': 'ListItem', position: 4, name: 'Tarte', item: URL },
    ]);
    expect(node(seo.jsonLd, 'FAQPage')['mainEntity']).toEqual([
      {
        '@type': 'Question',
        name: 'Peut-on la congeler ?',
        acceptedAnswer: { '@type': 'Answer', text: 'Oui, 2 mois' },
      },
    ]);
  });

  it('gives Google the nutrition facts per serving, when the page shows them', () => {
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
      complete: true,
    };
    const steps: Part[] = [{ ingredients: [], steps: [step('Mélangez')] }];

    expect(jsonLd(recipe(steps, { nutrition } as unknown as Partial<RecipeDetail>))['nutrition']).toBeUndefined();
    expect(jsonLd(recipe(steps, { showNutrition: true, nutrition } as unknown as Partial<RecipeDetail>))['nutrition']).toEqual({
      '@type': 'NutritionInformation',
      servingSize: '1 portion',
      calories: '312 calories',
      fatContent: '12 g',
      saturatedFatContent: '7.5 g',
      carbohydrateContent: '45 g',
      sugarContent: '22.5 g',
      fiberContent: '2.1 g',
      proteinContent: '4.2 g',
      sodiumContent: '100 mg',
    });
  });
});
