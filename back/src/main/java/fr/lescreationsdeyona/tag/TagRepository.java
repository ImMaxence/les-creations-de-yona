package fr.lescreationsdeyona.tag;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TagRepository extends JpaRepository<Tag, Long> {

	boolean existsBySlug(String slug);

	/** Compared with the column collation: case and accents ignored. */
	boolean existsByName(String name);

}
