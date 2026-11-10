package fr.lescreationsdeyona.glossary;

import java.util.List;
import org.jspecify.annotations.Nullable;

/** A word of the glossary in the trash, as JSON; {@code definition}: absent for a word kept for later. */
record TrashedGlossaryTerm(String name, String slug, @Nullable String definition, List<String> forms) {
}
