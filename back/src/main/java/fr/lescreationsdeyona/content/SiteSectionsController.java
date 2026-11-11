package fr.lescreationsdeyona.content;

import fr.lescreationsdeyona.cap.CapEntryRepository;
import fr.lescreationsdeyona.cap.CapStatus;
import fr.lescreationsdeyona.common.PublicCache;
import fr.lescreationsdeyona.shop.ShopMode;
import fr.lescreationsdeyona.shop.ShopSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Asked at every page rendered, for the links of the navigation: two yes or no, rather than the
 * whole of "Mon CAP" written into each page.
 */
@Tag(name = "Site content")
@RestController
@RequiredArgsConstructor
class SiteSectionsController {

	private final SiteSectionsReader reader;

	@Operation(summary = "Which optional sections the navigation links to")
	@GetMapping("/api/site-sections")
	SiteSections getSiteSections() {
		return reader.read();
	}

	/** Apart from the controller, for the cache to apply. */
	@Service
	@RequiredArgsConstructor
	@Transactional(readOnly = true)
	static class SiteSectionsReader {

		private final CapEntryRepository entryRepository;

		private final ShopSettingsRepository shopSettingsRepository;

		@Cacheable(PublicCache.SITE_SECTIONS)
		public SiteSections read() {
			return new SiteSections(entryRepository.existsByStatus(CapStatus.PUBLISHED),
					shopSettingsRepository.findAll().stream().anyMatch(settings -> settings.getMode() == ShopMode.OPEN));
		}

	}

}
