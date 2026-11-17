# Fase 5 — Radar de oportunidades

## Escopo
Cruza o Radar geográfico com o catálogo de anúncios de eventos por modalidade/submodalidade, município, UF, região, raio em linha reta e período. Uma consulta usa uma rede, métrica, fonte, qualidade e período exato de audiência; não soma plataformas incompatíveis. O período de eventos pode ser distinto (por exemplo, audiência histórica versus agenda futura). Escolha primeira detecção, publicação informada ou realização. A interface mostra ranking de municípios, mapa de índices (estado = maior índice municipal), ranking de talentos e exportação CSV dos municípios. Compare modalidades executando recortes separados; não compare scores de consultas diferentes como se fossem absolutos.

## Instalação
Faça backup consistente do SQLite antes de atualizar (incluindo WAL se aplicável; preferir backup SQLite com sistema parado). Preserve o banco de produção fora do ZIP. Node >= 22.12, npm install, npm run db:init, npm test, npm run build, npm run dev; em outro terminal npm run dev:web. Se necessário, execute npm run geo:sync -- 2025 e os importadores de eventos e audiência das fases anteriores. A rota nova é servida pelo Node local, não pelo health check da Vercel.

## Cobertura de eventos
Uma importação não prova cobertura de todos os municípios. A migração 007 cria event_coverage. Declare cobertura apenas quando houver evidência de que o catálogo autorizado foi consultado integralmente para todas as modalidades daquele município, plataforma, base temporal e intervalo exato, inclusive se zero resultados. Não use um lote parcial como evidência. O importador exige ao menos uma importação registrada para a plataforma, mas não valida a evidência contra a fonte externa; essa declaração é responsabilidade do operador. Não há coleta automática nesta fase.

Formato de cobertura.json (exemplo de estrutura, não declaração real):
```json
[{"platform":"sympla","city":"4106902","start":"2026-10-01","end":"2026-10-31","basis":"first_seen","evidence":"REFERÊNCIA REAL DO RELATÓRIO COMPLETO"}]
```
Execute `npm run events:coverage -- cobertura.json`. Se todas as plataformas forem selecionadas, são exigidas declarações das dez fontes no mesmo recorte; para iniciar, selecione uma fonte com cobertura conhecida. Reimportação da mesma chave atualiza evidência. A ausência de declaração deixa oferta zero como nula e score indisponível, mesmo se houver alguns anúncios observados. Revise a cobertura caso a fonte ou o catálogo mude. Eventos são anúncios observados, inclusive cancelados quando publicados; não equivalem a venda, demanda ou agenda ativa. A deduplicação herdada é exata por título, município, local e data.

## API
GET /api/opportunities?modality=shows&network=YouTube&metric=views&start=2026-10-01&end=2026-10-31&source=FONTE&quality=verified&eventStart=2026-10-01&eventEnd=2026-10-31&platform=sympla&basis=first_seen
Filtros opcionais: submodality, region, uf, city, center, radius. Modalidade obrigatória. A API retorna rows (praças), artists, places, byState, byRegion, origin, radius, scored e notice. Sem registro de audiência, valor nulo. Com oferta observada parcial, retorna contagem observada mas não score. Só municípios com audiência e cobertura declarada completa das fontes escolhidas entram na normalização.

## Índice exploratório v1
A = audiência municipal / maior audiência comparável no recorte.
O = eventos municipais / maior oferta comparável (zero se todas as ofertas são zero).
Score = arredondar(100 × A × (1 − 0,5 × O)). Sem audiência positiva ou sem comparação (uma praça com oferta zero), índice indisponível. Sinais qualitativos usam limiar de 0,5 em A e O. Pesos e limiares são hipóteses não calibradas e não representam probabilidade de vendas. A soma entre talentos não representa pessoas únicas. O ranking dos talentos é a média dos scores municipais ponderada pela audiência do talento nas cidades pontuadas, com a porcentagem de audiência conhecida que entrou no cálculo. Não é medida individual de conversão nem de competição direta. Estados/regiões usam o máximo municipal, não soma de scores. Municípios sem observações em ambas as bases não aparecem. Dados estimados só entram quando explicitamente selecionados. Não há ponderação por população, capacidade de casas, sazonalidade ou receita nesta versão.

## Validação
Novos testes usam SQLite em memória e fixtures: ausência de cobertura, oferta observada parcial, ranking, filtros de raio, cobertura de todas as plataformas, integridade e endpoint HTTP. Testes do legado e integrações externas não executados nesta etapa. Autenticação/produção, importação geográfica real, conectores automáticos e validação visual continuam pendentes. O CSV exporta o recorte retornado e neutraliza prefixos comuns de fórmula.
