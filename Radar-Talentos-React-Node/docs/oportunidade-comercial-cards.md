# Oportunidade Comercial — cards de crescimento e cidades

A atualização é restrita ao módulo comercial. `dashboard/index.html`, `audience.html`, `style.css`, os scripts da Home e as migrações foram preservados. Ao implantar em uma versão que recebeu mudanças externas, mescle apenas os arquivos desta atualização, não substitua a Home.

## Painel
- O primeiro artista do ranking é selecionado automaticamente; clicar em outro atualiza a ficha, gráfico e quatro cards.
- Cards nacionais: indicador principal por rede, valor atual, diferença absoluta e percentual, datas reais de observação, fonte. As demais métricas permanecem na ficha.
- Cards municipais: cidade com maior audiência registrada, métrica, período e origem; crescimento municipal quando houver comparação da mesma métrica, fonte e qualidade em janelas adjacentes de igual duração, com cidade presente nas duas. Maior aumento absoluto, não necessariamente maior percentual. Não inferir localização a partir de métricas nacionais.
- Ranking municipal: cinco cidades por rede, percentual do total observado no relatório, região líder, número de municípios e artistas. Escopo todos os artistas ou artista selecionado; filtro regional e indicador por rede.
- A janela nacional 7/30/90 dias define o recorte comercial. Para cada rede, seleciona-se um relatório inteiramente contido na janela; o mais recente por fim de período, com preferência por qualidade verificada e indicador padrão em caso de empate. Não mistura fontes, métricas, períodos ou qualidade em um mesmo ranking. Os relatórios podem ter durações diferentes: não comparar os totais diretamente entre redes. A participação (%) usa apenas a audiência observada. Agregados entre talentos não são pessoas únicas.
- Quando dados não existem, os cards informam a ausência. Para alimentar: usar importadores existentes `commercial:import` e `regional:import` e as fontes autorizadas já configuráveis no worker.

## Implantação incremental
Arquivos modificados/criados: `dashboard/commercial.html`, `dashboard/commercial.js`, `dashboard/commercial-cards.css`, `server/src/commercial.mjs` (correção do parâmetro de filtro de artista), `server/src/commercial-insights.mjs`, `server/src/app.mjs` (nova rota GET `/api/commercial/insights`), `tests/commercial-insights.test.mjs`, este documento.
Não há nova migração. Executar `npm test`, `npm run build`, `npm start` e abrir `/commercial.html`. A publicação precisa do backend Node e de relatórios reais, não só da interface estática.

## Testes
59 testes automatizados aprovados (incluindo 3 novos); build estático aprovado. Não foram utilizadas credenciais externas nem implantada a versão em produção. Os registros de teste são isolados em memória. Verificar visualmente desktop e celular no ambiente de destino.
