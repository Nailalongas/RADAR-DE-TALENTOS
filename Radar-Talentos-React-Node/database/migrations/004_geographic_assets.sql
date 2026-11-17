CREATE TABLE geographic_assets (id TEXT PRIMARY KEY, geojson TEXT NOT NULL CHECK(json_valid(geojson)), version TEXT NOT NULL, source TEXT NOT NULL) STRICT;
