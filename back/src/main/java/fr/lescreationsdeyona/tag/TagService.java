package fr.lescreationsdeyona.tag;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import fr.lescreationsdeyona.trash.TrashBin;
import fr.lescreationsdeyona.trash.TrashItem;
import fr.lescreationsdeyona.trash.TrashKind;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TagService {

	private final TagRepository tagRepository;

	private final TagMapper tagMapper;

	private final TrashBin trashBin;

	private final AuditLog auditLog;

	private final JdbcClient jdbc;

	/** Public site: the counts are of published recipes. */
	public List<TagSummary> listPublic() {
		return list(false);
	}

	/** Back-office: drafts count too. */
	public List<TagSummary> listAll() {
		return list(true);
	}

	@Transactional
	public TagResponse create(TagForm form) {
		String name = Texts.capitalizeFirstLetter(form.name().strip());
		if (tagRepository.existsByName(name)) {
			throw new ApiException(ErrorCode.TAG_ALREADY_EXISTS);
		}
		Tag tag = new Tag();
		tag.setName(name);
		tag.setSlug(Slugs.uniqueSlug(name, "tag", tagRepository::existsBySlug));
		TagResponse created = tagMapper.toResponse(tagRepository.saveAndFlush(tag));
		auditLog.record(AuditAction.CREATED, AuditKind.TAG, created.name(), created.id());
		return created;
	}

	@Transactional
	public TagResponse rename(long id, TagForm form) {
		Tag tag = find(id);
		String name = Texts.capitalizeFirstLetter(form.name().strip());
		// The same name with another case or accent corrects this tag: it is not a duplicate.
		if (!Texts.foldCaseAndAccents(name).equals(Texts.foldCaseAndAccents(tag.getName()))
				&& tagRepository.existsByName(name)) {
			throw new ApiException(ErrorCode.TAG_ALREADY_EXISTS);
		}
		AuditChanges changes = new AuditChanges().add("Nom", tag.getName(), name);
		tag.setName(name);
		auditLog.record(AuditAction.UPDATED, AuditKind.TAG, name, id, changes);
		return tagMapper.toResponse(tagRepository.saveAndFlush(tag));
	}

	/**
	 * All or none, to the trash for 30 days, with the recipes carrying them. Taken off their recipes,
	 * which otherwise stay as they are ({@code ON DELETE CASCADE}).
	 */
	@Transactional
	public void deleteAll(Collection<Long> ids) {
		List<Tag> tags = tagRepository.findAllById(ids);
		if (tags.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.TAG_NOT_FOUND);
		}
		for (Tag tag : tags) {
			trashBin.put(new TrashBin.Entry(TrashKind.TAG, tag.getName(), tag.getSlug(), null, null, null,
					new TrashedTag(tag.getName(), tag.getSlug()),
					new TrashedTag.Links(tagRepository.findRecipesCarrying(tag.getId())), null));
		}
		tagRepository.deleteAll(tags);
	}

	/**
	 * Created again from the trash: same address if still free, back on its recipes that still exist
	 * (found by URL if restored meanwhile). Refused when another tag has taken its name.
	 */
	@Transactional
	public TagRestored restoreFromTrash(TrashItem trashed) {
		TrashedTag kept = trashBin.content(trashed, TrashedTag.class);
		if (tagRepository.existsByName(kept.name())) {
			throw new ApiException(ErrorCode.TAG_ALREADY_EXISTS);
		}
		Tag tag = new Tag();
		tag.setName(kept.name());
		tag.setSlug(tagRepository.existsBySlug(kept.slug()) ? Slugs.uniqueSlug(kept.name(), "tag", tagRepository::existsBySlug)
				: kept.slug());
		long id = tagRepository.saveAndFlush(tag).getId();
		List<TrashedTag.RecipeRef> recipes = trashBin.links(trashed, TrashedTag.Links.class, TrashedTag.Links.NONE).recipes();
		int recipesBack = recipes.isEmpty() ? 0
				: tagRepository.addToRecipes(id, recipes.stream().map(TrashedTag.RecipeRef::id).toList(),
						recipes.stream().map(TrashedTag.RecipeRef::slug).toList());
		return new TagRestored(new TagResponse(id, tag.getName(), tag.getSlug()), recipesBack);
	}

	/** What a restore created again, and the number of recipes it is back on. */
	public record TagRestored(TagResponse tag, int recipesBack) {
	}

	/**
	 * Those still existing, e.g. for a recipe taken out of the trash: by id, or by address for a tag
	 * put in the trash and restored meanwhile (it got a new id).
	 */
	public List<Long> stillExisting(Collection<TagResponse> tags) {
		return tags.stream()
			.map(tag -> tagRepository.existsById(tag.id()) ? Optional.of(tag.id())
					: tagRepository.findBySlug(tag.slug()).map(Tag::getId))
			.flatMap(Optional::stream)
			.distinct()
			.toList();
	}

	/** In the order given, each once: the tags chosen in the recipe form. */
	public List<Tag> findAll(Collection<Long> ids) {
		Map<Long, Tag> tagsById = tagRepository.findAllById(ids)
			.stream()
			.collect(Collectors.toMap(Tag::getId, Function.identity()));
		return ids.stream()
			.distinct()
			.map(id -> Optional.ofNullable(tagsById.get(id)).orElseThrow(() -> new ApiException(ErrorCode.TAG_NOT_FOUND)))
			.toList();
	}

	private List<TagSummary> list(boolean withDrafts) {
		return jdbc.sql("""
				select t.id, t.name, t.slug, count(r.id) as recipes from tag t
				left join recipe_tag link on link.tag_id = t.id
				left join recipe r on r.id = link.recipe_id and (:withDrafts or r.status = 'PUBLISHED')
				group by t.id, t.name, t.slug order by t.name""")
			.param("withDrafts", withDrafts)
			.query((row, index) -> new TagSummary(row.getLong("id"), row.getString("name"), row.getString("slug"),
					row.getLong("recipes")))
			.list();
	}

	private Tag find(long id) {
		return tagRepository.findById(id).orElseThrow(() -> new ApiException(ErrorCode.TAG_NOT_FOUND));
	}

}
