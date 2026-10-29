package fr.lescreationsdeyona.social;

import fr.lescreationsdeyona.audit.AuditAction;
import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.audit.AuditKind;
import fr.lescreationsdeyona.audit.AuditLog;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SocialLinkService {

	private final SocialLinkRepository socialLinkRepository;

	private final SocialLinkMapper socialLinkMapper;

	private final AuditLog auditLog;

	@Cacheable(PublicCache.SOCIAL_LINKS)
	public List<SocialLinkResponse> list() {
		return socialLinkRepository.findAll(Sort.by("position")).stream().map(socialLinkMapper::toResponse).toList();
	}

	@Transactional
	public List<SocialLinkResponse> replaceAll(SocialLinksForm form) {
		long distinctPlatforms = form.links().stream().map(SocialLinksForm.Link::platform).distinct().count();
		if (distinctPlatforms != form.links().size()) {
			throw new ApiException(ErrorCode.DUPLICATE_SOCIAL_PLATFORM);
		}
		List<String> before = socialLinkRepository.findAll(Sort.by("position")).stream()
			.map(link -> AuditChanges.named(link.getPlatform()) + " : " + link.getUrl())
			.toList();
		// Runs right away, so the new rows cannot collide with the old ones on the unique platform.
		socialLinkRepository.deleteAllInBatch();
		List<SocialLink> links = new ArrayList<>();
		for (int position = 0; position < form.links().size(); position++) {
			SocialLinksForm.Link link = form.links().get(position);
			SocialLink socialLink = new SocialLink();
			socialLink.setPlatform(link.platform());
			socialLink.setUrl(link.url().strip());
			socialLink.setPosition(position);
			links.add(socialLink);
		}
		auditLog.record(AuditAction.UPDATED, AuditKind.SOCIAL_LINKS, "Réseaux sociaux", null,
				new AuditChanges().addLines("Liens", before, links.stream()
					.map(link -> AuditChanges.named(link.getPlatform()) + " : " + link.getUrl())
					.toList()));
		return socialLinkRepository.saveAll(links).stream().map(socialLinkMapper::toResponse).toList();
	}

}
