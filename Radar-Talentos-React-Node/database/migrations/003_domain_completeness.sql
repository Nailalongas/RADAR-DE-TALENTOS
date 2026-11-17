-- Ampliacao do esquema para cobrir todas as regras do guia de continuidade:
-- 1. Bloqueio por conta e protecao do historico retido contra exclusao destrutiva
-- 2. Indicador de arredondamento (YouTube), tipo de evidencia de identidade e retentativa (retry_at)
-- 3. Favoritos e arquivos de pesquisa
-- 4. Mapa de audiencia, sessoes de eventos e proveniencia de audiencia estimada
-- 5. Orcamentos de coleta (Spotify, Instagram, YouTube)

ALTER TABLE social_accounts ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1));
ALTER TABLE social_accounts ADD COLUMN identity_evidence TEXT;
ALTER TABLE social_accounts ADD COLUMN retry_at TEXT;
ALTER TABLE social_accounts ADD COLUMN last_attempt_at TEXT;
ALTER TABLE social_accounts ADD COLUMN last_error TEXT;

ALTER TABLE metric_snapshots ADD COLUMN is_rounded INTEGER NOT NULL DEFAULT 0 CHECK(is_rounded IN (0,1));

CREATE TABLE blocked_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  network TEXT NOT NULL CHECK(network IN ('Instagram','YouTube','Spotify')),
  url TEXT NOT NULL CHECK(url LIKE 'https://%'),
  external_id TEXT,
  reason TEXT,
  blocked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(network, url)
) STRICT;

CREATE TRIGGER prevent_talent_delete_with_history
BEFORE DELETE ON talents
WHEN EXISTS (
  SELECT 1
  FROM social_accounts sa
  JOIN metric_snapshots ms ON ms.account_id = sa.id
  WHERE sa.talent_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'Exclusao bloqueada: preserve o historico retido marcando blocked = 1.');
END;

CREATE TRIGGER prevent_account_delete_with_history
BEFORE DELETE ON social_accounts
WHEN EXISTS (
  SELECT 1
  FROM metric_snapshots ms
  WHERE ms.account_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'Exclusao bloqueada: preserve o historico retido marcando blocked = 1.');
END;

CREATE TABLE favorite_talents (
  talent_id TEXT PRIMARY KEY NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;

CREATE TABLE research_archives (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  observed_day TEXT NOT NULL CHECK(observed_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  filters_json TEXT NOT NULL,
  results_json TEXT NOT NULL,
  summary TEXT
) STRICT;

CREATE TABLE event_cities (
  municipality_code TEXT PRIMARY KEY NOT NULL CHECK(municipality_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  state_uf TEXT NOT NULL CHECK(length(state_uf) = 2),
  population INTEGER CHECK(population IS NULL OR population >= 0),
  gdp_per_capita REAL CHECK(gdp_per_capita IS NULL OR gdp_per_capita >= 0)
) STRICT;

CREATE TABLE audience_estimates (
  id TEXT PRIMARY KEY NOT NULL,
  talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  municipality_code TEXT NOT NULL REFERENCES event_cities(municipality_code),
  network TEXT NOT NULL CHECK(network IN ('Instagram','YouTube','Spotify')),
  metric_type TEXT NOT NULL CHECK(metric_type IN ('followers','viewers','engaged_audience','views','watch_minutes','listeners')),
  percentage REAL CHECK(percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  estimated_value INTEGER CHECK(estimated_value IS NULL OR estimated_value >= 0),
  is_official INTEGER NOT NULL DEFAULT 0 CHECK(is_official IN (0,1)),
  source TEXT NOT NULL CHECK(length(trim(source)) > 0),
  observed_on TEXT NOT NULL CHECK(observed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;

CREATE TABLE event_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  municipality_code TEXT NOT NULL REFERENCES event_cities(municipality_code),
  venue_name TEXT NOT NULL CHECK(length(trim(venue_name)) > 0),
  session_date TEXT NOT NULL CHECK(session_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  venue_capacity INTEGER CHECK(venue_capacity IS NULL OR venue_capacity > 0),
  tickets_released INTEGER CHECK(tickets_released IS NULL OR tickets_released >= 0),
  tickets_sold INTEGER CHECK(tickets_sold IS NULL OR tickets_sold >= 0),
  event_status TEXT NOT NULL DEFAULT 'scheduled' CHECK(event_status IN ('scheduled','on_sale','batch_closed','sold_out','extra_session','completed','cancelled')),
  sales_signal TEXT,
  source TEXT NOT NULL CHECK(length(trim(source)) > 0),
  observed_on TEXT NOT NULL CHECK(observed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK(tickets_sold IS NULL OR tickets_released IS NULL OR tickets_sold <= tickets_released)
) STRICT;

CREATE TABLE collection_budgets (
  network TEXT NOT NULL CHECK(network IN ('Instagram','YouTube','Spotify')),
  window_key TEXT NOT NULL,
  used_calls INTEGER NOT NULL DEFAULT 0 CHECK(used_calls >= 0),
  limit_calls INTEGER NOT NULL CHECK(limit_calls > 0),
  resume_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(network, window_key)
) STRICT;
