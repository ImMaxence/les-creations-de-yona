package fr.lescreationsdeyona.nutrition;

import org.jspecify.annotations.Nullable;

/**
 * What the proteins of a recipe allow it to claim, by the European rules of nutrition claims (regulation
 * 1924/2006): a share of its energy brought by proteins, at 4 kcal a gram.
 */
public enum ProteinClaim {

	/** "Source de protéines": 12 % of its energy at least. */
	SOURCE,

	/** "Riche en protéines": 20 % at least. */
	RICH;

	static final double SOURCE_PERCENT = 12;

	static final double RICH_PERCENT = 20;

	/** 4 kcal a gram of proteins (17 kJ), as on the labels. */
	static final double KCAL_PER_GRAM = 4;

	/** Of facts whose proteins bring {@code percent} of the energy; null below 12 %. */
	static @Nullable ProteinClaim of(double percent) {
		if (percent >= RICH_PERCENT) {
			return RICH;
		}
		return percent >= SOURCE_PERCENT ? SOURCE : null;
	}

	/** The share of the energy of {@code facts} its proteins bring, in percent; 0 without energy. */
	static double energyPercent(NutritionFacts facts) {
		return facts.kcal() > 0 ? facts.proteins() * KCAL_PER_GRAM * 100 / facts.kcal() : 0;
	}

}
