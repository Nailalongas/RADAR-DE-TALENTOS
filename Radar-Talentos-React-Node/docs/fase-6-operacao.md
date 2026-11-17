# Fase 6 — Automação, dados reais e homologação de produção

## 1. Objetivo e estado da entrega

A aplicação monitora a OFERTA de modalidades nos catálogos de ingressos e a audiência digital conhecida, não as vendas de ingressos. A Fase 6 automatiza entradas autorizadas, persiste histórico, sinaliza falhas e tendências e prepara uma instalação interna durável. Não há dados reais, credenciais, contrato de parceiros, domínio ou banco R2 de produção neste pacote. Nenhuma fonte externa é habilitada por padrão. O legado continua intacto; não houve implantação ou alteração da hospedagem original.

A estratégia de produção inicial é um servidor Node 22 e um worker separados, com SQLite em um volume persistente local compartilhado pelo mesmo host. Não usar o SQLite em armazenamento efêmero de funções serverless nem em sistema de arquivos de rede sem verificar suporte a locks/WAL. A evolução para PostgreSQL e fila distribuída deve ser medida conforme volume, usuários e disponibilidade exigida. A autenticação atual é apropriada para piloto restrito (uma conta Basic Auth, HTTPS obrigatório na borda); não é um SaaS multiempresa, não há RBAC/multiusuários, SSO/MFA ou painel de edição de credenciais.

## 2. Instalação e preservação dos dados

Abra `Radar-Talentos-React-Node` no VS Code. Use Node 22.12 ou superior. Antes de atualizar a base já existente, pare a aplicação e o worker, preserve a pasta e execute o backup indicando o caminho do banco real em RADAR_DATABASE_PATH quando não for data/radar.sqlite. O comando de backup abre o banco existente em leitura e não aplica migrações antes da cópia:

```sh
npm run db:backup -- data/backups/pre-fase6.sqlite
npm install
npm run db:init
npm test
npm run build
```

Se for uma instalação nova, pule o backup inicial (não existe base para copiar). Em máquina com internet, gere e versione o package-lock.json obtido de `npm install`, revise as dependências e execute `npm ci` em próximas instalações. Não substitua o banco usado em produção por um arquivo vazio.

Sincronize a geografia oficial antes de ativar coletores:

```sh
npm run geo:sync -- 2025
```

Use uma versão de malha disponível e adequada à base nacional vigente; verifique o total oficial de municípios, as 27 UFs e a cobertura das coordenadas. A execução pode falhar parcialmente por UF; repita após corrigir. A alternativa offline e os formatos estão em fase-2-geografia.md. Os centroides aproximam o raio geográfico em linha reta, não distância rodoviária.

## 3. Cadastro e histórico de talentos

Novo comando de entrada normalizada: `npm run registry:import -- cadastro.json`. A exportação bruta do R2 não está disponível; primeiro converta os registros reais para o contrato abaixo, revise IDs, redes, datas, fontes e associações. Não use nomes semelhantes como prova de identidade. Não crie contas fictícias. O importador é transacional, não reassocia uma conta já cadastrada a outro talento, não altera silenciosamente identidade ou histórico existente. Uma correção de divergência requer revisão explícita e backup. Importações grandes devem ser divididas em lotes auditáveis.

Exemplo de FORMATO, não dados de produção (substituir tudo pelos registros autorizados):

```json
{
  "talents": [{"id":"ID_TALENTO_REAL","name":"NOME_REAL","entity_type":"person","modalities":["shows"]}],
  "accounts": [{"id":"ID_INTERNO_CONTA","talent_id":"ID_TALENTO_REAL","network":"YouTube","external_id":"ID_EXTERNO_REAL","url":"https://www.youtube.com/channel/ID_EXTERNO_REAL","identity_confirmed":1,"identity_source":"REFERENCIA_REVISADA"}],
  "snapshots": [{"account_id":"ID_INTERNO_CONTA","network":"YouTube","metric":"subscribers","observed_on":"YYYY-MM-DD","value":100,"source":"FONTE_AUTORIZADA"}]
}
```

O valor 100 é apenas exemplo de tipo inteiro; substitua por dado real. `modalities` aceita IDs ou objetos `{ "id": "shows", "submodality_id": 1 }`; consulte a API de modalidades para IDs reais. `identity_confirmed=1` exige evidência. Contas sem confirmação não entram nas análises regionais. Migração de logs, tokens, cron e demais recursos legados requer exportação e validação próprias; não foi executada contra a produção.

