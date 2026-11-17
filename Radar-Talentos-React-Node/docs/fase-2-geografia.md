# Fase 2 — Mapa e cobertura geográfica

Preserva as migrações anteriores e o legado. A migração 004 armazena a malha estadual GeoJSON. O mapa SVG oferece zoom, camada estadual e municipal por bolhas, seleção de UF/município e contorno geodésico do raio. A consulta atualiza o ranking e os gráficos após clicar Consultar. Os valores agregados são observações conhecidas, não pessoas únicas.

## Executar (Node 22.12+)

Faça backup do banco existente. Na pasta Radar-Talentos-React-Node:

```
npm install
npm run db:init
npm run geo:sync -- 2025
npm test
npm run build
npm run dev
```

Em outro terminal: `npm run dev:web`. Use a URL do Vite. `geo:sync` consulta IBGE Localidades e Malhas v3. O ano 2025 foi escolhido como referência, podendo ser alterado para uma edição compatível. O cadastro de localidades é corrente, por isso diferenças de códigos em uma edição de malha são reportadas por UF; não são preenchidas artificialmente. O importador verifica a cobertura mínima, códigos únicos e as 27 UFs. A sincronização de coordenadas é transacional por UF; falhas deixam as demais UFs importadas e retornam código de saída não zero. O centro da caixa envolvente de cada município é aproximado, não necessariamente a sede nem o centroide. Coordenadas anteriormente importadas de outras fontes são preservadas. Para precisão de sede use o importador `radar:import -- coordinates arquivo.json` da fase anterior.

Os JSONs baixados ficam em `data/geography/<ano>` e `npm run geo:sync -- 2025 --offline` reprocessa arquivos locais. `--no-coordinates` importa somente cadastro e estados. Fontes: https://servicodados.ibge.gov.br/api/docs/malhas e https://servicodados.ibge.gov.br/api/docs/localidades .

O endpoint `/api/radar/geography` informa cobertura e malha; `/api/radar/reports` lista relatórios disponíveis (fonte, período, métrica e qualidade). A importação de audiência autorizada permanece conforme fase 1 em `docs/fase-1-radar.md`. Nenhum dado fictício é instalado. Os testes usam banco em memória com fixtures explicitamente sintéticas.

Próxima fase: catálogo de eventos únicos, importadores/coletores autorizados por plataforma, classificação de modalidades, primeira observação e ranking de publicações. Não tratar oferta como vendas.
