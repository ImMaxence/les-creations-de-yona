package fr.lescreationsdeyona.content;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SiteContentRepository extends JpaRepository<SiteContent, Short> {

	/** The photo of the "À propos" section, if one is chosen. */
	@Query("select s.aboutImage.id from SiteContent s where s.aboutImage is not null")
	Optional<UUID> findAboutImageId();

}