## 4. Matriz de integrações e limites

| Fonte | Adaptador disponível | Escopo / dependência |
|---|---|---|
| Ticketmaster | ticketmaster | Discovery API, countryCode BR, chave aprovada; até 10 páginas de 100 resultados; corte ou localização não resolvida = parcial. Não é cobertura de todo o mercado. |
| Sympla | sympla | API oficial v1.6.0, s_token do produtor, paginação por cursor. Somente eventos publicados e não privados do produtor autenticado; não catálogo nacional. |
| Ingresse | ingresse | Partner Reports, host e organizationId fornecidos no onboarding, token de usuário com permissão events.reports. Não usar client_credentials da Access Control. Uma publicação por evento, primeira data de sessão, street como local informado. Localidade ausente = parcial. |
| Eventim | file / https | Feed de parceiro autorizado e normalizado. A existência de programas de afiliados em outro mercado não comprova acesso no Brasil. |
| Ticket Sports | file / https | API/entrega para clientes e parceiros anunciada; solicitar contrato e formato autorizados. |
| Ticket360 | file / https | Solicitar dados de catálogo e escopo comercial da integração. |
| Blueticket | file / https | Solicitar feed/exportação autorizada. |
| Disk Ingressos | file / https | Solicitar feed/exportação autorizada. |
| Bilheteria Digital | file / https | Solicitar feed/exportação autorizada. |
| Uhuu | file / https | Solicitar feed/exportação autorizada. |
| YouTube | youtube / file / https | Analytics por cidade, views, conta confirmada, até 250 linhas, cobertura parcial; OAuth renovável. |
| Instagram | file / https | Relatórios Insights de conta profissional autorizada, normalizados em contagens; sem coletor Meta direto nesta versão. |
| Spotify | file / https | Relatórios Spotify for Artists autorizados, normalizados em contagens; sem API direta de audiência por cidade neste pacote. |

Não acessar endpoints internos não documentados, contornar CAPTCHA, autenticação, quotas ou bloqueios. Fonte pública não equivale a licença de exploração comercial. Obter autorizações e revisar termos, LGPD, retenção, atribuição, escopo e redistribuição antes de comercializar. Apenas dados agregados e metadados públicos de eventos; não coletar compradores, participantes, e-mail de público, CPF, meios de pagamento ou pedidos.

## 5. Configuração operacional

Copie `config/operations.example.json` para `config/operations.json`. No PowerShell:

```powershell
Copy-Item config/operations.example.json config/operations.json
New-Item -ItemType Directory -Force data/inbox,data/secrets,data/backups
```

Em Linux/macOS: `cp config/operations.example.json config/operations.json` e `mkdir -p data/inbox data/secrets data/backups`. A configuração é local e ignorada pelo Git. Não guardar valores secretos ali: somente nomes das variáveis ou arquivo local de token, protegido pelo sistema operacional. Use IDs estáveis, uma configuração compartilhada por instalação e um worker. Para mudar configuração, reinicie o worker. O mesmo ID não pode ser reassociado a outra rede/plataforma. Uma configuração alterada tem novo hash e novo histórico de comparabilidade.

Campos de cada job:
- `id`, `kind` (`events`, `audience`, `metrics`, `alerts`), `provider`, `adapter`, `enabled`.
- `authorizationRef`: referência NÃO secreta de contrato/consentimento para toda coleta externa habilitada.
- `scope`: descrição da fonte e recorte, obrigatória em file/https; escopo declarado não certifica completude.
- `runAfter`: horário HH:mm de Brasília (America/Sao_Paulo). Padrão 00:00 quando omitido. Exemplo: APIs às 06:00, arquivos às 08:00, alertas às 10:00.
- `maxAttempts`: 1 a 6, padrão 3; `retryMinutes`: 15 a 360, padrão 15. Respostas 429/5xx admitem backoff curto; Retry-After longo é persistido e respeitado inclusive no dia seguinte.
- `tokenEnv`: NOME da variável que contém a credencial; nunca o valor do token. `allowedHosts` lista exata dos hosts HTTPS de parceiros autorizados. Redirects não são seguidos. Configure a saída de rede do worker apenas para provedores aprovados.
- `file`: arquivo relativo à caixa `data/inbox`, sem sair da pasta; `url`: endpoint HTTPS aprovado para JSON normalizado. Arquivos devem ser publicados atomicamente pelo fornecedor, não escritos pela metade.
- `accountId`: ID interno de uma conta confirmada, para audience/metrics.
- `maxPages`: limite de páginas para API de eventos; Ticketmaster limita a dez, Sympla/Ingresse até vinte. Ajuste quotas conforme contrato.

