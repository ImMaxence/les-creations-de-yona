package fr.lescreationsdeyona.ingredient;

/**
 * Shop aisle of an ingredient, set once in the back-office: the shopping list is sorted by aisle,
 * in this order (the usual walk through a French supermarket). No aisle: listed last, as "Autres".
 */
public enum Aisle {
	/** Fruits et légumes. */
	FRUITS_VEGETABLES,
	/** Boucherie, poissonnerie. */
	MEAT_FISH,
	/** Crèmerie, œufs. */
	DAIRY_EGGS,
	/** Boulangerie. */
	BAKERY,
	/** Épicerie salée (pâtes, conserves, épices…). */
	SAVORY_GROCERY,
	/** Épicerie sucrée (farine, sucre, chocolat…). */
	SWEET_GROCERY,
	/** Surgelés. */
	FROZEN,
	/** Boissons. */
	DRINKS
}
