-- 2.19.0. The accounts of the back-office, in place of the list of Google addresses (APP_ADMIN_EMAILS):
-- each admin signs in with Google, Microsoft or a passkey, as many as they like, all on the same account.
-- Tied to this server like admin_seen: saved empty in the backups (they hold keys), left as they are by a
-- restore. On an empty server, the first start creates the accounts of APP_ADMIN_EMAILS again.

-- An admin. email: the address the back-office knows them by, written in created_by, updated_by, the
-- messages and the groups, in lower case; it does not change. status: INVITED until the first sign-in
-- with the invitation link, DISABLED to keep someone out without losing who they are.
-- photo: chosen in "Mon compte", 256 x 256 WebP, changed with photo_version (its address);
-- provider_picture: the photo of the Google account, used without one.
-- passkey_handle: the random identifier the passkeys of this account carry (WebAuthn "user.id").
CREATE TABLE admin_account (
    id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               text        NOT NULL UNIQUE CHECK (char_length(email) BETWEEN 3 AND 320 AND email = lower(email)),
    name                text        CHECK (char_length(name) BETWEEN 1 AND 60),
    status              text        NOT NULL CHECK (status IN ('INVITED', 'ACTIVE', 'DISABLED')),
    photo               bytea,
    photo_version       integer     NOT NULL DEFAULT 0,
    provider_picture    text        CHECK (char_length(provider_picture) <= 2000),
    passkey_handle      bytea       UNIQUE,
    created_at          timestamptz NOT NULL,
    created_by          text        CHECK (char_length(created_by) <= 320),
    last_sign_in_at     timestamptz,
    last_sign_in_method text        CHECK (last_sign_in_method IN ('GOOGLE', 'MICROSOFT', 'PASSKEY'))
);

-- A Google or Microsoft account linked to an admin, known by its own identifier there (the "sub" of
-- OpenID Connect), never by its address alone. One of each per admin.
CREATE TABLE admin_identity (
    account_id   bigint      NOT NULL REFERENCES admin_account (id) ON DELETE CASCADE,
    provider     text        NOT NULL CHECK (provider IN ('GOOGLE', 'MICROSOFT')),
    subject      text        NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 255),
    email        text        CHECK (char_length(email) <= 320),
    linked_at    timestamptz NOT NULL,
    last_used_at timestamptz,
    PRIMARY KEY (account_id, provider),
    UNIQUE (provider, subject)
);

-- A passkey of an admin: the public part only, the private one never leaves their device.
-- transports: comma-separated ("internal,hybrid"). backup_state: synced (iCloud, Google Password Manager…).
CREATE TABLE admin_passkey (
    credential_id                bytea       PRIMARY KEY,
    account_id                   bigint      NOT NULL REFERENCES admin_account (id) ON DELETE CASCADE,
    label                        text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
    credential_type              text        NOT NULL,
    public_key                   bytea       NOT NULL,
    signature_count              bigint      NOT NULL,
    uv_initialized               boolean     NOT NULL,
    backup_eligible              boolean     NOT NULL,
    backup_state                 boolean     NOT NULL,
    transports                   text        NOT NULL,
    attestation_object           bytea,
    attestation_client_data_json bytea,
    created_at                   timestamptz NOT NULL,
    last_used_at                 timestamptz
);

CREATE INDEX admin_passkey_account_idx ON admin_passkey (account_id);

-- A link that lets an admin in once, to choose a way to sign in: the invitation of a new admin, or a
-- recovery link given by another admin (or written in the server's logs). Only the SHA-256 of its
-- token is kept; it is deleted once used. One at a time per admin.
CREATE TABLE admin_access_link (
    account_id bigint      PRIMARY KEY REFERENCES admin_account (id) ON DELETE CASCADE,
    token_hash bytea       NOT NULL UNIQUE,
    purpose    text        NOT NULL CHECK (purpose IN ('INVITATION', 'RECOVERY')),
    created_at timestamptz NOT NULL,
    created_by text        CHECK (char_length(created_by) <= 320),
    expires_at timestamptz NOT NULL
);
