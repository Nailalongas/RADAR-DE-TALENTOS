-- Fase 1, 2 e 3: Base geografica nacional (IBGE), Modalidades e Submodalidades de Eventos,
-- Snapshots de Audiencia Regional, 10 Plataformas de Ingressos, Eventos Canonicos e Anuncios.

CREATE TABLE geo_regions (
  code TEXT PRIMARY KEY NOT NULL CHECK(code IN ('N','NE','CO','SE','S')),
  name TEXT NOT NULL UNIQUE
) STRICT;

INSERT INTO geo_regions(code, name) VALUES
  ('N', 'Norte'),
  ('NE', 'Nordeste'),
  ('CO', 'Centro-Oeste'),
  ('SE', 'Sudeste'),
  ('S', 'Sul');

CREATE TABLE geo_states (
  uf TEXT PRIMARY KEY NOT NULL CHECK(length(uf) = 2),
  ibge_code INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  region_code TEXT NOT NULL REFERENCES geo_regions(code),
  latitude REAL NOT NULL CHECK(latitude BETWEEN -35.0 AND 6.0),
  longitude REAL NOT NULL CHECK(longitude BETWEEN -75.0 AND -28.0)
) STRICT;

INSERT INTO geo_states(uf, ibge_code, name, region_code, latitude, longitude) VALUES
  ('AC', 12, 'Acre', 'N', -9.9754, -67.8249),
  ('AL', 27, 'Alagoas', 'NE', -9.6498, -35.7089),
  ('AM', 13, 'Amazonas', 'N', -3.1190, -60.0217),
  ('AP', 16, 'Amapá', 'N', 0.0349, -51.0694),
  ('BA', 29, 'Bahia', 'NE', -12.9777, -38.5016),
  ('CE', 23, 'Ceará', 'NE', -3.7319, -38.5267),
  ('DF', 53, 'Distrito Federal', 'CO', -15.7975, -47.8919),
  ('ES', 32, 'Espírito Santo', 'SE', -20.3155, -40.3128),
  ('GO', 52, 'Goiás', 'CO', -16.6869, -49.2648),
  ('MA', 21, 'Maranhão', 'NE', -2.5307, -44.3068),
  ('MG', 31, 'Minas Gerais', 'SE', -19.9167, -43.9345),
  ('MS', 50, 'Mato Grosso do Sul', 'CO', -20.4697, -54.6201),
  ('MT', 51, 'Mato Grosso', 'CO', -15.6014, -56.0979),
  ('PA', 15, 'Pará', 'N', -1.4558, -48.4902),
  ('PB', 25, 'Paraíba', 'NE', -7.1195, -34.8450),
  ('PE', 26, 'Pernambuco', 'NE', -8.0476, -34.8770),
  ('PI', 22, 'Piauí', 'NE', -5.0892, -42.8016),
  ('PR', 41, 'Paraná', 'S', -25.4284, -49.2733),
  ('RJ', 33, 'Rio de Janeiro', 'SE', -22.9068, -43.1729),
  ('RN', 24, 'Rio Grande do Norte', 'NE', -5.7945, -35.2110),
  ('RO', 11, 'Rondônia', 'N', -8.7612, -63.9004),
  ('RR', 14, 'Roraima', 'N', 2.8235, -60.6758),
  ('RS', 43, 'Rio Grande do Sul', 'S', -30.0346, -51.2177),
  ('SC', 42, 'Santa Catarina', 'S', -27.5954, -48.5480),
  ('SE', 28, 'Sergipe', 'NE', -10.9472, -37.0731),
  ('SP', 35, 'São Paulo', 'SE', -23.5505, -46.6333),
  ('TO', 17, 'Tocantins', 'N', -10.1753, -48.2982);

