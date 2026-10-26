package fr.lescreationsdeyona.recipe;

import java.math.BigDecimal;

/** Difficulty filter of the recipes page, over the 1 to 5 scale by half points. */
public enum DifficultyLevel {

	/** 1 to 2 stars. */
	EASY("1", "2"),
	/** 2.5 to 3.5 stars. */
	MEDIUM("2.5", "3.5"),
	/** 4 to 5 stars. */
	HARD("4", "5");

	private final BigDecimal min;

	private final BigDecimal max;

	DifficultyLevel(String min, String max) {
		this.min = new BigDecimal(min);
		this.max = new BigDecimal(max);
	}

	BigDecimal min() {
		return min;
	}

	BigDecimal max() {
		return max;
	}

}
