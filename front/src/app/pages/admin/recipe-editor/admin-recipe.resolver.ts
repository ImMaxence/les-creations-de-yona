import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { getRecipe } from '../../../core/api/generated/fn/admin-recipes/get-recipe';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';

/** Recipe to edit, drafts included. Unknown id: back to the list (the API error shows as a toast). */
export const adminRecipeResolver: ResolveFn<RecipeDetail> = async (route) => {
  const api = inject(Api);
  const router = inject(Router);
  try {
    return await api.invoke(getRecipe, { id: Number(route.paramMap.get('id')) });
  } catch {
    return new RedirectCommand(router.parseUrl('/admin/recettes'));
  }
};
