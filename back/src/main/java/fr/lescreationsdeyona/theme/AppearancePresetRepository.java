package fr.lescreationsdeyona.theme;

import org.springframework.data.jpa.repository.JpaRepository;

interface AppearancePresetRepository extends JpaRepository<AppearancePreset, Long> {

	/** Compared with the column collation: case and accents ignored. */
	boolean existsByName(String name);

	boolean existsByNameAndIdNot(String name, long id);

}
