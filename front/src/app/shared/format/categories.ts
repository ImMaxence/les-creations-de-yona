/** "Desserts · Goûter" : every category of a recipe, the main one first. */
export function categoryNames(categories: { name: string }[]): string {
  return categories.map((category) => category.name).join(' · ');
}
