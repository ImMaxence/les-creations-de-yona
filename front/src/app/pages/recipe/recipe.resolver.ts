import { HttpErrorResponse } from '@angular/common/http';
import { RESPONSE_INIT, inject } from '@angular/core';
import { ActivatedRouteSnapshot, RedirectCommand, ResolveFn, Router } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { getPublishedRecipe } from '../../core/api/generated/fn/recipes/get-published-recipe';
import { RecipeDetail } from '../../core/api/generated/models/recipe-detail';
import { Step } from '../../core/api/generated/models/step';
import { PageSeo, SITE_URL, absoluteUrl, excerpt } from '../../core/seo/page-seo';
import { isoDuration } from '../../shared/format/units';
import { mainCategory, recipeLink } from '../../shared/routing/links';
import { hasParts, totalIngredients } from './recipe-parts';

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

export function recipeSeo(route: ActivatedRouteSnapshot): PageSeo {
  const recipe = route.data['recipe'] as RecipeDetail;
  const path = recipeLink(recipe).join('/');
  const image = recipe.imageId ? `/api/images/${recipe.imageId}/1600.webp` : undefined;
  const description = excerpt(
    recipe.intro || `Recette ${recipe.title}, dans la catégorie ${mainCategory(recipe).name}.`,
  );
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return {
    title: recipe.title,
    description,
    canonicalPath: path,
    image,
    type: 'article',
    // https://developers.google.com/search/docs/appearance/structured-data/recipe
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.title,
      description,
      image: image ? [absoluteUrl(image)] : undefined,
      url: absoluteUrl(path),
      author: { '@type': 'Person', name: 'Yona', url: SITE_URL },
      datePublished: recipe.createdAt,
      dateModified: recipe.updatedAt,
      recipeCategory: recipe.categories.map((category) => category.name).join(', '),
      keywords: recipe.tags.length ? recipe.tags.map((tag) => tag.name).join(', ') : undefined,
      recipeYield: recipe.servings ? `${recipe.servings} portions` : undefined,
      prepTime: recipe.prepMinutes ? isoDuration(recipe.prepMinutes) : undefined,
      cookTime: recipe.cookMinutes ? isoDuration(recipe.cookMinutes) : undefined,
      totalTime: totalMinutes ? isoDuration(totalMinutes) : undefined,
      // The whole recipe: quantities of an ingredient used in several parts are added up
      recipeIngredient: totalIngredients(recipe.parts, 1).map((ingredient) =>
        [ingredient.amount, ingredient.name, ingredient.note && `(${ingredient.note})`].filter(Boolean).join(' '),
      ),
      recipeInstructions: hasParts(recipe.parts)
        ? recipe.parts.map((part) => ({
            '@type': 'HowToSection',
            name: part.title,
            itemListElement: howToSteps(part.steps),
          }))
        : howToSteps(recipe.parts.flatMap((part) => part.steps)),
    },
  };
}

function howToSteps(steps: Step[]): object[] {
  return steps.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, text: step.description }));
}
