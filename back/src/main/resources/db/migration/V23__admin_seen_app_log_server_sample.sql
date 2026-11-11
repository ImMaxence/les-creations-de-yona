-- What each admin has already looked at: the history (until when), the changelog (which version),
-- the error log (until when). The badges of the back-office menu count what came after.
CREATE TABLE admin_seen (
    admin_email  text        NOT NULL,
    topic        text        NOT NULL CHECK (topic IN ('HISTORY', 'CHANGELOG', 'LOGS')),
    seen_at      timestamptz NOT NULL,
    seen_version text        CHECK (char_length(seen_version) <= 30),
    PRIMARY KEY (admin_email, topic)
);

-- The errors and warnings of the site: the backend's own, and those of the visitors' browsers. The
-- same error again adds to its count rather than to the list. Kept 30 days.
CREATE TABLE app_log (
    id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fingerprint   text        NOT NULL UNIQUE,
    level         text        NOT NULL CHECK (level IN ('ERROR', 'WARN')),
    source        text        NOT NULL CHECK (source IN ('BACKEND', 'BROWSER')),
    logger        text        CHECK (char_length(logger) <= 300),
    message       text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    detail        text        CHECK (char_length(detail) <= 20000),
    page          text        CHECK (char_length(page) <= 500),
    occurrences   integer     NOT NULL CHECK (occurrences >= 1),
    first_seen_at timestamptz NOT NULL,
    last_seen_at  timestamptz NOT NULL
);

CREATE INDEX app_log_last_seen_at_idx ON app_log (last_seen_at DESC, id DESC);

-- Memory and processor every 10 minutes, for the curves of the last 7, 30 or 90 days. Kept 90 days.
CREATE TABLE server_sample (
    sampled_at           timestamptz      PRIMARY KEY,
    backend_cpu          double precision CHECK (backend_cpu BETWEEN 0 AND 1),
    machine_cpu          double precision CHECK (machine_cpu BETWEEN 0 AND 1),
    backend_memory_bytes bigint           CHECK (backend_memory_bytes >= 0),
    heap_used_bytes      bigint           NOT NULL CHECK (heap_used_bytes >= 0),
    machine_used_bytes   bigint           NOT NULL CHECK (machine_used_bytes >= 0)
);