CREATE TABLE geo_municipalities (
  ibge_code TEXT PRIMARY KEY NOT NULL CHECK(ibge_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  uf TEXT NOT NULL REFERENCES geo_states(uf),
  latitude REAL NOT NULL CHECK(latitude BETWEEN -35.0 AND 6.0),
  longitude REAL NOT NULL CHECK(longitude BETWEEN -75.0 AND -28.0),
  population INTEGER CHECK(population IS NULL OR population >= 0),
  gdp_per_capita REAL CHECK(gdp_per_capita IS NULL OR gdp_per_capita >= 0),
  source_version TEXT NOT NULL DEFAULT 'IBGE Censo 2022'
) STRICT;

CREATE INDEX idx_geo_municipalities_uf ON geo_municipalities(uf);
CREATE INDEX idx_geo_municipalities_name ON geo_municipalities(name);

INSERT INTO geo_municipalities(ibge_code, name, uf, latitude, longitude, population, gdp_per_capita) VALUES
  -- Sul (PR, SC, RS) + eixo Curitiba para filtro por raio em km
  ('4106902', 'Curitiba', 'PR', -25.4284, -49.2733, 1773718, 67691.30),
  ('4125506', 'São José dos Pinhais', 'PR', -25.5304, -49.2083, 329628, 84512.00),
  ('4105805', 'Colombo', 'PR', -25.2925, -49.2262, 232212, 29450.00),
  ('4119152', 'Pinhais', 'PR', -25.4429, -49.1927, 127019, 64210.00),
  ('4101804', 'Araucária', 'PR', -25.5859, -49.4047, 151666, 171200.00),
  ('4104204', 'Campo Largo', 'PR', -25.4595, -49.5290, 136327, 45120.00),
  ('4118204', 'Paranaguá', 'PR', -25.5205, -48.5095, 145829, 89300.00),
  ('4119905', 'Ponta Grossa', 'PR', -25.0945, -50.1633, 358371, 56890.00),
  ('4113700', 'Londrina', 'PR', -23.3103, -51.1628, 555965, 44120.00),
  ('4115200', 'Maringá', 'PR', -23.4210, -51.9331, 409657, 53840.00),
  ('4104808', 'Cascavel', 'PR', -24.9578, -53.4595, 348051, 48750.00),
  ('4108304', 'Foz do Iguaçu', 'PR', -25.5469, -54.5882, 285415, 61200.00),
  ('4209102', 'Joinville', 'SC', -26.3044, -48.8487, 616317, 73450.00),
  ('4202404', 'Blumenau', 'SC', -26.9194, -49.0661, 361261, 63800.00),
  ('4208203', 'Itajaí', 'SC', -26.9078, -48.6619, 264054, 138400.00),
  ('4202008', 'Balneário Camboriú', 'SC', -26.9906, -48.6348, 139155, 52100.00),
  ('4205407', 'Florianópolis', 'SC', -27.5954, -48.5480, 537211, 48900.00),
  ('4204202', 'Chapecó', 'SC', -27.1004, -52.6152, 254785, 59300.00),
  ('4204608', 'Criciúma', 'SC', -28.6775, -49.3697, 214493, 47200.00),
  ('4314902', 'Porto Alegre', 'RS', -30.0346, -51.2177, 1332845, 78586.94),
  ('4305108', 'Caxias do Sul', 'RS', -29.1678, -51.1794, 463501, 68120.00),
  ('4309308', 'Gramado', 'RS', -29.3746, -50.8764, 40134, 74500.00),
  ('4314407', 'Pelotas', 'RS', -31.7654, -52.3376, 325685, 34200.00),
  ('4316907', 'Santa Maria', 'RS', -29.6842, -53.8069, 271735, 36900.00),
  -- Sudeste (SP, RJ, MG, ES)
  ('3550308', 'São Paulo', 'SP', -23.5505, -46.6333, 11451999, 93156.23),
  ('3509502', 'Campinas', 'SP', -22.9056, -47.0608, 1139047, 65400.00),
  ('3548500', 'Santos', 'SP', -23.9608, -46.3336, 418608, 69800.00),
  ('3543402', 'Ribeirão Preto', 'SP', -21.1775, -47.8103, 698642, 58200.00),
  ('3549904', 'São José dos Campos', 'SP', -23.1791, -45.8872, 697054, 67300.00),
  ('3552205', 'Sorocaba', 'SP', -23.5015, -47.4526, 723682, 62100.00),
  ('3304557', 'Rio de Janeiro', 'RJ', -22.9068, -43.1729, 6211223, 59400.00),
  ('3303302', 'Niterói', 'RJ', -22.8832, -43.1034, 481749, 108400.00),
  ('3106200', 'Belo Horizonte', 'MG', -19.9167, -43.9345, 2315560, 46800.00),
  ('3170206', 'Uberlândia', 'MG', -18.9186, -48.2772, 713224, 61900.00),
  ('3136702', 'Juiz de Fora', 'MG', -21.7642, -43.3503, 540756, 36400.00),
  ('3205309', 'Vitória', 'ES', -20.3155, -40.3128, 322869, 96500.00),
  ('3205200', 'Vila Velha', 'ES', -20.3297, -40.2925, 467722, 34900.00),
  -- Centro-Oeste (DF, GO, MT, MS)
  ('5300108', 'Brasília', 'DF', -15.7975, -47.8919, 2817381, 98600.00),
  ('5208707', 'Goiânia', 'GO', -16.6869, -49.2648, 1437366, 42900.00),
  ('5103403', 'Cuiabá', 'MT', -15.6014, -56.0979, 650877, 49300.00),
  ('5002704', 'Campo Grande', 'MS', -20.4697, -54.6201, 898100, 40200.00),
  -- Nordeste (BA, PE, CE, RN, PB, AL, SE, MA, PI)
  ('2927408', 'Salvador', 'BA', -12.9777, -38.5016, 2417678, 27400.00),
  ('2611606', 'Recife', 'PE', -8.0476, -34.8770, 1488920, 38900.00),
  ('2304400', 'Fortaleza', 'CE', -3.7319, -38.5267, 2428708, 30100.00),
  ('2408102', 'Natal', 'RN', -5.7945, -35.2110, 751300, 33200.00),
  ('2507507', 'João Pessoa', 'PB', -7.1195, -34.8450, 833932, 28600.00),
  ('2704302', 'Maceió', 'AL', -9.6498, -35.7089, 957916, 29100.00),
  ('2800308', 'Aracaju', 'SE', -10.9472, -37.0731, 602757, 32400.00),
  ('2111300', 'São Luís', 'MA', -2.5307, -44.3068, 1037775, 35700.00),
  ('2211001', 'Teresina', 'PI', -5.0892, -42.8016, 866300, 27900.00),
  -- Norte (AM, PA, TO, RO, AC, AP, RR)
  ('1302603', 'Manaus', 'AM', -3.1190, -60.0217, 2063689, 50200.00),
  ('1501402', 'Belém', 'PA', -1.4558, -48.4902, 1303403, 26800.00),
  ('1721000', 'Palmas', 'TO', -10.1753, -48.2982, 302692, 36500.00),
  ('1100205', 'Porto Velho', 'RO', -8.7612, -63.9004, 460434, 43800.00),
  ('1200401', 'Rio Branco', 'AC', -9.9754, -67.8249, 364756, 29400.00),
  ('1600303', 'Macapá', 'AP', 0.0349, -51.0694, 442933, 27100.00),
  ('1400100', 'Boa Vista', 'RR', 2.8235, -60.6758, 413486, 33600.00),
  -- Homonimos para validar desambiguacao por UF e codigo IBGE (Secao 17)
  ('2201903', 'Bom Jesus', 'PI', -9.0714, -44.3590, 28796, 38100.00),
  ('2401701', 'Bom Jesus', 'RN', -5.9864, -35.5792, 9952, 14200.00),
  ('4302303', 'Bom Jesus', 'RS', -28.6686, -50.4167, 11202, 41500.00);

-- Taxonomia de Modalidades e Submodalidades de Eventos (Secao 4)
CREATE TABLE event_modalities (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE event_submodalities (
  id TEXT PRIMARY KEY NOT NULL,
  modality_id TEXT NOT NULL REFERENCES event_modalities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(modality_id, name),
  UNIQUE(id, modality_id)
) STRICT;

CREATE TABLE talent_event_modalities (
  talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  modality_id TEXT NOT NULL REFERENCES event_modalities(id) ON DELETE CASCADE,
  submodality_id TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  PRIMARY KEY(talent_id, modality_id)
) STRICT;

INSERT INTO event_modalities(id, name, sort_order) VALUES
  ('shows-musica', 'Shows e música', 1),
  ('teatro-espetaculos', 'Teatro e espetáculos', 2),
  ('humor', 'Humor', 3),
  ('palestras-educacao', 'Palestras e educação', 4),
  ('corridas', 'Corridas', 5),
  ('esportes', 'Esportes', 6),
  ('festas-festivais', 'Festas e festivais', 7),
  ('infantil-familia', 'Infantil e família', 8),
  ('gastronomia', 'Gastronomia', 9),
  ('feiras-exposicoes', 'Feiras e exposições', 10),
  ('experiencias-turismo', 'Experiências e turismo', 11),
  ('outros', 'Outros / não classificado', 12);

INSERT INTO event_submodalities(id, modality_id, name) VALUES
  ('shows-musica:sertanejo', 'shows-musica', 'Sertanejo'),
  ('shows-musica:rock', 'shows-musica', 'Rock'),
  ('shows-musica:pop', 'shows-musica', 'Pop'),
  ('shows-musica:rap-hip-hop', 'shows-musica', 'Rap/Hip-hop'),
  ('shows-musica:funk', 'shows-musica', 'Funk'),
  ('shows-musica:pagode', 'shows-musica', 'Pagode'),
  ('shows-musica:samba', 'shows-musica', 'Samba'),
  ('shows-musica:mpb', 'shows-musica', 'MPB'),
  ('shows-musica:gospel', 'shows-musica', 'Gospel'),
  ('shows-musica:jazz-blues', 'shows-musica', 'Jazz/Blues'),
  ('shows-musica:eletronico', 'shows-musica', 'Eletrônico'),
  ('shows-musica:forro', 'shows-musica', 'Forró'),
  ('shows-musica:outros', 'shows-musica', 'Outros'),
  ('teatro-espetaculos:comedia', 'teatro-espetaculos', 'Comédia'),
  ('teatro-espetaculos:drama', 'teatro-espetaculos', 'Drama'),
  ('teatro-espetaculos:musical', 'teatro-espetaculos', 'Musical'),
  ('teatro-espetaculos:danca', 'teatro-espetaculos', 'Dança'),
  ('teatro-espetaculos:opera', 'teatro-espetaculos', 'Ópera'),
  ('teatro-espetaculos:ballet', 'teatro-espetaculos', 'Ballet'),
  ('teatro-espetaculos:circo', 'teatro-espetaculos', 'Circo'),
  ('teatro-espetaculos:artes-cenicas', 'teatro-espetaculos', 'Artes cênicas'),
  ('humor:stand-up', 'humor', 'Stand-up'),
  ('humor:improvisacao', 'humor', 'Improvisação'),
  ('humor:shows-humoristicos', 'humor', 'Shows humorísticos'),
  ('palestras-educacao:lideranca', 'palestras-educacao', 'Liderança'),
  ('palestras-educacao:vendas', 'palestras-educacao', 'Vendas'),
  ('palestras-educacao:negocios', 'palestras-educacao', 'Negócios'),
  ('palestras-educacao:financas', 'palestras-educacao', 'Finanças'),
  ('palestras-educacao:saude', 'palestras-educacao', 'Saúde'),
  ('palestras-educacao:tecnologia', 'palestras-educacao', 'Tecnologia'),
  ('palestras-educacao:desenvolvimento-pessoal', 'palestras-educacao', 'Desenvolvimento pessoal'),
  ('palestras-educacao:workshops', 'palestras-educacao', 'Workshops'),
  ('palestras-educacao:cursos', 'palestras-educacao', 'Cursos'),
  ('palestras-educacao:imersoes', 'palestras-educacao', 'Imersões'),
  ('palestras-educacao:congressos', 'palestras-educacao', 'Congressos'),
  ('corridas:5km', 'corridas', '5 km'),
  ('corridas:10km', 'corridas', '10 km'),
  ('corridas:meia-maratona', 'corridas', 'Meia maratona'),
  ('corridas:maratona', 'corridas', 'Maratona'),
  ('corridas:trail-run', 'corridas', 'Trail run'),
  ('corridas:corrida-infantil', 'corridas', 'Corrida infantil'),
  ('corridas:outras-distancias', 'corridas', 'Outras distâncias'),
  ('esportes:ciclismo', 'esportes', 'Ciclismo'),
  ('esportes:triatlo', 'esportes', 'Triatlo'),
  ('esportes:lutas', 'esportes', 'Lutas'),
  ('esportes:futebol', 'esportes', 'Futebol'),
  ('esportes:competicoes', 'esportes', 'Competições'),
  ('esportes:outros', 'esportes', 'Outros'),
  ('festas-festivais:festivais-musicais', 'festas-festivais', 'Festivais musicais'),
  ('festas-festivais:culturais', 'festas-festivais', 'Culturais'),
  ('festas-festivais:festas-tematicas', 'festas-festivais', 'Festas temáticas'),
  ('festas-festivais:festas-tradicionais', 'festas-festivais', 'Festas tradicionais'),
  ('infantil-familia:personagens', 'infantil-familia', 'Personagens'),
  ('infantil-familia:espetaculos', 'infantil-familia', 'Espetáculos'),
  ('infantil-familia:parques', 'infantil-familia', 'Parques'),
  ('infantil-familia:experiencias', 'infantil-familia', 'Experiências'),
  ('infantil-familia:eventos-infantis', 'infantil-familia', 'Eventos infantis'),
  ('gastronomia:festivais', 'gastronomia', 'Festivais'),
  ('gastronomia:cerveja', 'gastronomia', 'Cerveja'),
  ('gastronomia:vinho', 'gastronomia', 'Vinho'),
  ('gastronomia:degustacoes', 'gastronomia', 'Degustações'),
  ('gastronomia:experiencias-gastronomicas', 'gastronomia', 'Experiências gastronômicas'),
  ('feiras-exposicoes:negocios', 'feiras-exposicoes', 'Negócios'),
  ('feiras-exposicoes:tecnologia', 'feiras-exposicoes', 'Tecnologia'),
  ('feiras-exposicoes:geek', 'feiras-exposicoes', 'Geek'),
  ('feiras-exposicoes:automoveis', 'feiras-exposicoes', 'Automóveis'),
  ('feiras-exposicoes:cultura', 'feiras-exposicoes', 'Cultura'),
  ('feiras-exposicoes:convencoes', 'feiras-exposicoes', 'Convenções'),
  ('experiencias-turismo:imersoes', 'experiencias-turismo', 'Imersões'),
  ('experiencias-turismo:exposicoes-interativas', 'experiencias-turismo', 'Exposições interativas'),
  ('experiencias-turismo:passeios', 'experiencias-turismo', 'Passeios'),
  ('experiencias-turismo:atracoes-com-ingresso', 'experiencias-turismo', 'Atrações com ingresso'),
  ('outros:revisao', 'outros', 'Fila de revisão');

-- Snapshots de Audiencia Regional (Secao 5, 6 e 12)
CREATE TABLE audience_geo_snapshots (
  id INTEGER PRIMARY KEY,
  talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('Instagram','YouTube','Spotify')),
  metric TEXT NOT NULL CHECK(metric IN ('seguidores','visualizacoes','minutos_assistidos','alcance','ouvintes','reproducoes')),
  unit TEXT NOT NULL CHECK(length(trim(unit)) > 0),
  granularity TEXT NOT NULL CHECK(granularity IN ('country','region','state','municipality')),
  territory_key TEXT NOT NULL CHECK(length(trim(territory_key)) > 0),
  ibge_code TEXT REFERENCES geo_municipalities(ibge_code),
  period_start TEXT NOT NULL CHECK(period_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(period_start,'+0 days') = period_start),
  period_end TEXT NOT NULL CHECK(period_end GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(period_end,'+0 days') = period_end AND period_start <= period_end),
  value INTEGER NOT NULL CHECK(value >= 0),
  provenance TEXT NOT NULL CHECK(provenance IN ('verificado','estimado','demonstracao')),
  confidence TEXT NOT NULL DEFAULT 'alta' CHECK(confidence IN ('alta','moderada','baixa')),
  source TEXT NOT NULL CHECK(length(trim(source)) > 0),
  report_reference TEXT,
  collected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(talent_id, platform, metric, granularity, territory_key, period_start, period_end, source),
  CHECK(granularity != 'municipality' OR ibge_code IS NOT NULL)
) STRICT;

CREATE INDEX idx_audience_geo_talent ON audience_geo_snapshots(talent_id, platform, metric);
CREATE INDEX idx_audience_geo_ibge ON audience_geo_snapshots(ibge_code);

-- 10 Plataformas de Ingressos (Secao 9)
CREATE TABLE event_sources (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  segment TEXT NOT NULL,
  website_url TEXT NOT NULL CHECK(website_url LIKE 'https://%'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  integration_state TEXT NOT NULL DEFAULT 'adapter_ready' CHECK(integration_state IN ('authorized_api','public_feed','import_only','adapter_ready','disabled')),
  last_attempt_at TEXT,
  last_success_at TEXT,
  coverage_note TEXT
) STRICT;

INSERT INTO event_sources(id, name, segment, website_url, integration_state, coverage_note) VALUES
  ('sympla', 'Sympla', 'Eventos diversos', 'https://www.sympla.com.br', 'adapter_ready', 'Importação autorizada / API mediante credencial'),
  ('eventim', 'Eventim', 'Shows e espetáculos', 'https://www.eventim.com.br', 'adapter_ready', 'Importação autorizada / catálogo de shows e turnês'),
  ('ticketmaster', 'Ticketmaster', 'Grandes eventos', 'https://www.ticketmaster.com.br', 'adapter_ready', 'Importação autorizada / Discovery API mediante chave'),
  ('ingresse', 'Ingresse', 'Festivais, festas e entretenimento', 'https://www.ingresse.com', 'adapter_ready', 'Importação autorizada / eventos e festivais'),
  ('ticketsports', 'Ticket Sports', 'Corridas e esportes', 'https://www.ticketsports.com.br', 'adapter_ready', 'Importação autorizada / calendário de corridas e esportes'),
  ('ticket360', 'Ticket360', 'Shows e eventos', 'https://www.ticket360.com.br', 'adapter_ready', 'Importação autorizada / casas de shows e eventos'),
  ('blueticket', 'Blueticket', 'Entretenimento', 'https://www.blueticket.com.br', 'adapter_ready', 'Importação autorizada / entretenimento regional'),
  ('diskingressos', 'Disk Ingressos', 'Shows, teatro e humor', 'https://www.diskingressos.com.br', 'adapter_ready', 'Importação autorizada / shows, teatro e stand-up'),
  ('bilheteriadigital', 'Bilheteria Digital', 'Eventos diversos', 'https://www.bilheteriadigital.com', 'adapter_ready', 'Importação autorizada / eventos diversos'),
  ('uhuu', 'Uhuu', 'Espetáculos e entretenimento', 'https://uhuu.com', 'adapter_ready', 'Importação autorizada / teatros, musicais e arenas');

-- Eventos Canonicos Deduplicados e Anuncios por Plataforma (Secao 9)
CREATE TABLE commercial_events (
  id TEXT PRIMARY KEY NOT NULL,
  canonical_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  normalized_title TEXT NOT NULL,
  attraction_name TEXT,
  talent_id TEXT REFERENCES talents(id) ON DELETE SET NULL,
  producer_name TEXT,
  venue_name TEXT,
  ibge_code TEXT REFERENCES geo_municipalities(ibge_code),
  uf TEXT REFERENCES geo_states(uf),
  region_code TEXT REFERENCES geo_regions(code),
  latitude REAL,
  longitude REAL,
  primary_modality_id TEXT NOT NULL REFERENCES event_modalities(id),
  primary_submodality_id TEXT REFERENCES event_submodalities(id),
  classification_confidence TEXT NOT NULL DEFAULT 'alta' CHECK(classification_confidence IN ('alta','moderada','baixa')),
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK(needs_review IN (0,1)),
  delivery_mode TEXT NOT NULL DEFAULT 'presencial' CHECK(delivery_mode IN ('presencial','online','hibrido')),
  is_free INTEGER NOT NULL DEFAULT 0 CHECK(is_free IN (0,1)),
  price_min REAL CHECK(price_min IS NULL OR price_min >= 0),
  price_max REAL CHECK(price_max IS NULL OR price_max >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  event_date_start TEXT NOT NULL CHECK(event_date_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(event_date_start,'+0 days') = event_date_start),
  event_date_end TEXT CHECK(event_date_end IS NULL OR (event_date_end GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(event_date_end,'+0 days') = event_date_end AND event_date_start <= event_date_end)),
  sessions_count INTEGER NOT NULL DEFAULT 1 CHECK(sessions_count >= 1),
  first_published_at TEXT,
  first_detected_at TEXT NOT NULL CHECK(first_detected_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'),
  last_detected_at TEXT NOT NULL CHECK(last_detected_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'),
  is_initial_inventory INTEGER NOT NULL DEFAULT 0 CHECK(is_initial_inventory IN (0,1)),
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','batch_closed','extra_session','sold_out','completed','cancelled','postponed','unknown')),
  provenance TEXT NOT NULL DEFAULT 'verificado' CHECK(provenance IN ('verificado','estimado','demonstracao')),
  CHECK(price_min IS NULL OR price_max IS NULL OR price_min <= price_max)
) STRICT;

CREATE INDEX idx_commercial_events_modality ON commercial_events(primary_modality_id, primary_submodality_id);
CREATE INDEX idx_commercial_events_ibge ON commercial_events(ibge_code);
CREATE INDEX idx_commercial_events_dates ON commercial_events(event_date_start, first_detected_at);

CREATE TABLE commercial_event_listings (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES commercial_events(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES event_sources(id),
  external_id TEXT NOT NULL CHECK(length(trim(external_id)) > 0),
  url TEXT NOT NULL CHECK(url LIKE 'https://%'),
  original_title TEXT NOT NULL,
  original_category TEXT,
  published_at TEXT,
  first_detected_at TEXT NOT NULL,
  last_detected_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  UNIQUE(source_id, external_id),
  UNIQUE(source_id, url)
) STRICT;

CREATE INDEX idx_commercial_event_listings_event ON commercial_event_listings(event_id);
CREATE INDEX idx_commercial_event_listings_source ON commercial_event_listings(source_id);
