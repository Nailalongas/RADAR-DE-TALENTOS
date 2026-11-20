# Fase 3 — Radar de tendências de eventos

Objetivo: medir a oferta observada de eventos, não vendas. A migração 005 amplia o banco sem modificar as migrações anteriores. As dez plataformas são cadastradas como fontes, sem alegar conectores ativos.

## Instalação
Faça backup do banco existente e mantenha `RADAR_DATABASE_PATH` apontando para ele. Execute `npm install`, `npm run db:init`, `npm run geo:sync -- 2025` (se necessário), `npm test`, `npm run build`, `npm run dev` e, em outro terminal, `npm run dev:web`.

## Importação autorizada
`npm run events:import -- /caminho/arquivo.json`. O arquivo deve conter `platform` (ID da fonte), `observed_on` (AAAA-MM-DD), `source` (descrição do relatório autorizado) e `items` (array). Cada item exige `external_id`, `title`, `venue`, `municipality_code` (código municipal), `event_date`, `url` HTTPS. Opcionais: `published_on`, `modality_id`, `submodality_id` (ID existente), `status` (listed/cancelled/postponed/sold_out/unknown). Exemplo de envelope vazio, sem dados fictícios: `{"platform":"sympla","observed_on":"2026-11-17","source":"Relatório autorizado","items":[]}`. A importação é local, transacional e não expõe rota de escrita. IDs das fontes na rota `/api/events/platforms`.

## API
GET `/api/events/platforms`: cobertura e última importação. GET `/api/events/trends?start=2026-11-01&end=2026-11-30`: rankings, catálogo (até 100), distribuição geográfica, meses e comparação com período anterior. Parâmetros opcionais `basis` (first_seen, published_on, event_date), `platform`, `modality`, `submodality`, `region`, `uf`, `city`, `center`, `radius` (km em linha reta). Centro e raio devem ser informados juntos. Datas são inclusivas.

## Regras e limites
- Unidade analítica inicial: título normalizado + município + local + dia. Mesma identidade exata entre plataformas conta uma vez; anúncios originais são preservados. Não resolve nomes divergentes, sessões no mesmo dia ou eventos remarcados; alterações de identidade são rejeitadas para revisão. Não há interface de revisão ainda.
- A classificação automática usa palavras-chave conservadoras; múltiplos resultados ficam em Outros. Submodalidade requer informação explícita. Classificação fornecida prevalece sobre inferida; divergências entre classificações fornecidas exigem revisão externa.
- Primeira detecção não significa publicação. Inventário inicial não permite inferir lançamento; use a data fornecida quando disponível. Datas desconhecidas ficam fora do recorte oficial. Comparação de períodos representa apenas variação observada; sem cobertura comparável, não interprete como crescimento real do mercado. Cancelados também contam como oferta historicamente observada, não como agenda ativa.
- Contagem de anúncios por plataforma não é aditiva. Zero registros não comprova ausência de oferta. Não há coleta programada, APIs externas ativas, monitoramento de vendas, histórico completo de status, reconciliação aproximada, sessão individual ou sazonalidade histórica validada. O calendário mostra meses de realização dentro do recorte.
- Base geográfica e frontend dependem da instalação/importação da fase anterior. A implantação em Vercel não fornece automaticamente backend persistente. Antes de produção, proteger endpoints, validar cobertura e licenças de cada fonte e implementar agendamento/observabilidade.
