# Ativação das fontes de dados reais

## Primeira carga (manual, parcial)

`npm run data:observed` importa uma seleção de anúncios públicos consultados em 18/11/2026, com links de origem e seis municípios (coordenadas aproximadas de suas sedes, não do local do evento). É uma amostra deliberadamente pequena, não aleatória. Não representa participação de mercado, demanda, vendas nem cobertura nacional. O painel sinaliza a amostra e omite percentuais comparativos enquanto ela estiver presente. As datas de publicação não informadas ficam nulas; a data de primeira detecção é a data da consulta. A disponibilidade de ingresso não foi confirmada. Temporadas contam como uma publicação. As categorias foram atribuídas manualmente pelo conteúdo do anúncio; não há extração de audiência social.

Fontes adicionais para conferência de duas corridas anunciadas em mais de uma plataforma:
- https://sportsweek.ticketsports.com.br/eventos (Gospel Run, lista pública; a página de inscrição direta não foi renderizada durante a consulta)
- https://www.sympla.com.br/evento/gospel-run-5km/3566383?mp_rloc=Esportes&mp_rtil=Todos+os+eventos
- https://fpbesportes.com.br/corrida-de-natal-2026
- https://www.ticket360.com.br/evento/34357/ingressos-para-corrida-de-natal
- Regulamento público hospedado no CDN do Ticket Sports, link no JSON.

O script não substitui anúncios já existentes e pode ser repetido. Não habilita tarefas nem declara cobertura. Revisar direitos de uso antes de disponibilizar comercialmente os dados de terceiros.

## Execução local e produção

Node 22.12+. Faça backup do banco atual antes de operar.

```
npm run db:init
npm run data:observed
npm run ops:setup
npm run build
npm start
```

O servidor local atende ambos os dashboards em http://127.0.0.1:3000 (eventos) e /audience.html (audiência). Execute `npm run geo:sync -- 2025` para importar a base nacional completa e malhas reais. A carga manual não substitui esse passo. Sem internet, a sincronização completa não pode terminar.

### Ticketmaster: prioridade para primeira coleta automática

Obter chave própria: https://developer.ticketmaster.com/ . A API Discovery permite pesquisa de eventos no Brasil, mas a cobertura disponível depende do catálogo retornado. Configure a chave em ambiente protegido, nunca no Git ou na interface. No PowerShell da máquina que fará a coleta:

```
$env:TICKETMASTER_API_KEY = 'SUA_CHAVE'
npm run ops:setup -- ticketmaster "Credencial Discovery autorizada"
npm run ops:check
npm run ops:once
npm run ops:worker
```

O servidor e worker precisam compartilhar banco persistente, configuração e credenciais. `ops:doctor` indica lacunas. Se a fonte não retornar eventos, investigar cobertura e resposta da API; não preencher zeros artificiais. Para as demais ticketeiras obtenha credenciais de produtor (Sympla), organização (Ingresse), ou feeds autorizados. O conector de arquivo/HTTPS requer JSON normalizado e data de observação do dia. Não reapresentar a amostra histórica como novas publicações.

### Audiência municipal

Dados reais por município não são fornecidos indiscriminadamente pelas APIs públicas. Autorizar canal YouTube Analytics (escopo de leitura de Analytics), cadastrar talento/conta confirmada via `registry:import`, mapear identificadores de cidades retornados conforme documentação da Fase 4 e configurar tarefa `youtube` no JSON. Para Instagram, Spotify e TikTok, obter relatório municipal autorizado com a métrica, período, fonte, cobertura e contagem absoluta. Não converter percentuais em contagens sem denominador correspondente. Use `regional:import` para o formato baseado em talento e `audience:import -- report` para relatórios por conta confirmada; veja os exemplos do projeto. Sem esses relatórios, o dashboard de audiência informa ausência de dados.

### Implantação

A Vercel atual é uma prévia estática. Rode Node e worker em servidor com disco persistente, autenticação e HTTPS (compose.yaml e Caddyfile.example). Use o mesmo domínio do servidor para os dois dashboards ou configure proxy autenticado para todas as rotas necessárias, não apenas /api/health. Não é necessário instalar Vite para o painel atual. A publicação externa e o acesso às credenciais não foram realizados nesta entrega.
