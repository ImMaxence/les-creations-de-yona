package fr.lescreationsdeyona.recipe;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface RecipeTrashRepository extends JpaRepository<RecipeTrash, Long> {

	List<RecipeTrash> findAllByOrderByDeletedAtDesc();

	@Modifying
	@Query("delete from RecipeTrash t where t.deletedAt < :before")
	int deleteDeletedBefore(Instant before);

}
