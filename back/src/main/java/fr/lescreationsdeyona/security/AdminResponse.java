package fr.lescreationsdeyona.security;

import org.jspecify.annotations.Nullable;

/** The signed-in admin; {@code picture}: their own photo, or the one of their Google account, when they have one. */
public record AdminResponse(long id, String email, String name, @Nullable String picture) {
}
