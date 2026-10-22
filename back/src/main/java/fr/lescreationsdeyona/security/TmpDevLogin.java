package fr.lescreationsdeyona.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.Map;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

// TEMPORARY local test login. MUST BE DELETED before committing.
@Configuration(proxyBeanMethods = false)
class TmpDevLogin {

	@Bean
	FilterRegistrationBean<OncePerRequestFilter> tmpDevLoginFilter() {
		OncePerRequestFilter filter = new OncePerRequestFilter() {
			@Override
			protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
					throws java.io.IOException, jakarta.servlet.ServletException {
				if (!"/api/tmp-login".equals(request.getRequestURI())) {
					chain.doFilter(request, response);
					return;
				}
				OidcIdToken token = new OidcIdToken("tmp", Instant.now(), Instant.now().plusSeconds(3600),
						Map.of("sub", "tmp", "email", "tmp-admin@example.com", "name", "Maxence Test"));
				DefaultOidcUser user = new DefaultOidcUser(AuthorityUtils.createAuthorityList("ROLE_ADMIN"), token, "email");
				var auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
				var context = new SecurityContextImpl(auth);
				SecurityContextHolder.setContext(context);
				new HttpSessionSecurityContextRepository().saveContext(context, request, response);
				response.setStatus(204);
			}
		};
		FilterRegistrationBean<OncePerRequestFilter> registration = new FilterRegistrationBean<>(filter);
		registration.setOrder(-1000);
		return registration;
	}

}
