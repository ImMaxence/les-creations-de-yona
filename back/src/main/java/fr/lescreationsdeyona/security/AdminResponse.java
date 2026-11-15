package fr.lescreationsdeyona.security;

import org.jspecify.annotations.Nullable;

/**
 * The signed-in admin; {@code picture}: their own photo, or the one of their Google account, when they have one;
 * {@code passkeys}: how many they have (none: the back-office reminds them to add one, in "Mon compte").
 */
public record AdminResponse(long id, String email, String name, @Nullable String picture, int passkeys) {
}
