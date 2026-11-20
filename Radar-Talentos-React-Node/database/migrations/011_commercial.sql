CREATE TABLE commercial_accounts (
 id TEXT PRIMARY KEY, talent_id TEXT NOT NULL REFERENCES talents(id), network TEXT NOT NULL CHECK(network IN ('Instagram','YouTube','Spotify','TikTok')), url TEXT NOT NULL, identity_source TEXT NOT NULL, UNIQUE(network,url)
) STRICT;
CREATE TABLE commercial_snapshots (
 account_id TEXT NOT NULL REFERENCES commercial_accounts(id), metric TEXT NOT NULL, observed_on TEXT NOT NULL, value INTEGER NOT NULL CHECK(value>=0), source TEXT NOT NULL, authorization_ref TEXT NOT NULL,
 PRIMARY KEY(account_id,metric,observed_on)
) STRICT;
CREATE INDEX commercial_lookup ON commercial_snapshots(metric,observed_on);
CREATE VIEW commercial_observations AS
 SELECT a.talent_id,a.network,a.url,s.metric,s.observed_on,s.value,s.source FROM commercial_accounts a JOIN commercial_snapshots s ON s.account_id=a.id;
