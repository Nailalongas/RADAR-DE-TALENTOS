# Radar de Talentos — identidade visual 2.0

Referência de direção visual: Origamid (https://www.origamid.com/). O Radar utiliza sua própria identidade, com superfícies escuras, destaque violeta, tipografia de sistema, navegação modular e pesquisa rápida. Não foram copiados logotipos, fontes licenciadas, imagens ou código do site de referência.

## Arquivos ativos
- dashboard/style.css — tokens CSS, layout, filtros, indicadores, mapas, tabelas, painel de busca e responsividade.
- dashboard/layout.js — estado do servidor, zoom/arraste, busca Ctrl+K (Cmd+K no macOS), atalhos de mídias.
- dashboard/index.html e dashboard/dashboard.js — oferta de eventos por ticketeira, modalidade e território.
- dashboard/audience.html e dashboard/audience-dashboard.js — audiência regional por artista, mídia, métrica e período.

A pesquisa rápida navega pelas seções e opções efetivamente carregadas nos filtros. Na tela de eventos, também permite pesquisar o nome de uma atração. A pesquisa de municípios alimenta o filtro geográfico existente, sem inventar localidades. Escolha o município encontrado e consulte. Os atalhos de mídia disparam o fluxo de consulta existente. Os estados usam intensidade violeta; as bolhas municipais usam amarelo e tamanho proporcional ao volume observado. A distância continua em linha reta, não rodoviária. Não existe desenho livre de polígonos nesta entrega.

## Execução local
Requisito: Node >= 22.12. Preserve o banco existente e faça backup antes da atualização. Não substitua o diretório de dados por um diretório vazio.

```sh
npm run db:init
npm test
npm run build
npm start
```

Acesse http://127.0.0.1:3000/ (ticketeiras) ou http://127.0.0.1:3000/audience.html (audiência). O painel ativo é HTML/CSS/JS servido pelo Node, sem Vite. Os componentes React históricos foram preservados.

## Produção
A publicação estática na Vercel continua sendo uma prévia, sem backend persistente. Publique o servidor Node com armazenamento persistente, configure autenticação e os conectores autorizados conforme docs/fase-6-operacao.md e docs/radar-eventos-operacional.md. O layout não ativa fontes externas nem cria dados. Preserve a nomenclatura visível Base Geográfica Nacional.

## Aceitação visual
Em desktop e celular, confira menu, ausência de rolagem horizontal da página, filtros, mapas e legenda, ranking, navegação, busca Ctrl+K, Escape, seleção das quatro mídias e mensagens quando não há dados. Teste com fonte real autorizada e confirme que os resultados dos gráficos e ranking correspondem ao mesmo filtro. A validação visual automatizada não foi concluída: Chromium bloqueou a navegação localhost por política administrativa. O build e a suíte de backend foram executados.
