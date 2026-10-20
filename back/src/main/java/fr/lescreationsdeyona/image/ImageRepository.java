package fr.lescreationsdeyona.image;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImageRepository extends JpaRepository<Image, UUID> {
}
