package fr.lescreationsdeyona.security;

import org.jspecify.annotations.Nullable;

/** The logged-in admin; {@code picture} is the photo of the Google account, when it has one. */
public record AdminResponse(String email, String name, @Nullable String picture) {
}
