/**
 * Query parameters of the back-office recipe list, in French as the other URLs. The categories,
 * tags and ingredients pages link to the list filtered with them.
 */
export const ADMIN_RECIPES_QUERY = {
  search: 'q',
  status: 'statut',
  category: 'categorie',
  tag: 'tag',
  ingredientId: 'idIngredient',
  image: 'photo',
  page: 'page',
} as const;
