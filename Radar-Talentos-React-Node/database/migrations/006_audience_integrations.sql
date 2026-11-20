CREATE TABLE audience_import_runs (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
 network TEXT NOT NULL, metric TEXT NOT NULL, source TEXT NOT NULL, quality TEXT NOT NULL CHECK(quality IN ('verified','estimated')),
 period_start TEXT NOT NULL, period_end TEXT NOT NULL, report_ref TEXT NOT NULL, authorization_ref TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('success','partial','empty','failed')), imported INTEGER NOT NULL DEFAULT 0,
 unresolved INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(network,metric) REFERENCES regional_metrics(network,metric)
) STRICT;
CREATE TABLE audience_city_map (
 network TEXT NOT NULL, external_city TEXT NOT NULL, municipality_code TEXT NOT NULL REFERENCES municipalities(code), evidence TEXT NOT NULL,
 PRIMARY KEY(network,external_city)
) STRICT;
