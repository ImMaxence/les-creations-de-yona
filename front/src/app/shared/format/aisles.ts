import { IngredientAisle } from '../../core/api/generated/models/ingredient-aisle';

/** Shop aisle of an ingredient, set in the back-office. */
export type Aisle = IngredientAisle['aisle'];

/**
 * In the order of the shopping list: the usual walk through a French supermarket. Named as the
 * signs of the shop say; `hint`: what is found there, shown in the back-office to choose.
 */
export const AISLES: readonly { value: Aisle; label: string; hint: string }[] = [
  { value: 'FRUITS_VEGETABLES', label: 'Fruits et légumes', hint: 'fruits, légumes, herbes fraîches, citrons' },
  { value: 'MEAT_FISH', label: 'Viandes et poissons', hint: 'boucherie, volaille, poissonnerie' },
  { value: 'FRESH', label: 'Rayon frais', hint: 'jambon, lardons, pâte feuilletée ou brisée toute prête, traiteur' },
  { value: 'DAIRY_EGGS', label: 'Crèmerie et œufs', hint: 'lait, beurre, crème, yaourts, fromages, œufs' },
  { value: 'SAVORY_GROCERY', label: 'Épicerie salée', hint: 'pâtes, riz, conserves, huile, vinaigre, épices, sel' },
  { value: 'SWEET_GROCERY', label: 'Épicerie sucrée et pâtisserie', hint: 'farine, sucre, levure, chocolat, confiture' },
  { value: 'FROZEN', label: 'Surgelés', hint: 'légumes, fruits et pâtes surgelés, glaces' },
  { value: 'DRINKS', label: 'Boissons', hint: 'jus, lait végétal, vin et alcools pour cuisiner' },
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