Valide:

```sh
npm run ops:check
npm run ops:once
npm run ops:worker
```

`ops:once` roda apenas jobs devidos; para piloto imediato configure `runAfter` como `00:00`. `ops:worker` verifica a cada minuto. Não repete uma coleta concluída do mesmo dia e configuração; usa lease para impedir execução simultânea do mesmo job; após interrupção aguarda expiração do lease (60 min) e reavalia. Falhas de uma fonte não interrompem as demais. Uma resposta parcial/vazia não é tratada como catálogo completo. A repetição de um job de audiência com o mesmo relatório não duplica o histórico. Alertas são recalculados após novas coletas no mesmo dia, sem duplicar o mesmo alerta diário. Os eventos e o estado final de sua execução são persistidos atomicamente; importações de audiência preservam fotografia anterior vazia e não deixam relatório parcial substituir um completo registrado.

### Ticketmaster

Ative o job `ticketmaster` quando tiver chave Discovery autorizada (TICKETMASTER_API_KEY) e referência de autorização. A API consulta BR, pagina ordenada por data, mapeia cidade + UF ao código municipal, registra corte/truncamento como parcial. Sem data/localização válida, a linha não entra. Não assume que data de início da venda seja data de publicação.

### Sympla

Ative `sympla` após receber token do produtor autorizado (SYMPLA_API_TOKEN). Não usar token de terceiros sem consentimento. A API retorna o catálogo restrito à conta/organização autenticada, não é uma busca do catálogo geral.

### Ingresse

Ative `ingresse` somente com host Partner Reports, `organizationId` e permissão `events.reports` aprovados. Inclua o host em allowedHosts. O token válido deve ser entregue/renovado pelo fluxo homologado pela Ingresse. `tokenFile` lê um arquivo separado em `data/secrets` a cada execução, o que permite que um processo autorizado externo mantenha o token atualizado; configure permissões de acesso restritas, não grave token em JSON/controle de versão. Alternativamente use `tokenEnv` e remova tokenFile, com renovação sob responsabilidade do operador. A documentação indica que o token client_credentials comum não serve para Partner Reports. Não há um emissor/renovador Ingresse implementado sem o contrato real. Quando a localização vem vazia, a coleta fica parcial. Não consulta endpoints de pedidos ou participantes.

### Demais plataformas de ingressos

Todos os sete adaptadores usam contrato JSON normalizado, específico para a plataforma declarada. Com feed remoto, mude adapter para `https`, informe URL, inclua o host em allowedHosts, referencie o token se necessário e declare escopo/autorização. Se a API/parceiro retornar formato diferente, a transformação deve acontecer em adaptador homologado ou na entrega normalizada do fornecedor; não há integração direta específica para os sete sem esse contrato.

Formato do lote de eventos (placeholders, não importar exemplos):

```json
{
  "platform":"ticketsports",
  "observed_on":"YYYY-MM-DD",
  "partial":true,
  "items":[{
    "external_id":"ID_PUBLICACAO_REAL",
    "title":"TITULO_REAL",
    "venue":"LOCAL_REAL",
    "municipality_code":"CODIGO_MUNICIPAL_REAL",
    "event_date":"YYYY-MM-DD",
    "url":"https://URL_PUBLICA_REAL",
    "status":"listed"
  }]
}
```

`observed_on` deve ser o dia da coleta em São Paulo, não a data de realização ou publicação. `published_on` opcional somente quando a fonte informa a data efetiva de publicação. `partial:false` exige evidência de que o lote está completo para o escopo declarado (não para o país inteiro). `modality_id` / `submodality_id` opcionais se classificados pela fonte; `status` pode ser listed/cancelled/postponed/sold_out/unknown. O sistema usa regras conservadoras para modalidade e submodalidade explícita; títulos ambíguos não recebem subcategoria arbitrária. A deduplicação é exata por título normalizado, município, local e data. Alterações de identidade/locais/datas em ID já registrado interrompem aquele lote para revisão humana. Não remover automaticamente anúncios que desapareceram de uma coleta parcial. Não contar sessões múltiplas de uma mesma publicação como vendas.

