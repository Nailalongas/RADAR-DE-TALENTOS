# Radar de Talentos
Aplicação estática em português. Abra dist/index.html em um navegador moderno ou sirva dist com qualquer servidor HTTP.
## Funcionalidades
Filtros por data, categoria e rede; ranking por crescimento semanal médio entre redes; histórico por perfil; favoritos locais; importação e exportação CSV. Demonstração identificada com nomes fictícios.
## Dados reais
Importe CSV com nome,categoria,rede,data,seguidores,url. Use snapshots em ambas as extremidades da semana (tolerância de dois dias), seguidores não negativos e categorias/redes documentadas na ajuda. Dados ausentes são excluídos; não se inventa histórico.
A aplicação não coleta redes automaticamente. Uma versão com coleta automática requer integrações autorizadas, armazenamento no servidor e rotina de descoberta e atualização. Dados e favoritos desta versão ficam no navegador, sem sincronização entre aparelhos.
## Ranking
Média simples da variação percentual por rede elegível. Desempate pelo ganho absoluto. Não estima audiência única nem venda de ingressos. Gráfico mostra todas as redes elegíveis juntas, com cores e legenda, escala compartilhada de seguidores e posição temporal baseada nas datas reais; tabela detalhada inclui todas as redes.

Redes disponíveis: Instagram, YouTube e Facebook. Facebook aceita históricos de seguidores e participa do ranking por rede. Sem coleta automática.

## Arquivos de talentos
Cada clique válido em Buscar talentos salva uma cópia dos filtros, origem dos dados e ranking com histórico por rede. Consultas agrupadas pelo dia de São Paulo, com horário e exportação individual. Armazenamento local no navegador; sem retroatividade ou sincronização. Falha de armazenamento é informada.

Busca por nome completo ou parcial, sem distinção de maiúsculas e acentos, combinada aos demais filtros. Enter executa e salva a pesquisa. O nome é registrado nos Arquivos de talentos. Busca apenas nos dados disponíveis, sem descoberta automática na internet.
