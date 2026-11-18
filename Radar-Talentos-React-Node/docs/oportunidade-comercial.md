# Oportunidade Comercial

## Objetivo
Identificar artistas de pequeno, médio e grande porte em crescimento, separando as métricas de cada mídia. O ranking não equivale a previsão de venda de ingressos. Dados nacionais e dados geográficos são módulos distintos. Nenhum registro de teste é carregado no banco real.

## Instalação
Preserve e faça backup de seu banco, copie os arquivos sobre uma cópia de desenvolvimento, use Node >= 22.12 e execute:

```
npm run db:init
npm test
npm run build
npm run ops:setup
npm start
```

Acesse /commercial.html no servidor Node. O menu está disponível nos dois dashboards anteriores. O preview estático Vercel não executa SQLite; configure o backend persistente e encaminhe /api/* para ele antes de publicar. Não substitua o banco de produção pelo banco de desenvolvimento.

## Dados
O importador aceita feeds autorizados de várias contas e artistas. Registre um identificador estável por talento e por conta, referência verificável de identidade, modalidade existente, observações diárias, fonte estável, unidade e escopo comparáveis. Não associe perfis a atrações apenas por nome. O histórico anterior permanece intocado; para reutilizá-lo neste módulo, normalizar e importar somente registros com autorização de retenção e análise comercial. Não deduza localização a partir de totais nacionais.

Formato de entrada (ESQUEMA ILUSTRATIVO, NÃO É DADO REAL — preencha com dados e identificadores do fornecedor):

```json
{
  "authorization_ref": "referência-do-contrato-ou-permissão",
  "artists": [
    {
      "id": "identificador-estavel-do-artista",
      "name": "nome verificado",
      "modalities": ["shows"],
      "accounts": [
        {
          "id": "identificador-estavel-da-conta",
          "network": "TikTok",
          "url": "https://www.tiktok.com/@perfil-confirmado",
          "identity_source": "referência da verificação da identidade",
          "snapshots": [
            {"metric":"followers","observed_on":"2026-11-01","value":100,"source":"fornecedor autorizado / total do perfil"}
          ]
        }
      ]
    }
  ]
}
```

As métricas aceitas estão em server/src/commercial.mjs. Para Instagram e TikTok: followers, views, likes, comments; YouTube: subscribers, views, likes, comments; Spotify: monthly_listeners, followers, streams. Não trate totais acumulados e números de janela como mesma série; manter fonte/série distinta. Não preencher métricas indisponíveis com zero. As fontes devem permitir comparação histórica, cálculo de variações e armazenamento. O importador registra autorização, não verifica automaticamente sua validade contratual. Especialmente para YouTube, confira as políticas de retenção/derivação e aprovação do caso de uso: https://developers.google.com/youtube/terms/developer-policies e https://developers.google.com/youtube/terms/derived-metrics-policy. Nenhuma API direta foi adicionada para contornar essas condições.

Importação manual: `npm run commercial:import -- arquivo.json`.

## Automação
Em config/operations.json existente, preserve as tarefas anteriores e mescle as quatro tarefas `*-commercial` de config/operations.example.json. Defina enableCommercial=true, ative individualmente enabled=true, declare authorizationRef e scope e forneça arquivo no data/inbox ou feed HTTPS permitido (adapter=https, url, allowedHosts, tokenEnv se necessário). O lote de cada tarefa deve ser restrito à rede indicada. Use `npm run ops:check`, `npm run ops:once` e `npm run ops:worker`. A referência de autorização virá da configuração para tarefas automáticas. O arquivo precisa ser atualizado pelo fornecedor contratado. Não confundir a repetição do mesmo arquivo com novos dados. Os conectores são adaptadores de feed, não APIs de descoberta pública já ligadas. Descoberta automática de perfis e revisão de candidatos ainda dependem de fornecedor e permissões.

## Ranking
Comparação por conta, indicador e fonte. Janela de 7, 30, ou 90 dias; usa observação no início ou até 7 dias anteriores (tolerância limitada à janela), e observação final recente, sem interpolar. Variação absoluta = final - base; percentual = variação / base, só se base positiva. Sem histórico comparável, retorna nulo. Seleciona uma série por artista, priorizando a mais recente e depois maior valor, não soma contas. Porte calculado pelo indicador principal: pequeno <10 mil, médio 10 mil–99.999, grande >=100 mil; faixas propostas, não cachê ou capacidade de público. Ranking retorna até 200 registros. Endpoint GET /api/commercial com filtros network, metric, days, size, trend, modality, q, talent e order. O perfil mostra séries disponíveis nas quatro mídias, datas e fontes. Os mapas permanecem no módulo geográfico; não há localização inventada.

## Validação e limites
Testes locais exercitam banco, ranking, deduplicação, rejeição de entradas inválidas, feed simulado e HTTP. Não há credenciais, fonte licenciada ou dados reais novos incluídos. Validar layout em navegador e implantação em ambiente definitivo; o arquivo ZIP não altera a Vercel nem o repositório atualmente publicado.