### YouTube Analytics regional

Consulte fase-4-audiencia.md para associação da conta e mapeamento explícito de cidades. Cadastre o canal UC... corretamente. Obtenha OAuth Google com acesso offline concedido pelo titular e escopo yt-analytics.readonly (e os demais exigidos pelo fluxo autorizado). Defina YOUTUBE_REFRESH_TOKEN, GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET fora do repositório; o job renova access token no endpoint Google e não persiste o token renovado. Alternativa manual: retire refreshTokenEnv/clientIdEnv/clientSecretEnv e use tokenEnv/YOUTUBE_ACCESS_TOKEN válido. Use um job e referências de token por conta; não reutilize um token de outro artista. Janela diária solicitada: 30 dias até dia atual menos 3, para reduzir atraso; não garante que o último dia tenha sido processado. Até 250 cidades; nenhuma distribuição artificial dos totais. A linha externa da cidade só é aceita quando há mapeamento revisado no banco; preserve o rótulo e associe ao código municipal com evidência.

### Instagram e Spotify regionais

O worker importa automaticamente o relatório JSON autorizado entregue em arquivo/HTTPS, no formato de fase-4-audiencia.md. `authorization_ref` é preenchido pelo job. Use `coverage:partial` por padrão. O campo `value` é uma contagem inteira, não percentual. Não atribuir um período que o relatório não possua. Valores estimados devem ter fornecedor/licença e quality estimated; não misturar com fontes verificadas. O upload/exportação/entrega da origem ainda exige autorização e processo de integração do titular ou fornecedor contratado; o worker não entra no painel privado de terceiros.

### Métricas para ranking geral

Jobs `kind:metrics`, `adapter:file` ou `https` importam fotografias de cada conta confirmada de uma fonte autorizada. YouTube: subscribers; Instagram: followers; Spotify: monthly_listeners (métricas do cadastro nacional original, não audiência geográfica). Formato:

```json
{"network":"YouTube","account_id":"ID_INTERNO_CONTA","rows":[{"account_id":"ID_INTERNO_CONTA","network":"YouTube","metric":"subscribers","observed_on":"YYYY-MM-DD","value":100,"source":"FONTE_REAL_AUTORIZADA"}]}
```

Exemplo de estrutura, substitua o valor pelos dados reais. As fotografias preservam valores já registrados e não são deduzidas da soma regional. Histórico divergente deve ser revisado antes de reimportar. O ranking geral não soma inscritos, seguidores e ouvintes como pessoas únicas. O envio automático desses arquivos/feeds pelo legado ou por parceiro requer integração real e verificação de contratos.

## 6. Indicadores, alertas e cobertura

A central mostra o estado de cada tarefa, adaptador e escopo declarados, último dia, últimas 50 execuções, quantidade, falhas, próxima tentativa e atividade recente do agendador; atualiza automaticamente a cada minuto enquanto o painel estiver aberto. API somente leitura: GET /api/operations/status. Os alertas são internos, não enviam WhatsApp/e-mail nesta versão.

Tendência por fonte: comparar duas janelas de sete dias de PRIMEIRA DETECÇÃO, exigindo uma carga inicial e 14 dias consecutivos de sucesso ou vazio explicitamente completo e configuração estável (15 dias de observações). Não misturar as importações manuais com o histórico observado pelo job. Regra inicial: pelo menos 5 eventos na janela anterior, +30% e +5 eventos; categoria emergente: menos de 5 anteriores, pelo menos 10 atuais. O alerta é restrito ao escopo da fonte e não comprova aumento de vendas. Mudança de configuração reinicia comparabilidade. Mais de um job ativo para a mesma plataforma impede o alerta agregado automático dessa plataforma nesta versão, evitando sobreposição não tratada. A classificação histórica pode mudar por revisão da taxonomia; os limiares são hipóteses ajustáveis no código e requerem validação comercial.

