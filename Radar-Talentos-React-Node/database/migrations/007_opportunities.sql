CREATE TABLE event_coverage (
 platform_id TEXT NOT NULL REFERENCES ticket_platforms(id),
 municipality_code TEXT NOT NULL REFERENCES municipalities(code),
 period_start TEXT NOT NULL CHECK(date(period_start,'+0 days') IS period_start),
 period_end TEXT NOT NULL CHECK(date(period_end,'+0 days') IS period_end AND period_end>=period_start),
 basis TEXT NOT NULL CHECK(basis IN ('first_seen','published_on','event_date')),
 evidence TEXT NOT NULL CHECK(length(trim(evidence))>0),
 PRIMARY KEY(platform_id,municipality_code,period_start,period_end,basis)
) STRICT;
