# Fase 1 e Evoluções — Geografia Nacional Completa (5.571 Municípios), Malha Cartográfica, Modalidades e Rankings

Entrega consolidada integrando:
- Os 5.571 municípios oficiais do Brasil com coordenadas WGS84 (`src/domain/municipios-data.json` e tabelas `municipalities` + `geo_municipalities`).
- Malha territorial oficial das 27 UFs em GeoJSON (`src/domain/uf-malha.json`), com zoom interativo (`1x`, `2x`, `4x` e foco no raio) e mapa coroplético no módulo `GeoAudienceRadar.jsx`.
- 12 modalidades e 66 submodalidades de eventos (`modalities` / `event_modalities`).
- 10 plataformas de ingressos (`event_sources`), deduplicação canônica multi-plataforma (`events` / `event_listings`) e Matriz de Oportunidades Comerciais (4 quadrantes).

## Executar
Node >=22.12. Na pasta `Radar-Talentos-React-Node`:

```sh
npm install
npm run db:init
npm test
npm run dev
```

Em outro terminal: `npm run dev:web`. Para produção local: `npm run build` e `npm start`.

## Carregar / Atualizar Base Oficial de Municípios
O comando `npm run db:init` já carrega automaticamente os 5.571 municípios oficiais com suas coordenadas WGS84 quando o banco é inicializado. Também é possível recarregar explicitamente com:

```sh
npm run radar:import -- seed-municipalities 2026-11-17
```

Ou importar arquivos JSON externos:
- `npm run radar:import -- municipalities municipios.json 2026-11-17`
- `npm run radar:import -- coordinates coordenadas.json`
- `npm run radar:import -- classifications classificacoes.json`
- `npm run radar:import -- audience audiencia.json`
