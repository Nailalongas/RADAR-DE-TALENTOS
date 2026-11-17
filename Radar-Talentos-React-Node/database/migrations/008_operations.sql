CREATE TABLE operation_jobs (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('events','audience','metrics','alerts')),
 provider TEXT NOT NULL, adapter TEXT NOT NULL, scope TEXT NOT NULL, config_hash TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE operation_runs (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES operation_jobs(id), config_hash TEXT NOT NULL,
 day TEXT NOT NULL, attempt INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('running','success','partial','empty','failed','unchanged')),
 started_at TEXT NOT NULL, finished_at TEXT, lease_until TEXT NOT NULL, retry_not_before TEXT, records INTEGER NOT NULL DEFAULT 0,
 summary TEXT NOT NULL DEFAULT '', fingerprint TEXT,
 UNIQUE(job_id,day,attempt)
) STRICT;
CREATE INDEX operation_runs_job ON operation_runs(job_id,day,attempt);
CREATE TABLE operation_alerts (
 id TEXT PRIMARY KEY, day TEXT NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL,
 message TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE INDEX operation_alerts_day ON operation_alerts(day);
-- Associação ao escopo específico da coleta; evita misturar importações manuais no alerta.
CREATE TABLE operation_event_observations (
 job_id TEXT NOT NULL REFERENCES operation_jobs(id), config_hash TEXT NOT NULL,
 event_id TEXT NOT NULL REFERENCES events(id), day TEXT NOT NULL,
 PRIMARY KEY(job_id,config_hash,event_id,day)
) STRICT;
CREATE INDEX operation_event_observations_day ON operation_event_observations(job_id,config_hash,day);
