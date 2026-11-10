import { HttpErrorResponse } from '@angular/common/http';
import { RESPONSE_INIT, inject } from '@angular/core';
import { ActivatedRouteSnapshot, RedirectCommand, ResolveFn, Router } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { listGlossary } from '../../core/api/generated/fn/glossary/list-glossary';
import { getPublishedRecipe } from '../../core/api/generated/fn/recipes/get-published-recipe';
import { listRelatedRecipes } from '../../core/api/generated/fn/recipes/list-related-recipes';
import { GlossaryTermResponse } from '../../core/api/generated/models/glossary-term-response';
import { RecipeCard } from '../../core/api/generated/models/recipe-card';
import { RecipeDetail } from '../../core/api/generated/models/recipe-detail';
import { Step } from '../../core/api/generated/models/step';
import { AUTHOR_REF, WEBSITE_ID, breadcrumb } from '../../core/seo/json-ld';
import { PageSeo, absoluteUrl, excerpt, markdownPathOf } from '../../core/seo/page-seo';
import { isoDuration } from '../../shared/format/units';
import { RECIPES_PATH, categoryQueryParams, mainCategory, recipeLink } from '../../shared/routing/links';
import { QUESTIONS_ANCHOR, hasParts, stepAnchor, totalIngredients } from './recipe-parts';

/** Not matched by any route: rendered by the catch-all 404 page, with the visitor's URL kept. */
export const NOT_FOUND_PATH = '/page-introuvable';

/**
 * The recipe is found by its slug alone. A draft or unknown recipe shows the 404 page; another
 * category than its main one in the URL redirects for good (301) to the canonical URL.
 */
export const recipeResolver: ResolveFn<RecipeDetail> = async (route) => {
  const api = inject(Api);
  const router = inject(Router);
  const response = inject(RESPONSE_INIT, { optional: true });

  let recipe: RecipeDetail;
  try {
    recipe = await api.invoke(getPublishedRecipe, { slug: route.paramMap.get('recipeSlug')! });
  } catch (error) {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return new RedirectCommand(router.parseUrl(NOT_FOUND_PATH), { skipLocationChange: true });
    }
    throw error;
  }

  if (mainCategory(recipe).slug !== route.paramMap.get('categorySlug')) {
    if (response) {
      response.status = 301;
    }
    return new RedirectCommand(router.createUrlTree(recipeLink(recipe)), { replaceUrl: true });
  }
  return recipe;
};

/** "Vous aimerez aussi": an extra, so the recipe still shows if it cannot be loaded. */
export const relatedRecipesResolver: ResolveFn<RecipeCard[]> = (route) =>
  inject(Api)
    .invoke(listRelatedRecipes, { slug: route.paramMap.get('recipeSlug')! })
    .catch(() => []);

/** The words explained in the steps; the steps show as plain text without them. */
export const glossaryResolver: ResolveFn<GlossaryTermResponse[]> = () =>
  inject(Api)
    .invoke(listGlossary)
    .catch(() => []);

export function recipeSeo(route: ActivatedRouteSnapshot): PageSeo {
  const recipe = route.data['recipe'] as RecipeDetail;
  const path = recipeLink(recipe).join('/');
  const image = recipe.imageId ? `/api/images/${recipe.imageId}/1600.webp` : undefined;
  const description = excerpt(
    recipe.intro || `Recette ${recipe.title}, dans la catégorie ${mainCategory(recipe).name}`,
  );
  // Resting and rising count: Google's totalTime is the whole time until ready
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.restMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  const url = absoluteUrl(path);
  const category = mainCategory(recipe);
  // A copy kept for offline reading before 1.16 has none
  const questions = recipe.questions ?? [];

  return {
    title: recipe.title,
    description,
    canonicalPath: path,
    image,
    type: 'article',
    markdownPath: markdownPathOf(path),
    jsonLd: [
      recipeNode(recipe, path, description, image, totalMinutes),
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'Recettes', path: RECIPES_PATH },
        { name: category.name, path: `${RECIPES_PATH}?${new URLSearchParams(categoryQueryParams(category))}` },
        { name: recipe.title, path },
      ]),
      ...(questions.length
        ? [
            {
              '@type': 'FAQPage',
              '@id': `${url}#${QUESTIONS_ANCHOR}`,
              url: `${url}#${QUESTIONS_ANCHOR}`,
              inLanguage: 'fr-FR',
              mainEntity: questions.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer },
              })),
            },
          ]
        : []),
    ],
  };
}

