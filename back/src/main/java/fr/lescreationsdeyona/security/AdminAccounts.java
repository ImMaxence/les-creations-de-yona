package fr.lescreationsdeyona.security;

import fr.lescreationsdeyona.security.AccountTypes.Account;
import fr.lescreationsdeyona.security.AccountTypes.AccountStatus;
import fr.lescreationsdeyona.security.AccountTypes.Identity;
import fr.lescreationsdeyona.security.AccountTypes.IdentityProvider;
import fr.lescreationsdeyona.security.AccountTypes.SignInMethod;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * The accounts of the back-office and the Google or Microsoft accounts linked to them, in SQL. Their
 * address is the key the rest of the site writes ({@code created_by}, the messages, the groups): it is
 * kept in lower case and never changes.
 */
@Service
public class AdminAccounts implements AdminDirectory {

	private static final String COLUMNS = """
			id, email, name, status, case when photo is null then 0 else photo_version end as photo_version, provider_picture, created_at,
			created_by, last_sign_in_at, last_sign_in_method""";

	private final JdbcClient jdbc;

	AdminAccounts(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	@Override
	public Set<String> emails() {
		return new LinkedHashSet<>(jdbc.sql("select email from admin_account where status = 'ACTIVE' order by email").query(String.class).list());
	}

	/** Every account, the newest last. */
	List<Account> all() {
		return jdbc.sql("select " + COLUMNS + " from admin_account order by created_at, id").query(AdminAccounts::account).list();
	}

	Optional<Account> find(long id) {
		return jdbc.sql("select " + COLUMNS + " from admin_account where id = :id").param("id", id).query(AdminAccounts::account).optional();
	}

	Optional<Account> findByEmail(String email) {
		return jdbc.sql("select " + COLUMNS + " from admin_account where email = :email")
			.param("email", AdminProperties.normalize(email))
			.query(AdminAccounts::account)
			.optional();
	}

	Optional<Account> findByIdentity(IdentityProvider provider, String subject) {
		return jdbc.sql("select " + COLUMNS + """
				 from admin_account
				where id = (select account_id from admin_identity where provider = :provider and subject = :subject)""")
			.param("provider", provider.name())
			.param("subject", subject)
			.query(AdminAccounts::account)
			.optional();
	}

	boolean any() {
		return jdbc.sql("select exists (select 1 from admin_account)").query(Boolean.class).single();
	}

	/** {@code status} ACTIVE for the first accounts, INVITED for those invited from "Utilisateurs". */
	Account create(String email, @Nullable String name, AccountStatus status, @Nullable String createdBy) {
		long id = jdbc.sql("""
				insert into admin_account (email, name, status, created_at, created_by)
				values (:email, :name, :status, :at, :by) returning id""")
			.param("email", AdminProperties.normalize(email))
			.param("name", name)
			.param("status", status.name())
			.param("at", now())
			.param("by", createdBy)
			.query(Long.class)
			.single();
		return find(id).orElseThrow();
	}

	void setStatus(long id, AccountStatus status) {
		jdbc.sql("update admin_account set status = :status where id = :id").param("status", status.name()).param("id", id).update();
	}

	void rename(long id, String name) {
		jdbc.sql("update admin_account set name = :name where id = :id").param("name", name).param("id", id).update();
	}

	void setPhoto(long id, byte[] webp) {
		jdbc.sql("update admin_account set photo = :photo, photo_version = photo_version + 1 where id = :id")
			.param("photo", webp)
			.param("id", id)
			.update();
	}

	/** Back to the photo of their Google account, or their initial. The version stays: a later photo gets a new address. */
	void removePhoto(long id) {
		jdbc.sql("update admin_account set photo = null where id = :id").param("id", id).update();
	}

	Optional<byte[]> photo(long id) {
		return jdbc.sql("select photo from admin_account where id = :id and photo is not null").param("id", id).query(byte[].class).optional();
	}

	void delete(long id) {
		jdbc.sql("delete from admin_account where id = :id").param("id", id).update();
	}

	/**
	 * Came in: the date and the way, the name of their Google or Microsoft account if they have none yet,
	 * and the photo of their Google account (kept up to date: it is used without one of their own).
	 */
	void signedIn(long id, SignInMethod method, @Nullable String name, @Nullable String providerPicture) {
		jdbc.sql("""
				update admin_account set last_sign_in_at = :at, last_sign_in_method = :method, name = coalesce(name, :name),
					provider_picture = coalesce(:picture, provider_picture)
				where id = :id""")
			.param("at", now())
			.param("method", method.name())
			.param("name", trimmedName(name))
			.param("picture", providerPicture == null || providerPicture.length() > 2000 ? null : providerPicture)
			.param("id", id)
			.update();
	}

	// Identities

	List<Identity> identities(long accountId) {
		return jdbc.sql("select account_id, provider, subject, email, linked_at, last_used_at from admin_identity where account_id = :id order by provider")
			.param("id", accountId)
			.query(AdminAccounts::identity)
			.list();
	}

	Map<Long, List<Identity>> identitiesOfAll() {
		Map<Long, List<Identity>> all = new HashMap<>();
		jdbc.sql("select account_id, provider, subject, email, linked_at, last_used_at from admin_identity order by provider")
			.query(AdminAccounts::identity)
			.list()
			.forEach(identity -> all.computeIfAbsent(identity.accountId(), id -> new ArrayList<>()).add(identity));
		return all;
	}

	void link(long accountId, IdentityProvider provider, String subject, @Nullable String email) {
		jdbc.sql("""
				insert into admin_identity (account_id, provider, subject, email, linked_at, last_used_at)
				values (:account, :provider, :subject, :email, :at, :at)""")
			.param("account", accountId)
			.param("provider", provider.name())
			.param("subject", subject)
			.param("email", shortEmail(email))
			.param("at", now())
			.update();
	}

	/** Used to sign in: the date, and its address there (it may have changed). */
	void used(IdentityProvider provider, String subject, @Nullable String email) {
		jdbc.sql("update admin_identity set last_used_at = :at, email = coalesce(:email, email) where provider = :provider and subject = :subject")
			.param("at", now())
			.param("email", shortEmail(email))
			.param("provider", provider.name())
			.param("subject", subject)
			.update();
	}

	void unlink(long accountId, IdentityProvider provider) {
		jdbc.sql("delete from admin_identity where account_id = :account and provider = :provider")
			.param("account", accountId)
			.param("provider", provider.name())
			.update();
	}

	/** Its Google and Microsoft accounts and its passkeys: the ways it has in. */
	int methodCount(long accountId) {
		return jdbc.sql("""
				select (select count(*) from admin_identity where account_id = :id) + (select count(*) from admin_passkey where account_id = :id)""")
			.param("id", accountId)
			.query(Integer.class)
			.single();
	}

	private static Account account(ResultSet row, int index) throws SQLException {
		String method = row.getString("last_sign_in_method");
		return new Account(row.getLong("id"), row.getString("email"), row.getString("name"), AccountStatus.valueOf(row.getString("status")),
				row.getInt("photo_version"), row.getString("provider_picture"), instant(row, "created_at"), row.getString("created_by"),
				instant(row, "last_sign_in_at"),
				method == null ? null : SignInMethod.valueOf(method));
	}

	private static Identity identity(ResultSet row, int index) throws SQLException {
		return new Identity(row.getLong("account_id"), IdentityProvider.valueOf(row.getString("provider")), row.getString("subject"),
				row.getString("email"), instant(row, "linked_at"), instant(row, "last_used_at"));
	}

	static @Nullable Instant instant(ResultSet row, String column) throws SQLException {
		OffsetDateTime value = row.getObject(column, OffsetDateTime.class);
		return value == null ? null : value.toInstant();
	}

	static OffsetDateTime now() {
		return OffsetDateTime.now(ZoneOffset.UTC);
	}

	/** The name given by Google or Microsoft, cut to what an account holds. */
	static @Nullable String trimmedName(@Nullable String name) {
		if (name == null || name.isBlank()) {
			return null;
		}
		String line = name.strip().replaceAll("\\s+", " ");
		return line.length() > 60 ? line.substring(0, 60).strip() : line;
	}

	private static @Nullable String shortEmail(@Nullable String email) {
		return email == null || email.length() > 320 ? null : email.strip().toLowerCase(java.util.Locale.ROOT);
	}

}
