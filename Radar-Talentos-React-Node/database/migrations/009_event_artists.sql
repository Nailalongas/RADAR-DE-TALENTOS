CREATE TABLE event_listing_artists(
 platform_id TEXT NOT NULL, external_id TEXT NOT NULL, artist_key TEXT NOT NULL, name TEXT NOT NULL,
 origin TEXT NOT NULL CHECK(origin IN ('source','reviewed')), source_ref TEXT NOT NULL, source_artist_id TEXT,
 PRIMARY KEY(platform_id,external_id,artist_key,origin),
 FOREIGN KEY(platform_id,external_id) REFERENCES event_listings(platform_id,external_id) ON DELETE CASCADE
) STRICT;
CREATE INDEX event_artist_key ON event_listing_artists(artist_key);
CREATE TABLE event_listing_conflicts(
 platform_id TEXT NOT NULL,external_id TEXT NOT NULL, proposed_id TEXT NOT NULL, observed_on TEXT NOT NULL,
 proposed_title TEXT NOT NULL, municipality_code TEXT NOT NULL, venue TEXT NOT NULL,event_date TEXT NOT NULL,
 PRIMARY KEY(platform_id,external_id,proposed_id),
 FOREIGN KEY(platform_id,external_id) REFERENCES event_listings(platform_id,external_id)
) STRICT;
CREATE TABLE event_listing_revisions(id INTEGER PRIMARY KEY,platform_id TEXT NOT NULL,external_id TEXT NOT NULL,old_event_id TEXT NOT NULL,new_event_id TEXT NOT NULL,observed_on TEXT NOT NULL,source_ref TEXT NOT NULL, FOREIGN KEY(platform_id,external_id) REFERENCES event_listings(platform_id,external_id), FOREIGN KEY(old_event_id) REFERENCES events(id), FOREIGN KEY(new_event_id) REFERENCES events(id)) STRICT;
CREATE INDEX IF NOT EXISTS event_radar_date ON events(event_date);
