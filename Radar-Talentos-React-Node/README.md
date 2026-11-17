# Radar de Talentos — Inteligência de Mercado para Eventos (React e Node.js)

Plataforma nacional de inteligência comercial para descoberta de talentos, concentração geográfica de audiência (Instagram, YouTube e Spotify), monitoramento de modalidades de eventos nas 10 principais plataformas de ingressos e cruzamento de oportunidades comerciais.

## Módulos Implementados

1. **Descobrir Talentos e Rankings de Crescimento**:
   - Filtros por rede (`Instagram`, `YouTube`, `Spotify`), modos de comparação (`Redes disponíveis`, `Duas redes`, `Três redes` nos últimos 7 dias), 8 categorias e 58 subcategorias/temas, período e faixa de público.
   - Agrupamento por identidade de talento (`sameTalentIdentity`, variantes de nome e duplas, rejeição de fã-clubes/covers).
   - Gráficos de evolução percentual e diária (preservando lacunas sem estimar ou inventar zeros), favoritos, arquivos de pesquisa e exportação CSV.
2. **Radar Geográfico de Audiência e Filtro por Raio (km)**:
   - Base geográfica nacional (5 macrorregiões, 27 UFs e municípios com código municipal de 7 dígitos, coordenadas WGS84, população Censo 2022 e PIB per capita).
   - Cálculo geodésico em linha reta (fórmula de Haversine, raio médio terrestre de `6.371 km`), com presets de `25` a `1.000 km` ou valor personalizado, interseção com Região/UF e desambiguação de municípios homônimos por UF e código.
   - Separação estrita de métricas por plataforma (`seguidores`, `visualizacoes`, `minutos_assistidos`, `alcance`, `ouvintes`), visão absoluta e por `100 mil habitantes`, e importação idempotente de relatórios CSV/JSON autorizados.
3. **Radar de Tendências de Eventos, 10 Plataformas de Ingressos e Oportunidades Comerciais**:
   - Taxonomia canônica de **12 modalidades** e **66 submodalidades** de eventos (`Shows e música`, `Teatro e espetáculos`, `Humor`, `Palestras e educação`, `Corridas`, `Esportes`, `Festas e festivais`, `Infantil e família`, `Gastronomia`, `Feiras e exposições`, `Experiências e turismo`, `Outros / não classificado`).
   - Cadastro e adaptadores para as **10 plataformas de ingressos** (`Sympla`, `Eventim`, `Ticketmaster`, `Ingresse`, `Ticket Sports`, `Ticket360`, `Blueticket`, `Disk Ingressos`, `Bilheteria Digital` e `Uhuu`).
   - Deduplicação canônica multi-plataforma (um mesmo evento anunciado em mais de uma plataforma conta uma única vez no ranking geral e preserva todas as origens).
   - **Matriz de Oportunidades Comerciais (4 quadrantes)**: cruzamento entre audiência regional e oferta de eventos publicados, sinalizando explicitamente municípios com cobertura insuficiente sem tratar ausência de dados como zero.

## Desenvolvimento e Execução Local

Requer **Node.js 22.12 ou superior**. Na pasta `Radar-Talentos-React-Node`:

```sh
npm install
npm run db:init
npm test
```

Para iniciar em desenvolvimento (backend na porta `3000` e Vite com proxy `/api`):

```sh
npm run dev
npm run dev:web
```

Para compilar e servir em produção local:

```sh
npm run build
npm start
```

Para executar a suíte de 21 testes de aceitação do legado:

```sh
cd legado
npm test
```

## Principais Rotas da API

- `GET /api/health` — Status do processo e conexão com o banco SQLite.
- `GET /api/taxonomy` — Categorias e subcategorias de talentos.
- `GET /api/modalities` — 12 modalidades e 66 submodalidades de eventos.
- `GET /api/geo/regions` — 5 macrorregiões brasileiras e UFs.
- `GET /api/geo/states?region=` — 27 estados com coordenadas.
- `GET /api/geo/municipalities?search=&uf=&region=` — Municípios com desambiguação.
- `GET /api/geo/radius?municipalityId=&radiusKm=&uf=&region=` — Filtro geodésico Haversine por raio em km.
- `GET /api/research?start=&end=` — Resumo compacto para descoberta de talentos.
- `GET /api/history` — Histórico completo de snapshots.
- `GET /api/evolution?personId=&name=` — Histórico isolado por talento.
- `GET /api/audience/map` e `GET /api/audience/distribution` — Concentração geográfica de audiência.
- `GET /api/events/trends`, `GET /api/events/rankings` e `GET /api/events/calendar` — Tendências de eventos publicados por modalidade, submodalidade, cidade, plataforma e mês.
- `GET /api/opportunities` — Radar de oportunidades Fase 5 (cruzamento Audiência × Oferta com controle de cobertura `event_coverage`) e Matriz de oportunidades.
- `GET /api/operations/status` — Central de gerenciamento de coletas, estado das tarefas automatizadas, últimas 50 execuções e alertas comerciais (Fase 6).
- `GET /api/sources/status` — Estado das 10 fontes de ingressos.
- `POST /api/admin/audience/import` e `POST /api/admin/events/import` — Importação autenticada via cabeçalho `Authorization: Bearer <RADAR_ADMIN_TOKEN>`.

## Documentação por Fase

- [Fase 1 — Fundação e Rankings](docs/fase-1-radar.md)
- [Fase 2 — Mapa e Sincronização Geográfica](docs/fase-2-geografia.md)
- [Fase 3 — Radar de Tendências de Eventos](docs/fase-3-eventos.md)
- [Fase 4 — Integrações de Audiência Regional](docs/fase-4-audiencia.md)
- [Fase 5 — Radar de Oportunidades](docs/fase-5-oportunidades.md) (inclui CLI `npm run events:coverage -- cobertura.json`)
- [Fase 6 — Automação, Coletas, Segurança e Produção](docs/fase-6-operacao.md) (inclui `npm run ops:check`, `npm run ops:doctor`, `npm run ops:once`, `npm run ops:worker` e `npm run db:backup`)
