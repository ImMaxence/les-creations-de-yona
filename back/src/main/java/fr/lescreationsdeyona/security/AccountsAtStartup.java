package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.AccessPurpose;
import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * At each start: the first accounts when there is none ({@code APP_ADMIN_EMAILS}), and the way back in
 * when nobody can sign in any more ({@code APP_ADMIN_RECOVERY_EMAIL}): a link valid one hour, written in
 * the server's logs, which only whoever runs the server reads (Coolify). At INFO, so it stays out of
 * "Journaux", which every admin reads.
 */
@Component
class AccountsAtStartup implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(AccountsAtStartup.class);

	private final AdminAccounts accounts;

	private final AccessLinks links;

	private final AdminProperties properties;

	private final URI siteUrl;

	AccountsAtStartup(AdminAccounts accounts, AccessLinks links, AdminProperties properties, @Value("${app.site-url}") URI siteUrl) {
		this.accounts = accounts;
		this.links = links;
		this.properties = properties;
		this.siteUrl = siteUrl;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (!accounts.any()) {
			if (properties.emails().isEmpty() && properties.recoveryEmail() == null) {
				log.warn("No admin account, and APP_ADMIN_EMAILS is empty: set it, or APP_ADMIN_RECOVERY_EMAIL, to get into the back-office");
			}
			else if (!properties.emails().isEmpty()) {
				properties.emails().forEach(email -> accounts.create(email, null, AccountStatus.ACTIVE, null));
				log.info("{} admin account(s) created from APP_ADMIN_EMAILS: each signs in once with the Google account of that address",
						properties.emails().size());
			}
		}
		String recovery = properties.recoveryEmail();
		if (recovery != null) {
			Account account = accounts.findByEmail(recovery).orElseGet(() -> accounts.create(recovery, null, AccountStatus.ACTIVE, null));
			if (account.status() == AccountStatus.DISABLED) {
				accounts.setStatus(account.id(), AccountStatus.ACTIVE);
			}
			AccessLinks.Issued issued = links.issue(account.id(), AccessPurpose.RECOVERY, AccessLinks.SERVER_RECOVERY_VALIDITY, null);
			String url = UriComponentsBuilder.fromUri(siteUrl).replacePath("/admin/acces/{token}").buildAndExpand(issued.token()).toUriString();
			log.info("Recovery link for {}, valid one hour, once (then remove APP_ADMIN_RECOVERY_EMAIL): {}", account.email(), url);
			// Without the link, for "Journaux": while the variable stays, each start writes a new one in the server's logs
			log.warn("APP_ADMIN_RECOVERY_EMAIL is set: a recovery link for {} was written in the server's logs. Remove the variable once back in",
					account.email());
		}
	}

}
