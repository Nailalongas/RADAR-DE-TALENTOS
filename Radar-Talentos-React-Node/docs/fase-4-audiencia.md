# Fase 4 — Integrações de audiência regional

## Instalação
Faça backup do SQLite antes de atualizar. Node 22.12+, npm install, npm run db:init, npm run geo:sync -- 2025, npm test, npm run build. As migrações anteriores permanecem intactas. Execute npm run dev e npm run dev:web em terminais separados. A implantação Vercel anterior não inclui o servidor persistente.

## Escopo
YouTube: consulta autenticada de visualizações por cidade no Brasil via Analytics API, até 250 linhas, cobertura parcial. Instagram Insights: entrada de contagens por cidade de relatórios profissionais autorizados. Spotify for Artists: entrada de contagens regionais disponibilizadas ao titular, transcritas/normalizadas de relatório autorizado. Não há coletor direto de Instagram/Spotify, nem OAuth interativo ou renovação de tokens. Não presumir que o Spotify exporta todas as cidades em CSV. Confirmar permissões, termos de uso, retenção e eventual autorização comercial antes de compartilhar ou comercializar métricas. Não importar dados pessoais individuais. A autorização é referência declarada pelo operador, não verificação criptográfica do relatório.

## Pré-requisitos
Talento e conta social cadastrados, identidade confirmada com fonte; municípios IBGE importados. Um relatório por talento/rede/métrica/fonte/período; não somar contas do mesmo talento. Manter a mesma definição de métrica e janela temporal em comparações. Para relatório de seguidores usar o intervalo real informado ou data de fotografia, não atribuir uma janela arbitrária. O endpoint de status mostra cobertura, não disponibilidade em tempo real da API.

## Mapeamento de cidades (arquivo cities.json)
```json
[{"network":"YouTube","external_city":"ROTULO_EXATO_DA_API","municipality_code":"4106902","evidence":"Referência revisada pelo operador"}]
```
Exemplo estrutural, não um mapeamento válido sem verificação. Não associar por nome sozinho; homônimos e cidades estrangeiras precisam ser descartados/revisados. A mesma estrutura vale para Instagram e Spotify. `npm run audience:import -- cities cities.json`. Os rótulos são exatos, com distinção de maiúsculas.

## Importar relatório normalizado (report.json)
```json
{"account_id":"ID_INTERNO_DA_CONTA","network":"Instagram","metric":"followers","quality":"verified","period_start":"2026-10-31","period_end":"2026-10-31","report_ref":"REFERENCIA_LOCAL_DO_RELATORIO","authorization_ref":"REFERENCIA_DA_AUTORIZACAO","coverage":"partial","rows":[{"municipality_code":"4106902","value":123}]}
```
Exemplo fictício de formato, não importar como produção. Execute `npm run audience:import -- report report.json`. Para Spotify use network Spotify, metric listeners ou streams; para YouTube views. Instagram admite followers, reach, views somente quando contagem municipal realmente disponível. Percentuais não são contagens. Estimativas exigem quality estimated, source identificando fornecedor e referência da licença. Fontes verificadas recebem nome oficial automaticamente. `coverage: complete` somente quando a fonte comprovar completude; padrão partial. Sem linhas ou sem cidade resolvida, preserve a fotografia anterior; com linhas resolvidas, substitua a fotografia da mesma fonte e período, sem mesclar levantamentos. O log registra os rótulos não resolvidos. A base legada pode ter dados sem este log; faça revisão antes de migrar relatórios já existentes. O importador anterior continua disponível para compatibilidade; prefira o novo.

## Consultar YouTube
Habilitar YouTube Analytics API e YouTube Data API conforme configuração Google, obter access token do titular com escopos yt-analytics.readonly e youtube.readonly. Definir YOUTUBE_ACCESS_TOKEN no ambiente do terminal (não salvar em código/JSON). O comando não registra o token. Use arquivo youtube.json:
```json
{"account_id":"ID_INTERNO_DO_CANAL","period_start":"2026-10-01","period_end":"2026-10-31","report_ref":"REFERENCIA_DO_RELATORIO","authorization_ref":"REFERENCIA_DA_AUTORIZACAO"}
```
`npm run audience:import -- youtube youtube.json`. ID externo do canal UC... deve estar cadastrado. Consulta explícita ao canal autorizado, country==BR, dimensão city, views, sort=-views, limite 250. A API pode omitir cidades por privacidade, limite ou atraso. A janela solicitada não garante que os dados da última data já estejam disponíveis. O conector não pagina além desse limite nem calcula totais nacionais. Revise os rótulos não mapeados, adicione mapeamentos e repita a consulta. Erros HTTP encerram o comando sem importar. Não há execução cron nem refresh de tokens.

## Painel
GET /api/audience/status retorna contagens de contas confirmadas, registros e municípios por plataforma e o estado da última importação registrada, sem tokens ou referências de autorização. No Radar geográfico selecione o relatório importado, modalidade, região, UF, município ou raio. Não somar redes distintas nem interpretar zeros ausentes como ausência de público. O ranking é de audiência conhecida, não de ingressos vendidos.

## Referências oficiais
- https://developers.google.com/youtube/analytics/channel_reports
- https://developers.google.com/youtube/analytics/reference/reports/query
- https://developers.facebook.com/docs/graph-api/reference/shadow-ig-user/insights/
- https://support.spotify.com/br-pt/artists/article/exporting-data/

## Validação e pendências
Testes locais com banco temporário e resposta YouTube simulada. Nenhuma credencial real disponível. Build React depende de instalação do Vite. Antes de produção: autenticação e autorização de leitura, política de licenciamento/privacidade, tratamento de expiração dos tokens, fila de coleta, monitoramento de falhas, cobertura geográfica oficial sincronizada e integração autorizada de Meta/Spotify conforme permissões. Não expor o servidor atual publicamente sem proteção.
