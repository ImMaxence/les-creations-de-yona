package fr.lescreationsdeyona.tag;

import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
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
		return tagMapper.toResponse(tagRepository.saveAndFlush(tag));
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
		tag.setName(name);
		return tagMapper.toResponse(tagRepository.saveAndFlush(tag));
	}

	/** All or none. Taken off their recipes, which otherwise stay as they are ({@code ON DELETE CASCADE}). */
	@Transactional
	public void deleteAll(Collection<Long> ids) {
		List<Tag> tags = tagRepository.findAllById(ids);
		if (tags.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.TAG_NOT_FOUND);
		}
		tagRepository.deleteAll(tags);
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
