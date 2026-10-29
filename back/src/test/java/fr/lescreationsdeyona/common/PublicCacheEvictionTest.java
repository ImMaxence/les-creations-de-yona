package fr.lescreationsdeyona.common;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** The public cache emptied by the writes of the back-office, not by its reads. */
class PublicCacheEvictionTest {

	private final PublicCache publicCache = mock(PublicCache.class);

	private final PublicCacheEviction eviction = new PublicCacheEviction(publicCache);

	@Test
	void forgetsThePublicAnswersAfterAWrite() {
		eviction.afterCompletion(new MockHttpServletRequest("PUT", "/api/admin/recipes/7"), new MockHttpServletResponse(),
				new Object(), null);

		verify(publicCache).clear();
	}

	@Test
	void keepsThemWhenTheBackOfficeOnlyReads() {
		eviction.afterCompletion(new MockHttpServletRequest("GET", "/api/admin/recipes"), new MockHttpServletResponse(),
				new Object(), null);

		verify(publicCache, never()).clear();
	}

}
