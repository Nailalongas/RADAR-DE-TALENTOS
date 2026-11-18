# Layout geointeligência — Radar de Talentos

O layout ativo é servido diretamente pelo Node a partir de `dashboard/`. Não depende de Vite para execução.

- `style.css`: tema escuro, tokens CSS, menu lateral, indicadores, tabelas, barras, mapas e responsividade.
- `index.html`: tendências por modalidade e região das ticketeiras, catálogo, atrações e sincronização.
- `audience.html`: audiência por artista, mídia, indicador e território.
- `layout.js`: zoom, enquadramento, arraste do mapa e estado de conexão real via `/api/health`.
- `dashboard.js` e `audience-dashboard.js`: somente ajustes de cores cartográficas; preservam o fluxo de consulta.

Os estados utilizam intensidade de cor conforme o valor observado; bolhas proporcionais indicam valores municipais. O contorno tracejado representa o raio geográfico. Não é uma imagem de satélite nem uma camada de calor interpolada. A seleção territorial é por município e raio em linha reta, não por polígono arbitrário. As métricas das redes nunca são somadas. A oferta de eventos não corresponde a vendas.

## Executar

Node >=22.12. Preserve o banco existente. Execute `npm run db:init`, `npm test`, `npm run build`, `npm start`. Abra http://127.0.0.1:3000 e http://127.0.0.1:3000/audience.html. Carregue a Base Geográfica Nacional com `npm run geo:sync -- 2025` se necessário. Configure as fontes conforme os manuais anteriores.

## Publicação

O build copia os arquivos para dist; publicar dist na Vercel isoladamente não disponibiliza as APIs. Para uso real, mantenha o Node com banco persistente e worker, conforme README e compose.yaml. Não altere credenciais nem remova os históricos. O estado de conexão não comprova cobertura das fontes.

## Validação

52 testes existentes passaram; build e sintaxe JS verificados. Teste HTTP local em banco temporário retornou 200 para páginas, CSS, JS, health, relatórios e plataformas. IDs referenciados por JS e links internos conferidos. Validação visual no navegador não concluída (Chromium excedeu o tempo limite). Não foram ativadas fontes reais nem publicado o sistema remoto.
