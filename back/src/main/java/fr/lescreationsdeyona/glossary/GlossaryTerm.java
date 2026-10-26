package fr.lescreationsdeyona.glossary;

import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A pastry word (émulsionner, chemiser…), explained on the glossary page and in the recipe steps. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class GlossaryTerm {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Unique, case and accents ignored. */
	private String name;

	/** Anchor on the glossary page: /glossaire#{slug}. */
	private String slug;

	private String definition;

	/** Other spellings found in the steps (émulsionnez, émulsionné…), matched like the name. */
	@JdbcTypeCode(SqlTypes.ARRAY)
	private List<String> forms = new ArrayList<>();

	@LastModifiedDate
	private Instant updatedAt;

	@LastModifiedBy
	private String updatedBy;

}
