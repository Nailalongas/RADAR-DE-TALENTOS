CREATE TABLE municipalities (
 code TEXT PRIMARY KEY CHECK(length(code)=7 AND code NOT GLOB '*[^0-9]*'),
 name TEXT NOT NULL, uf TEXT NOT NULL CHECK(length(uf)=2),
 region TEXT NOT NULL CHECK(region IN ('Norte','Nordeste','Centro-Oeste','Sudeste','Sul')),
 lat REAL CHECK(lat BETWEEN -90 AND 90), lon REAL CHECK(lon BETWEEN -180 AND 180),
 source TEXT NOT NULL, version TEXT NOT NULL, coordinate_source TEXT, coordinate_version TEXT, CHECK((lat IS NULL)=(lon IS NULL))
) STRICT;
CREATE INDEX municipalities_uf ON municipalities(uf,name);
CREATE TABLE modalities (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE) STRICT;
CREATE TABLE submodalities (id INTEGER PRIMARY KEY, modality_id TEXT NOT NULL REFERENCES modalities(id), name TEXT NOT NULL, UNIQUE(modality_id,name), UNIQUE(id,modality_id)) STRICT;
CREATE TABLE talent_modalities (talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE, modality_id TEXT NOT NULL REFERENCES modalities(id), PRIMARY KEY(talent_id,modality_id)) STRICT;
CREATE TABLE talent_submodalities (talent_id TEXT NOT NULL, modality_id TEXT NOT NULL, submodality_id INTEGER NOT NULL, PRIMARY KEY(talent_id,submodality_id), FOREIGN KEY(talent_id,modality_id) REFERENCES talent_modalities(talent_id,modality_id) ON DELETE CASCADE, FOREIGN KEY(submodality_id,modality_id) REFERENCES submodalities(id,modality_id)) STRICT;
CREATE TABLE regional_metrics (network TEXT NOT NULL, metric TEXT NOT NULL, PRIMARY KEY(network,metric)) STRICT;
INSERT INTO regional_metrics VALUES ('Instagram','followers'),('Instagram','reach'),('Instagram','views'),('YouTube','views'),('YouTube','subscribers'),('Spotify','listeners'),('Spotify','streams');
CREATE TABLE regional_audience (
 talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
 network TEXT NOT NULL, metric TEXT NOT NULL, municipality_code TEXT NOT NULL REFERENCES municipalities(code),
 period_start TEXT NOT NULL CHECK(date(period_start,'+0 days') IS period_start), period_end TEXT NOT NULL CHECK(date(period_end,'+0 days') IS period_end AND period_end>=period_start),
 value INTEGER NOT NULL CHECK(value>=0), source TEXT NOT NULL CHECK(length(trim(source))>0), report_ref TEXT NOT NULL CHECK(length(trim(report_ref))>0),
 quality TEXT NOT NULL CHECK(quality IN ('verified','estimated')), collected_at TEXT NOT NULL,
 PRIMARY KEY(talent_id,network,metric,municipality_code,period_start,period_end,source), FOREIGN KEY(network,metric) REFERENCES regional_metrics(network,metric)
) STRICT;
CREATE INDEX regional_lookup ON regional_audience(network,metric,period_start,period_end,municipality_code);
INSERT INTO modalities VALUES ('shows','Shows e música');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Sertanejo');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Rock');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Pop');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Rap/hip-hop');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Funk');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Pagode');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Samba');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','MPB');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Gospel');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Jazz/blues');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Eletrônico');
INSERT INTO submodalities(modality_id,name) VALUES ('shows','Forró');
INSERT INTO modalities VALUES ('teatro','Teatro e espetáculos');
INSERT INTO submodalities(modality_id,name) VALUES ('teatro','Comédia');
INSERT INTO submodalities(modality_id,name) VALUES ('teatro','Drama');
INSERT INTO submodalities(modality_id,name) VALUES ('teatro','Musical');
INSERT INTO submodalities(modality_id,name) VALUES ('teatro','Dança');
INSERT INTO submodalities(modality_id,name) VALUES ('teatro','Ópera');
INSERT INTO submodalities(modality_id,name) VALUES ('teatro','Ballet');
INSERT INTO submodalities(modality_id,name) VALUES ('teatro','Circo');
INSERT INTO submodalities(modality_id,name) VALUES ('teatro','Artes cênicas');
INSERT INTO modalities VALUES ('humor','Humor');
INSERT INTO submodalities(modality_id,name) VALUES ('humor','Stand-up');
INSERT INTO submodalities(modality_id,name) VALUES ('humor','Improvisação');
INSERT INTO submodalities(modality_id,name) VALUES ('humor','Shows humorísticos');
INSERT INTO modalities VALUES ('palestras','Palestras e educação');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Liderança');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Vendas');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Negócios');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Finanças');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Saúde');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Tecnologia');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Desenvolvimento pessoal');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Workshops');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Cursos');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Imersões');
INSERT INTO submodalities(modality_id,name) VALUES ('palestras','Congressos');
INSERT INTO modalities VALUES ('corridas','Corridas');
INSERT INTO submodalities(modality_id,name) VALUES ('corridas','5 km');
INSERT INTO submodalities(modality_id,name) VALUES ('corridas','10 km');
INSERT INTO submodalities(modality_id,name) VALUES ('corridas','Meia maratona');
INSERT INTO submodalities(modality_id,name) VALUES ('corridas','Maratona');
INSERT INTO submodalities(modality_id,name) VALUES ('corridas','Trail run');
INSERT INTO submodalities(modality_id,name) VALUES ('corridas','Corrida infantil');
INSERT INTO modalities VALUES ('esportes','Esportes');
INSERT INTO submodalities(modality_id,name) VALUES ('esportes','Ciclismo');
INSERT INTO submodalities(modality_id,name) VALUES ('esportes','Triatlo');
INSERT INTO submodalities(modality_id,name) VALUES ('esportes','Lutas');
INSERT INTO submodalities(modality_id,name) VALUES ('esportes','Futebol');
INSERT INTO submodalities(modality_id,name) VALUES ('esportes','Competições');
INSERT INTO modalities VALUES ('festivais','Festas e festivais');
INSERT INTO submodalities(modality_id,name) VALUES ('festivais','Festivais musicais');
INSERT INTO submodalities(modality_id,name) VALUES ('festivais','Festivais culturais');
INSERT INTO submodalities(modality_id,name) VALUES ('festivais','Festas temáticas');
INSERT INTO submodalities(modality_id,name) VALUES ('festivais','Festas tradicionais');
INSERT INTO modalities VALUES ('infantil','Infantil e família');
INSERT INTO submodalities(modality_id,name) VALUES ('infantil','Personagens');
INSERT INTO submodalities(modality_id,name) VALUES ('infantil','Espetáculos');
INSERT INTO submodalities(modality_id,name) VALUES ('infantil','Parques');
INSERT INTO submodalities(modality_id,name) VALUES ('infantil','Experiências');
INSERT INTO submodalities(modality_id,name) VALUES ('infantil','Eventos infantis');
INSERT INTO modalities VALUES ('gastronomia','Gastronomia');
INSERT INTO submodalities(modality_id,name) VALUES ('gastronomia','Festivais');
INSERT INTO submodalities(modality_id,name) VALUES ('gastronomia','Cerveja');
INSERT INTO submodalities(modality_id,name) VALUES ('gastronomia','Vinho');
INSERT INTO submodalities(modality_id,name) VALUES ('gastronomia','Degustações');
INSERT INTO submodalities(modality_id,name) VALUES ('gastronomia','Experiências gastronômicas');
INSERT INTO modalities VALUES ('feiras','Feiras e exposições');
INSERT INTO submodalities(modality_id,name) VALUES ('feiras','Negócios');
INSERT INTO submodalities(modality_id,name) VALUES ('feiras','Tecnologia');
INSERT INTO submodalities(modality_id,name) VALUES ('feiras','Geek');
INSERT INTO submodalities(modality_id,name) VALUES ('feiras','Automóveis');
INSERT INTO submodalities(modality_id,name) VALUES ('feiras','Cultura');
INSERT INTO submodalities(modality_id,name) VALUES ('feiras','Convenções');
INSERT INTO modalities VALUES ('experiencias','Experiências e turismo');
INSERT INTO submodalities(modality_id,name) VALUES ('experiencias','Imersões');
INSERT INTO submodalities(modality_id,name) VALUES ('experiencias','Exposições interativas');
INSERT INTO submodalities(modality_id,name) VALUES ('experiencias','Passeios');
INSERT INTO submodalities(modality_id,name) VALUES ('experiencias','Atrações com ingresso');
INSERT INTO modalities VALUES ('outros','Outros / não classificado');
INSERT INTO submodalities(modality_id,name) VALUES ('outros','Em revisão');
INSERT OR IGNORE INTO talent_modalities SELECT talent_id,'shows' FROM talent_categories JOIN categories ON categories.id=category_id WHERE name='Cantores';
INSERT OR IGNORE INTO talent_modalities SELECT talent_id,'palestras' FROM talent_categories JOIN categories ON categories.id=category_id WHERE name='Palestrantes';
INSERT OR IGNORE INTO talent_modalities SELECT talent_id,'humor' FROM talent_categories JOIN categories ON categories.id=category_id WHERE name='Humoristas';
INSERT OR IGNORE INTO talent_modalities SELECT talent_id,'teatro' FROM talent_categories JOIN categories ON categories.id=category_id WHERE name='Peças de teatro e musicais';
INSERT OR IGNORE INTO talent_modalities SELECT talent_id,'infantil' FROM talent_categories JOIN categories ON categories.id=category_id WHERE name='Infantil e família';
INSERT OR IGNORE INTO talent_modalities SELECT talent_id,'gastronomia' FROM talent_categories JOIN categories ON categories.id=category_id WHERE name='Gastronomia';
