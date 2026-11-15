package fr.lescreationsdeyona.security;

/** An admin disabled or deleted: their pages still open lose the live news at once. Published inside the transaction. */
public record AccountClosed(String email) {
}
