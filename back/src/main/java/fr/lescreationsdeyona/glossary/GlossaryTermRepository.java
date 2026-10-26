package fr.lescreationsdeyona.glossary;

import org.springframework.data.jpa.repository.JpaRepository;

interface GlossaryTermRepository extends JpaRepository<GlossaryTerm, Long> {

	boolean existsBySlug(String slug);

	/** Compared with the column collation: case and accents ignored. */
	boolean existsByName(String name);

}
