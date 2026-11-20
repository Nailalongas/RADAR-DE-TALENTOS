INSERT INTO regional_metrics VALUES ('TikTok','views'),('TikTok','reach'),('TikTok','followers');
CREATE TABLE regional_report_authorizations (
 talent_id TEXT NOT NULL REFERENCES talents(id), network TEXT NOT NULL, metric TEXT NOT NULL,
 period_start TEXT NOT NULL, period_end TEXT NOT NULL, source TEXT NOT NULL, report_ref TEXT NOT NULL,
 authorization_ref TEXT NOT NULL CHECK(length(trim(authorization_ref))>0),
 coverage TEXT NOT NULL CHECK(coverage IN ('partial','complete')),
 PRIMARY KEY(talent_id,network,metric,period_start,period_end,source), FOREIGN KEY(network,metric) REFERENCES regional_metrics(network,metric)
) STRICT;
