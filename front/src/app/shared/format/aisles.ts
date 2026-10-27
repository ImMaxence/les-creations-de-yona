import { IngredientAisle } from '../../core/api/generated/models/ingredient-aisle';

/** Shop aisle of an ingredient, set in the back-office. */
export type Aisle = IngredientAisle['aisle'];

/** In the order of the shopping list: the usual walk through a French supermarket. */
export const AISLES: readonly { value: Aisle; label: string }[] = [
  { value: 'FRUITS_VEGETABLES', label: 'Fruits et légumes' },
  { value: 'MEAT_FISH', label: 'Boucherie, poissonnerie' },
  { value: 'DAIRY_EGGS', label: 'Crèmerie, œufs' },
  { value: 'BAKERY', label: 'Boulangerie' },
  { value: 'SAVORY_GROCERY', label: 'Épicerie salée' },
  { value: 'SWEET_GROCERY', label: 'Épicerie sucrée' },
  { value: 'FROZEN', label: 'Surgelés' },
  { value: 'DRINKS', label: 'Boissons' },
];

/** The ingredients without aisle, and what the visitor typed: last. */
export const OTHER_AISLE_LABEL = 'Autres';

export function aisleLabel(aisle: Aisle | null | undefined): string {
  return AISLES.find((known) => known.value === aisle)?.label ?? OTHER_AISLE_LABEL;
}

export interface AisleGroup<T> {
  /** null: "Autres". */
  aisle: Aisle | null;
  label: string;
  items: T[];
}

/** The items by aisle, in the order of AISLES, "Autres" last; empty aisles left out. */
export function groupByAisle<T>(items: T[], aisleOf: (item: T) => Aisle | null | undefined): AisleGroup<T>[] {
  const groups = [...AISLES.map(({ value }) => value), null].map((aisle) => ({
    aisle,
    label: aisleLabel(aisle),
    items: items.filter((item) => (aisleOf(item) ?? null) === aisle),
  }));
  return groups.filter((group) => group.items.length > 0);
}
