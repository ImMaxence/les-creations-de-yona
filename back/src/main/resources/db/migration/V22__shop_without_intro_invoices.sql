-- 2.4.0

-- The shop no longer has an introduction: its banner and its products say it all.
ALTER TABLE shop_settings DROP COLUMN intro;

-- Who the invoices are from, as written on them; the VAT mention of a micro-business by default.
ALTER TABLE shop_settings
    ADD COLUMN seller_name    text CHECK (char_length(seller_name) <= 150),
    ADD COLUMN seller_address text CHECK (char_length(seller_address) <= 500),
    ADD COLUMN seller_siret   text CHECK (seller_siret ~ '^[0-9]{14}$'),
    ADD COLUMN seller_contact text CHECK (char_length(seller_contact) <= 200),
    ADD COLUMN vat_mention    text NOT NULL DEFAULT 'TVA non applicable, art. 293 B du CGI' CHECK (char_length(vat_mention) BETWEEN 1 AND 200);

-- An invoice of an order handed over: numbered without gap within its year ("2026-0001"), written once and never
-- changed. Everything it shows is copied in it: the order is erased after 12 months, the invoice is kept 10 years.
CREATE TABLE invoice (
    id             bigint         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    number         text           NOT NULL UNIQUE CHECK (number ~ '^[0-9]{4}-[0-9]{4,}$'),
    order_id       bigint         NOT NULL UNIQUE,
    issued_on      date           NOT NULL,
    customer_name  text           NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 100),
    customer_email text           CHECK (char_length(customer_email) <= 200),
    customer_phone text           CHECK (char_length(customer_phone) <= 30),
    seller_name    text           NOT NULL CHECK (char_length(seller_name) BETWEEN 1 AND 150),
    seller_address text           CHECK (char_length(seller_address) <= 500),
    seller_siret   text           CHECK (seller_siret ~ '^[0-9]{14}$'),
    seller_contact text           CHECK (char_length(seller_contact) <= 200),
    vat_mention    text           NOT NULL CHECK (char_length(vat_mention) BETWEEN 1 AND 200),
    amount         numeric(10, 2) NOT NULL CHECK (amount > 0),
    admin_email    text           NOT NULL,
    created_at     timestamptz    NOT NULL
);

CREATE INDEX invoice_issued_on_idx ON invoice (issued_on DESC, id DESC);

-- Its lines, as the order had them; a discount or an extra agreed afterwards is the difference with the amount.
CREATE TABLE invoice_line (
    invoice_id bigint        NOT NULL REFERENCES invoice (id) ON DELETE CASCADE,
    position   integer       NOT NULL CHECK (position >= 0),
    label      text          NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
    detail     text          CHECK (char_length(detail) <= 200),
    quantity   integer       NOT NULL CHECK (quantity BETWEEN 1 AND 50),
    unit_price numeric(8, 2) NOT NULL CHECK (unit_price >= 0),
    PRIMARY KEY (invoice_id, position)
);
