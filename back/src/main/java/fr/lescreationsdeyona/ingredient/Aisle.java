package fr.lescreationsdeyona.ingredient;

/**
 * Shop aisle of an ingredient, set once in the back-office: the shopping list is sorted by aisle,
 * in this order (the usual walk through a French supermarket). No aisle: listed last, as "Autres".
 */
public enum Aisle {
	/** Fruits et légumes (herbes fraîches comprises). */
	FRUITS_VEGETABLES,
	/** Viandes et poissons. */
	MEAT_FISH,
	/** Rayon frais: charcuterie, lardons, pâtes à tarte toutes prêtes, traiteur. */
	FRESH,
	/** Crèmerie: lait, beurre, crème, yaourts, fromages, œufs. */
	DAIRY_EGGS,
	/** Épicerie salée: pâtes, riz, conserves, huile, vinaigre, épices. */
	SAVORY_GROCERY,
	/** Épicerie sucrée et pâtisserie: farine, sucre, levure, chocolat, confiture. */
	SWEET_GROCERY,
	/** Surgelés. */
	FROZEN,
	/** Boissons (vin et alcools de cuisine compris). */
	DRINKS
}
