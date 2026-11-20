# Radar de Talentos — operação focada em eventos

## Escopo

Eventos únicos e artistas/atrações explicitamente informados nos anúncios. Não confundir atividade comercial observada, quantidade de publicações, quantidade de eventos e ingressos vendidos. Não há indicadores de redes sociais no painel ou na configuração ativa. O histórico anterior foi preservado. Nomes de atrações são agrupados por grafia normalizada; homônimos e variantes exigem revisão.

## Fontes

| Fonte | Acesso implementado | Limite |
| --- | --- | --- |
| Ticketmaster | Discovery API, chave e consulta BR; extrai atrações estruturadas e, quando necessário, divide a consulta por UFs | Apenas catálogo retornado pela API, limite de paginação, disponibilidade real a verificar |
| Sympla | API oficial, token de produtor | Eventos públicos do produtor autorizado; não é catálogo nacional |
| Ingresse | API Partner Reports, token e organização autorizada | Eventos públicos da organização autorizada |
| Eventim, Ticket Sports, Ticket360, Blueticket, Disk Ingressos, Bilheteria Digital, Uhuu | Feed HTTPS aprovado ou arquivo JSON autorizado | O fornecedor precisa efetivamente disponibilizar o feed; não existe coleta automática nacional pronta sem isso |

Referências: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/ ; https://developers.sympla.com.br/docs. Para Ingresse, utilize a documentação e o host oficiais recebidos no onboarding autorizado. Confirme os direitos de retenção e reutilização comercial dos dados antes de operar. Não use endpoints privados ou contorne bloqueios.

## Formato normalizado de feed

Cada lote registra `platform`, `observed_on` (AAAA-MM-DD, data efetiva de observação em Brasília), `partial` (booleano; só false quando a cobertura do lote declarado foi completada), `items` (lista). Em cada item: `external_id` (texto estável da fonte), `title`, `venue`, `municipality_code` (texto de 7 dígitos) OU `city` e `uf`, `event_date` (AAAA-MM-DD), `url` (HTTPS). Opcionais: `published_on`, `status` (`listed`, `cancelled`, `postponed`, `sold_out`, `unknown`), `modality_id`, `submodality_id`, `artists` (lista de nomes ou objetos com `name` e `id` da fonte). Não preencher `artists` a partir de um título não confirmado. Não converter ausência de preço ou de venda em zero. Não classificar automaticamente dados faltantes como ausentes do mercado.

Crie `config/operations.json` com `npm run ops:setup`. Para cada feed autorizado, altere a tarefa correspondente: `enabled: true`, `adapter: "file"` ou `"https"`, `authorizationRef` não vazio, `scope` com a cobertura concedida. Para arquivo, use `file: "nome.json"` relativo a `data/inbox`. Para HTTPS, configure `url` e `allowedHosts`; opcionalmente `tokenEnv` para Bearer token. Não salve credenciais no JSON. As outras tarefas permanecem desligadas. Os lotes de coletas recorrentes devem trazer a data do dia, pois arquivos antigos não podem comprovar novas observações. A importação de arquivo histórico usa `npm run events:import -- arquivo.json` com `source` identificando a proveniência autorizada.

## Atrações históricas sem nome estruturado

Após conferir o anúncio original, importe um JSON com `source` (evidência) e `items`: lista de objetos com `platform`, `external_id` e `artists`. Execute `npm run events:artists -- arquivo.json`. A revisão manual é mantida separadamente da relação informada pela fonte. Títulos sem atração confirmada continuam no ranking de modalidades e no mapa de eventos, mas não no ranking de artistas. As informações da fonte não são fabricadas para preencher as lacunas.

## Alterações de anúncios

O mesmo ID de plataforma com nova data, município ou título é enviado para revisão. Isso não bloqueia os demais eventos de uma coleta automática. O lote é identificado como parcial. Depois de conferir a alteração no anúncio original, crie um arquivo normalizado contendo somente anúncios revisados, com `source` indicando a evidência, e execute `npm run events:import -- revisados.json --accept-changes`. O vínculo anterior fica registrado em `event_listing_revisions`. O histórico antigo não é apagado. Deduplicação entre plataformas exige correspondência exata de título normalizado, cidade, local e data: diferenças de nomes ou horários podem exigir curadoria adicional.

## Painel

Página única com filtro por artista/atração, modalidade, submodalidade, fonte, região, UF, município, raio em km, situação e período. Use a pesquisa de municípios para selecionar o centro e o raio. O mapa indica eventos anunciados, não público nem estimativa de demanda. O ranking conta eventos únicos, além de cidades e fontes associadas a cada atração. A lista de eventos é paginada. As páginas preservam links para os anúncios originais. A central exibe status, última importação, falhas, alertas de tendências e pendências de identidade.

O botão Sincronizar agora solicita execução dos jobs habilitados. Tarefas já concluídas no dia não são repetidas automaticamente; falhas seguem a política de retentativas. A rotina diária é `npm run ops:worker`. A comparação de categorias emergentes ainda exige 15 dias comparáveis de observação da mesma fonte. Comparações no painel são variações da oferta observada, não prova de tendência nacional ou de demanda.

## Diagnóstico e produção

Execute `npm run ops:doctor` e confira o número de municípios, o catálogo e as fontes; um servidor saudável não significa que haja dados reais carregados. Mantenha `RADAR_DATABASE_PATH` igual para API e worker. O painel atual não necessita de `npm install` nem Vite. `npm run build` valida JavaScript e empacota a interface estática. O servidor Node continua necessário. Em produção use autenticação, HTTPS e volume persistente; faça backups e teste restauração. O código antigo React/Worker e as tabelas sociais são históricos. Não publique os arquivos históricos ou credenciais como conteúdo público.

## Validação da entrega

Os testes automatizados usam bancos temporários e respostas/feeds de teste. Não há eventos fictícios na base distribuída. Não foi possível conectar fontes reais (sem credenciais autorizadas e com DNS externo bloqueado no ambiente), baixar a base geográfica oficial ou validar a navegação visual em Chromium (bloqueio administrativo na navegação local). Os testes HTTP do painel e da sincronização executaram com sucesso. A publicação real e a cobertura nacional ainda precisam de homologação com dados de produção.
