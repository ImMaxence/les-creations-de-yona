package fr.lescreationsdeyona.glossary;

import fr.lescreationsdeyona.common.Slugs;
import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The glossary of pastry words: its page, and the words explained in the recipe steps. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GlossaryService {

	private final GlossaryTermRepository termRepository;

	/** Sorted by name, the French way. */
	public List<GlossaryTermResponse> list() {
		return termRepository.findAll(Sort.by("name")).stream().map(GlossaryService::toResponse).toList();
	}

	@Transactional
	public GlossaryTermResponse create(GlossaryTermForm form) {
		String name = Texts.capitalizeFirstLetter(form.name().strip());
		if (termRepository.existsByName(name)) {
			throw new ApiException(ErrorCode.GLOSSARY_TERM_ALREADY_EXISTS);
		}
		GlossaryTerm term = new GlossaryTerm();
		term.setSlug(Slugs.uniqueSlug(name, "mot", termRepository::existsBySlug));
		return save(term, name, form);
	}

	@Transactional
	public GlossaryTermResponse update(long id, GlossaryTermForm form) {
		GlossaryTerm term = termRepository.findById(id)
			.orElseThrow(() -> new ApiException(ErrorCode.GLOSSARY_TERM_NOT_FOUND));
		String name = Texts.capitalizeFirstLetter(form.name().strip());
		// The same name with another case or accent corrects this word: it is not a duplicate.
		if (!Texts.foldCaseAndAccents(name).equals(Texts.foldCaseAndAccents(term.getName()))
				&& termRepository.existsByName(name)) {
			throw new ApiException(ErrorCode.GLOSSARY_TERM_ALREADY_EXISTS);
		}
		return save(term, name, form);
	}

	/** All or none. */
	@Transactional
	public void deleteAll(Collection<Long> ids) {
		List<GlossaryTerm> terms = termRepository.findAllById(ids);
		if (terms.size() != new HashSet<>(ids).size()) {
			throw new ApiException(ErrorCode.GLOSSARY_TERM_NOT_FOUND);
		}
		termRepository.deleteAll(terms);
	}

	private GlossaryTermResponse save(GlossaryTerm term, String name, GlossaryTermForm form) {
		term.setName(name);
		term.setDefinition(form.definition().strip());
		term.getForms().clear();
		term.getForms().addAll(forms(name, form.forms()));
		return toResponse(termRepository.saveAndFlush(term));
	}

	/** Trimmed, each once (case and accents ignored), without the name itself. */
	private static List<String> forms(String name, List<String> forms) {
		Map<String, String> byKey = new LinkedHashMap<>();
		for (String form : forms) {
			String trimmed = form.strip();
			if (!trimmed.isEmpty()) {
				byKey.putIfAbsent(Texts.foldCaseAndAccents(trimmed), trimmed);
			}
		}
		byKey.remove(Texts.foldCaseAndAccents(name));
		return List.copyOf(byKey.values());
	}

	private static GlossaryTermResponse toResponse(GlossaryTerm term) {
		return new GlossaryTermResponse(term.getId(), term.getName(), term.getSlug(), term.getDefinition(),
				List.copyOf(term.getForms()));
	}

}
