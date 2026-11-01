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
});
