# Radar de Talentos — guia de continuidade

Passagem do projeto em 14/11/2026. Site existente: https://radar-talentos-naila.longasnaila.chatgpt.site/

## Objetivo e decisões de produto

O Radar ajuda a descobrir talentos e acompanhar a evolução de seguidores do Instagram, inscritos do YouTube e ouvintes mensais do Spotify. Essas métricas têm significados distintos. A soma exibida reúne números das redes e não representa pessoas únicas.

- Descoberta com filtros por rede, categoria, subcategoria, período e porte. A comparação estrita exige uma coleta nas redes escolhidas nos últimos sete dias do período. A opção Redes disponíveis inclui quem tem cobertura parcial.
- Associar contas com evidência de que pertencem ao mesmo talento. Deixar homônimos e links ambíguos para revisão. A exclusão de um perfil deve considerar as contas vinculadas, com confirmação.
- No histórico, destacar a variação diária quando houver coletas consecutivas. Quando houver lacuna, mostrar a diferença entre coletas. A contagem pública do YouTube é arredondada. Métrica ausente deve ficar como indisponível.
- Priorizar a busca de contas oficiais que faltam nos perfis existentes. Separar perfil sem conta confirmada, erro de coleta, espera por nova rodada e pausa por limite da rede.
- Conferência das coletas no painel, planejada para 9h10 em horário de Brasília, com estado da verificação e resultados por rede. Conferir os agendamentos ativos na hospedagem antes de reproduzi-los.

## Mapa e próximos passos

O mapa faz parte de Ver evolução. Os cartões do piloto Natiruts usam Curitiba, São Paulo e Porto Alegre. População, PIB por habitante e histórico de apresentações contextualizam a cidade. A audiência oficial usa relatórios por município, identificados pelo código IBGE, com fonte, métrica e período. A agregação por estado deve indicar cobertura parcial quando o relatório cobre apenas parte dos municípios.

O **Relatório de audiência estimada** dentro do mapa foi publicado com as três cidades aguardando amostra. A próxima entrega é validar uma amostra do HypeAuditor ou da Modash antes da integração: confirmar cobertura brasileira, custo, data, município, percentual e se a amostra mede seguidores, espectadores ou audiência engajada. Manter o dado estimado com fonte e data. O Instagram Insights e o YouTube Analytics dependem dos relatórios ou do acesso autorizado de cada conta. O YouTube por cidade mede atividade, como visualizações e minutos assistidos.

### Planejamento em duas etapas

1. **Potencial de crescimento.** Base principal de 30 dias, com sinais de 7 dias e contexto de 90 dias quando houver histórico. Medir crescimento absoluto e percentual por rede, aceleração, consistência e posição entre perfis de categoria e porte semelhantes. A confiança depende da quantidade, cobertura e atualidade das coletas. Exibir por que o perfil se destacou e quais dados faltam. Piloto proposto de 30 talentos com interesse regional do Google Trends, menções em imprensa e desempenho de publicações recentes. Verificar a política de uso e retenção do YouTube antes de aplicar pontuação às métricas da API.
2. **Termômetro por praça e oportunidades comerciais.** Uma linha por sessão, com local, capacidade da casa, ingressos liberados, situação do evento, sinal de venda, fonte e data. Esgotamento de uma sessão e encerramento de um lote são registros diferentes. Calcular percentual vendido somente com a quantidade vendida e a quantidade liberada. Radar de praças e alertas para datas novas, abertura de vendas e sessões extras podem orientar o contato com produtores. Avaliação de bilheteria e risco financeiro ficam a cargo da equipe comercial.

## Como trabalhar no código

O ZIP contém o código versionado, incluindo a interface em `web/`, a API e regras de coleta em `worker/`, os scripts e testes em `scripts/` e a configuração de hospedagem em `.openai/`. Use o arquivo de histórico para localizar o contexto das mudanças.

Na pasta extraída, com Node.js e Git instalados, rode:

```sh
node scripts/test-ui.mjs
node scripts/build-real.mjs
node scripts/validate-artifact.mjs
```

O build reúne a interface e a API em um Worker ESM. Como o deploy existente está associado a um projeto Sites, use um projeto de teste ou armazenamento isolado para desenvolver. Preserve o vínculo da produção ao publicar uma atualização autorizada.

## Itens separados do código

O pacote não inclui senhas, chaves de API, tokens, o histórico bruto das conversas ou a base que roda na hospedagem. Para transferir a operação, inventarie o armazenamento, os registros históricos, as integrações e os agendamentos ativos no ambiente publicado. Faça um backup autorizado antes de migrar. Configure as credenciais nas contas de serviço autorizadas e dê ao desenvolvedor o acesso necessário para a função dele.
