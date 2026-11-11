package fr.lescreationsdeyona.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.util.ClassUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.pattern.PathPatternParser;

/**
 * Every endpoint of the API, read from the controllers, against the rules of {@link SecurityConfig}:
 * the back-office behind the admin role, the visitors reading only what is listed, and writing only
 * the few things that need no account. A new endpoint lands in one of these, or this test says so.
 */
class EndpointAccessTest {

	private static final PathPatternParser PARSER = new PathPatternParser();

	/** What visitors may send, by method: the rest is denied. */
	private static final Map<HttpMethod, List<String>> PUBLIC_WRITES = Map.of(HttpMethod.POST,
			List.of(SecurityConfig.NOTIFICATION_SUBSCRIPTIONS, SecurityConfig.RECIPE_VIEWS, SecurityConfig.AI_VISITS, SecurityConfig.BROWSER_ERRORS, SecurityConfig.FEEDBACK,
					SecurityConfig.SHOP_ORDERS),
			HttpMethod.DELETE, List.of(SecurityConfig.NOTIFICATION_SUBSCRIPTIONS));

	private static final List<Endpoint> ENDPOINTS = endpoints();

	/** An endpoint: its method, its address ("{slug}" as written in the controller), its controller. */
	record Endpoint(HttpMethod method, String path, String controller) {

		/** The address with a value in place of each variable. */
		String sample() {
			return path.replaceAll("\\{\\*?[^}]+}", "x");
		}

		boolean isBackOffice() {
			return path.startsWith("/api/admin/") || path.equals("/api/admin");
		}

		@Override
		public String toString() {
			return method + " " + path + " (" + controller + ")";
		}

	}

	private static List<Endpoint> endpoints() {
		ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
		scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
		List<Endpoint> endpoints = new ArrayList<>();
		for (BeanDefinition definition : scanner.findCandidateComponents("fr.lescreationsdeyona")) {
			Class<?> type = ClassUtils.resolveClassName(definition.getBeanClassName(), EndpointAccessTest.class.getClassLoader());
			String[] bases = paths(AnnotatedElementUtils.findMergedAnnotation(type, RequestMapping.class));
			for (Method method : type.getDeclaredMethods()) {
				RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
				if (mapping == null) {
					continue;
				}
				for (String base : bases) {
					for (String path : paths(mapping)) {
						for (RequestMethod verb : mapping.method()) {
							endpoints.add(new Endpoint(HttpMethod.valueOf(verb.name()), base + path, type.getSimpleName()));
						}
					}
				}
			}
		}
		return endpoints;
	}

	private static String[] paths(@Nullable RequestMapping mapping) {
		if (mapping == null) {
			return new String[] { "" };
		}
		String[] paths = mapping.path().length > 0 ? mapping.path() : mapping.value();
		return paths.length > 0 ? paths : new String[] { "" };
	}

	private static boolean matches(String pattern, String path) {
		return PARSER.parse(pattern).matches(PathContainer.parsePath(path));
	}

	private static boolean publicRead(Endpoint endpoint) {
		return Arrays.stream(SecurityConfig.PUBLIC_READS).anyMatch(pattern -> matches(pattern, endpoint.sample()));
	}

	@Test
	void findsEveryController() {
		assertThat(ENDPOINTS).hasSizeGreaterThan(100);
		// Each endpoint names its method: none answers them all
		assertThat(ENDPOINTS).extracting(Endpoint::controller).contains("AdminInvoiceController", "ShopController", "CapController");
	}

	@Test
	void keepsTheBackOfficeBehindTheAdminRole() {
		assertThat(ENDPOINTS).filteredOn(endpoint -> endpoint.controller().startsWith("Admin"))
			.allSatisfy(endpoint -> assertThat(endpoint.isBackOffice()).as(endpoint.toString()).isTrue());
	}

	@Test
	void letsVisitorsReachEveryPublicPage() {
		// A read outside the back-office not listed would be denied: a page of the site left broken
		assertThat(ENDPOINTS).filteredOn(endpoint -> !endpoint.isBackOffice() && endpoint.method() == HttpMethod.GET)
			.allSatisfy(endpoint -> assertThat(publicRead(endpoint)).as(endpoint.toString()).isTrue());
	}

	@Test
	void letsVisitorsWriteOnlyWhatNeedsNoAccount() {
		assertThat(ENDPOINTS).filteredOn(endpoint -> !endpoint.isBackOffice() && endpoint.method() != HttpMethod.GET)
			.allSatisfy(endpoint -> assertThat(PUBLIC_WRITES.getOrDefault(endpoint.method(), List.of()))
				.as(endpoint.toString())
				.anyMatch(pattern -> matches(pattern, endpoint.sample())));
	}

	@Test
	void opensNoPartOfTheBackOfficeToVisitors() {
		for (String pattern : SecurityConfig.PUBLIC_READS) {
			assertThat(matches(pattern, "/api/admin/me")).as(pattern).isFalse();
			assertThat(pattern).as(pattern).doesNotStartWith("/api/admin").doesNotStartWith("/**").doesNotStartWith("/api/**");
		}
		PUBLIC_WRITES.values().stream().flatMap(List::stream).forEach(pattern -> assertThat(pattern).doesNotStartWith("/api/admin"));
	}

	@Test
	void listsNoPublicAddressLeadingNowhere() {
		// An address allowed without an endpoint behind it would open whatever comes there later
		for (String pattern : SecurityConfig.PUBLIC_READS) {
			assertThat(ENDPOINTS).as(pattern)
				.anyMatch(endpoint -> endpoint.method() == HttpMethod.GET && !endpoint.isBackOffice() && matches(pattern, endpoint.sample()));
		}
		PUBLIC_WRITES.forEach((method, patterns) -> patterns.forEach(pattern -> assertThat(ENDPOINTS).as(method + " " + pattern)
			.anyMatch(endpoint -> endpoint.method() == method && matches(pattern, endpoint.sample()))));
	}

	@Test
	void keepsTheInvoicesAndTheReceiptsForTheAdmins() {
		assertThat(ENDPOINTS).filteredOn(endpoint -> endpoint.path().contains("invoice") || endpoint.path().contains("receipt"))
			.isNotEmpty()
			.allSatisfy(endpoint -> assertThat(endpoint.isBackOffice()).as(endpoint.toString()).isTrue());
	}

}