Oportunidade: configure `queries` do job alerts com parâmetros da API da fase 5. Datas podem ser fixas ou `today`, `today-3`, `today-32` etc. (resolvidas em São Paulo). Exemplo de recorte para relatório de audiência YouTube de 30 dias até D-3 e oferta no período anterior, somente após cobertura real registrada:

```json
{
 "modality":"shows", "network":"YouTube", "metric":"views",
 "start":"today-32", "end":"today-3", "source":"YouTube Analytics", "quality":"verified",
 "eventStart":"today-29", "eventEnd":"today", "platform":"ticketmaster", "basis":"first_seen"
}
```

Alerta para até 10 praças retornadas com score >=80 na consulta configurada; índice relativo, não probabilidade de compra. Sem cobertura e audiência registradas não há score. As declarações de cobertura continuam explicitamente revisadas com `npm run events:coverage -- cobertura.json` conforme fase-5-oportunidades.md. A automação NÃO gera declarações a partir de uma importação ou de uma resposta vazia, e não existe certificado automático de cobertura nacional. Selecione uma fonte elegível por vez no piloto. Sem base adequada, os alertas podem ficar vazios; não é falha de matemática.

## 7. Desenvolvimento e piloto local

```powershell
# Terminal 1 (API local)
npm run dev
# Terminal 2 (frontend)
npm run dev:web
# Terminal 3 (coletas: configurar variáveis nesse terminal)
npm run ops:worker
```

Para testar autenticação com o frontend já compilado, configure `NODE_ENV=production`, RADAR_USER e uma senha única aleatória de pelo menos 24 caracteres. No PowerShell use `$env:NODE_ENV='production'`, `$env:RADAR_USER='admin'`, defina `$env:RADAR_PASSWORD` por método seguro e execute `npm start`. A aplicação exige credenciais no modo produção, não habilita host externo sem credenciais e protege todas as rotas de dados e arquivos estáticos; `/api/health` expõe apenas disponibilidade básica. Use HTTPS em qualquer acesso não local. Basic Auth não é autenticação multiusuário. A administração fica restrita ao operador do host; nenhuma rota HTTP permite configurar segredos, executar jobs ou importar dados. Limite geral de 300 requisições/min por IP de conexão; com proxy esse limite pode ser compartilhado; dimensione a borda para piloto, não confie em cabeçalhos de IP fornecidos pelo cliente.

## 8. Hospedagem persistente — Docker Compose

Pré-requisitos: servidor controlado, Docker Compose, disco persistente local, firewall, domínio e TLS, credenciais aprovadas. O compose entrega duas instâncias de processo (radar e worker) com o mesmo volume SQLite. Não publique o container diretamente na internet. A porta é mapeada apenas ao loopback do host. Copie `.env.example` para `.env` e gere RADAR_PASSWORD de pelo menos 24 caracteres. Copie `config/worker.env.example` para `.env.worker`; preencha somente as variáveis necessárias. Restrinja permissões de ambos os arquivos. O compose compartilha a configuração de operações em montagem somente leitura. O volume `radar-data` guarda banco, inbox, secrets e backups. Os arquivos devem ser entregues no volume pelo operador/integração autorizada, não em `data/inbox` do host esperando sincronização automática (o volume nomeado é separado). O worker roda como usuário node. A entrega de relatórios deve respeitar propriedade/permissões.

```sh
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 worker
```

Atenção: `docker compose config` sem --quiet pode exibir segredos interpolados. Não compartilhe sua saída. Não utilize `docker compose down -v`: remove o volume de dados. Configure reverse proxy TLS no HOST (exemplo `config/Caddyfile.example`), substitua pelo domínio real, valide DNS/certificado e não permita acesso direto à porta 3000. O processo web fica autenticado; o worker não expõe porta. Logs possuem rotação local. O worker habilita backup diário de 14 dias (apenas snapshots com nome daily-YYYY-MM-DD.sqlite são removidos conforme retenção após backup novo verificado). Faça cópia cifrada fora desse host e teste restauração periodicamente. Cópia no mesmo volume não protege contra falha total do disco.

