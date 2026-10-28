package fr.lescreationsdeyona.glossary;

import java.util.List;

/** A word of the glossary in the trash, as JSON. */
record TrashedGlossaryTerm(String name, String slug, String definition, List<String> forms) {
}
