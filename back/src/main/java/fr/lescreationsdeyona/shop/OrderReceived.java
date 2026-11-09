package fr.lescreationsdeyona.shop;

import java.math.BigDecimal;

/**
 * An order committed: the admins' devices are told. Nothing about the customer in it, the
 * notification goes through the push services of the browsers.
 */
public record OrderReceived(long number, int items, BigDecimal amount) {
}
