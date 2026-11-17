CREATE TABLE talents (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  entity_type TEXT NOT NULL DEFAULT 'person' CHECK(entity_type IN ('person','organization')),
  blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
CREATE TABLE topics (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  UNIQUE(category_id, name), UNIQUE(id, category_id)
) STRICT;
CREATE TABLE talent_categories (
  talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  PRIMARY KEY(talent_id, category_id)
) STRICT;
CREATE TABLE talent_topics (
  talent_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY(talent_id, topic_id),
  FOREIGN KEY(talent_id, category_id) REFERENCES talent_categories(talent_id, category_id) ON DELETE CASCADE,
  FOREIGN KEY(topic_id, category_id) REFERENCES topics(id, category_id)
) STRICT;
CREATE TABLE network_metrics (
  network TEXT NOT NULL,
  metric TEXT NOT NULL,
  PRIMARY KEY(network, metric)
) STRICT;
INSERT INTO network_metrics(network, metric) VALUES
 ('Instagram','followers'), ('YouTube','subscribers'), ('Spotify','monthly_listeners');
CREATE TABLE social_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  network TEXT NOT NULL CHECK(network IN ('Instagram','YouTube','Spotify')),
  external_id TEXT CHECK(external_id IS NULL OR length(trim(external_id)) > 0),
  url TEXT NOT NULL CHECK(url LIKE 'https://%'),
  identity_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(identity_confirmed IN (0,1)),
  identity_source TEXT,
  content_language TEXT,
  collection_state TEXT NOT NULL DEFAULT 'queued' CHECK(collection_state IN ('queued','collected','error','paused')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(network, external_id), UNIQUE(network, url), UNIQUE(id, network),
  CHECK(identity_confirmed = 0 OR length(trim(coalesce(identity_source,''))) > 0)
) STRICT;
CREATE TABLE metric_snapshots (
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL,
  network TEXT NOT NULL,
  metric TEXT NOT NULL,
  observed_on TEXT NOT NULL CHECK(observed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(observed_on,'+0 days') IS NOT NULL AND date(observed_on,'+0 days') = observed_on),
  value INTEGER NOT NULL CHECK(value >= 0),
  source TEXT NOT NULL CHECK(length(trim(source)) > 0),
  collected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(account_id, metric, observed_on),
  FOREIGN KEY(account_id, network) REFERENCES social_accounts(id, network) ON DELETE CASCADE,
  FOREIGN KEY(network, metric) REFERENCES network_metrics(network, metric)
) STRICT;
CREATE TABLE collection_runs (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','paused')),
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;
CREATE INDEX idx_accounts_talent ON social_accounts(talent_id);
CREATE INDEX idx_snapshots_date ON metric_snapshots(observed_on);
CREATE INDEX idx_collection_account ON collection_runs(account_id, created_at);
CREATE INDEX idx_talent_categories_category ON talent_categories(category_id);
