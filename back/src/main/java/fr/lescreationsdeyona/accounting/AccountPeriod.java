package fr.lescreationsdeyona.accounting;

import java.time.LocalDate;
import java.time.YearMonth;

/** What the accounts show at once: a month, a quarter or a year. */
public enum AccountPeriod {

	MONTH, QUARTER, YEAR;

	/** The first day of {@code number} (month 1 to 12, quarter 1 to 4) of {@code year}. */
	LocalDate start(int year, int number) {
		return switch (this) {
			case MONTH -> LocalDate.of(year, clamp(number, 12), 1);
			case QUARTER -> LocalDate.of(year, (clamp(number, 4) - 1) * 3 + 1, 1);
			case YEAR -> LocalDate.of(year, 1, 1);
		};
	}

	/** Its last day. */
	LocalDate end(int year, int number) {
		return switch (this) {
			case MONTH -> YearMonth.of(year, clamp(number, 12)).atEndOfMonth();
			case QUARTER -> YearMonth.of(year, clamp(number, 4) * 3).atEndOfMonth();
			case YEAR -> LocalDate.of(year, 12, 31);
		};
	}

	private static int clamp(int number, int max) {
		return Math.max(1, Math.min(max, number));
	}

}