Exemplo de sincronizar a malha geográfica no volume antes de ligar fontes: `docker compose run --rm --no-deps worker npm run geo:sync -- 2025`. Para executar diagnóstico na configuração do worker, configure as mesmas credenciais de produção em uma sessão segura, ou faça os checks de web e worker separadamente; as credenciais do web não são entregues automaticamente ao worker. Não passe senha como argumento visível em histórico/shell.

## 9. Backup, restauração e rollback

`npm run db:backup -- arquivo.sqlite` gera snapshot consistente, valida quick_check/foreign_key_check, não sobrescreve arquivo existente e não aplica migrações antes da cópia. O backup automático pode ser habilitado por RADAR_AUTO_BACKUP=1, RADAR_BACKUP_DIR e RADAR_BACKUP_KEEP_DAYS. Em Docker, padrão 14 dias. Guarde cópia externa cifrada e restrita, incluindo credenciais/configuração em cofre separado, não no backup compartilhado. Em caso de falha, pare API e worker; preserve o banco atual E arquivos WAL/SHM existentes para investigação; valide o snapshot de restauração num caminho novo isolado e só então substitua a configuração RADAR_DATABASE_PATH ou restaure no volume correto. Não copie um SQLite ativo de forma simples; não misture arquivos WAL/SHM do banco antigo com o restaurado. Verifique contagens/identidades e migrações antes de retomar.

## 10. Homologação e bloqueios de release

Rode `npm run ops:doctor` (ou indique o arquivo de configuração após --). O diagnóstico local abre o banco e pode aplicar migrações: faça backup antes. Identifica integridade, geografia, fontes habilitadas, credenciais/arquivos ausentes, atividade do worker, dados e artefato dist/index.html. Erro bloqueia publicação; aviso exige revisão. Não valida remotamente credenciais, dados, licenciamento, autenticação TLS ou cobertura. O CI em `.github/workflows/radar-ci.yml` instala, testa, compila e verifica endpoint protegido e página compilada. Não publica automaticamente. A configuração Vercel é somente preview, health 503 sem backend real.

Checklist obrigatório:
1. Backup inicial verificado e restauração ensaiada. Preservar dados e IDs originais; nenhuma duplicidade ou conflito de identidades não revisado.
2. npm install e lockfile gerado/revisado; npm test e npm run build aprovados em ambiente com internet; testes visuais e de navegação do mapa, ranking, filtros e central.
3. Geografia oficial sincronizada, comparação com o total da base nacional, 27 UFs e coordenadas conhecidas; validar mapa e filtro 50/100/200/500 km.
4. Piloto: uma fonte de ingressos autorizada, uma conta de audiência autorizada e fotografias gerais correspondentes. Conferir amostra manual de datas, categorias, localização, duplicidades e métricas contra relatórios de origem. Não inventar valores ausentes.
5. Validar HTTP 401/403/429, expiração de credencial, falha de rede, reinício de processo, rejeição de lote inválido, backup e monitoramento. Confirmar que logs não contêm tokens. Revisar licenças, LGPD, descarte/retirada de autorização e limites por parceiro.
6. Ativar demais fontes uma a uma, registrar escopo/cobertura comprovada. Observar ao menos 15 dias comparáveis para tendências; validar sinais e pesos contra realidade comercial. Não declarar cobertura Brasil com um catálogo de um produtor.
7. HTTPS e autenticação testados externamente; porta privada; restauração, monitoramento de disco, alertas e procedimento de rollback documentados. Avaliar testes de carga, hardening e gestão multiusuários antes de expandir.

## 11. Referências dos contratos consultados

- Ticketmaster Discovery API: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
- Sympla OpenAPI / autenticação: https://developers.sympla.com.br/api-docs e https://developers.sympla.com.br/docs
- Ingresse Partner Reports / eventos: https://developer.ingresse.com/docs/partner-reports/events e https://developer.ingresse.com/docs/authentication
- Ticket Sports funcionalidades de integração: https://beta.ticketsports.com.br/funcionalidades/pt-br
- Ticket360 integrações: https://www.ticket360.com.br/sobre/comercial
- YouTube Analytics: https://developers.google.com/youtube/analytics/channel_reports
- Google OAuth refresh: https://developers.google.com/identity/protocols/oauth2/web-server
- Meta Insights: https://developers.facebook.com/docs/graph-api/reference/shadow-ig-user/insights/
- Spotify for Artists: https://support.spotify.com/br-pt/artists/article/exporting-data/