/** https://developers.google.com/search/docs/appearance/structured-data/recipe */
function recipeNode(
  recipe: RecipeDetail,
  path: string,
  description: string,
  image: string | undefined,
  totalMinutes: number,
): object {
  const url = absoluteUrl(path);
  const videoId = recipe.youtubeVideoId;
  return {
    '@type': 'Recipe',
    '@id': `${url}#recette`,
    name: recipe.title,
    description,
    image: image ? [absoluteUrl(image)] : undefined,
    url,
    mainEntityOfPage: url,
    isPartOf: { '@id': WEBSITE_ID },
    inLanguage: 'fr-FR',
    author: AUTHOR_REF,
    datePublished: recipe.publishedAt ?? recipe.createdAt,
    dateModified: recipe.updatedAt,
    recipeCategory: recipe.categories.map((category) => category.name).join(', '),
    keywords: recipe.tags.length ? recipe.tags.map((tag) => tag.name).join(', ') : undefined,
    recipeYield: recipe.servings ? `${recipe.servings} portions` : undefined,
    // Once one time is given, an empty one means none: a cake without baking, a sauce without preparation
    prepTime: totalMinutes ? isoDuration(recipe.prepMinutes ?? 0) : undefined,
    cookTime: totalMinutes ? isoDuration(recipe.cookMinutes ?? 0) : undefined,
    totalTime: totalMinutes ? isoDuration(totalMinutes) : undefined,
    // The whole recipe: quantities of an ingredient used in several parts are added up
    recipeIngredient: totalIngredients(recipe.parts, 1).map((ingredient) =>
      [ingredient.amount, ingredient.name, ingredient.note && `(${ingredient.note})`].filter(Boolean).join(' '),
    ),
    tool: recipe.equipment.length ? recipe.equipment.map((item) => ({ '@type': 'HowToTool', name: item })) : undefined,
    recipeInstructions: hasParts(recipe.parts)
      ? recipe.parts.map((part, index) => ({
          '@type': 'HowToSection',
          name: part.title,
          itemListElement: howToSteps(part.steps, index + 1, path, image),
        }))
      : howToSteps(recipe.parts.flatMap((part) => part.steps), null, path, image),
    video: videoId
      ? {
          '@type': 'VideoObject',
          name: recipe.title,
          description,
          thumbnailUrl: [`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`],
          // YouTube's own date is unknown to the site: the day the recipe first showed it
          uploadDate: recipe.publishedAt ?? recipe.createdAt,
          contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        }
      : undefined,
  };
}

/**
 * Each step with what Google asks for: a short name (its first sentence), its address on the page
 * (#etape-2) and an image, the photo of the recipe, steps having none of their own.
 */
function howToSteps(steps: Step[], part: number | null, path: string, image: string | undefined): object[] {
  return steps.map((step, index) => {
    const text = plainText(step.description);
    return {
      '@type': 'HowToStep',
      position: index + 1,
      name: excerpt(text.split(/(?<=[.!?…])\s/)[0].replace(/\.$/, ''), 80),
      text,
      url: `${absoluteUrl(path)}#${stepAnchor(index + 1, part)}`,
      image: image ? absoluteUrl(image) : undefined,
    };
  });
}

/** Steps are written in Markdown, Google reads plain text: "**Fouettez** les [blancs](…)" → "Fouettez les blancs". */
function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.|#{1,6}|>)\s+/gm, '')
    .replace(/\*\*|__|[*`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
