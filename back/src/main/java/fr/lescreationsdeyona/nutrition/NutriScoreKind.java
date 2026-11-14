package fr.lescreationsdeyona.nutrition;

/**
 * The grid of the 2023 Nutri-Score a recipe is graded with, chosen by the admin: most dishes are foods in general,
 * but a drink, a sauce made of oil or a dish of red meat or of cheese has rules of its own.
 */
public enum NutriScoreKind {

	/** Dishes, desserts, cakes: the general grid. */
	GENERAL,

	/** Mostly beef, veal, pork, lamb or game: their proteins count 2 points at most. */
	RED_MEAT,

	/** Mostly cheese: its proteins always count, however many the other points. */
	CHEESE,

	/** Fats, oils, nuts and seeds (vinaigrette, pesto, almond butter): saturated fat weighed against all fat. */
	FATS,

	/** Drinks (smoothie, lemonade, hot chocolate): thresholds of their own, the best grade A kept for water. */
	BEVERAGE

}
