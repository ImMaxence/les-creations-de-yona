package fr.lescreationsdeyona.security;

import java.util.Optional;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Component;

/** Address of the signed-in admin, written to {@code created_by} and {@code updated_by}. */
@Component
class AdminAuditorAware implements AuditorAware<String> {

	@Override
	public Optional<String> getCurrentAuditor() {
		return AdminAuthentication.current().map(AdminPrincipal::email);
	}

}
