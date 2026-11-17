# Migração do Radar

A pesquisa, os filtros, as regras de identidade/agrupamento e as rotas de leitura (`/api/taxonomy`, `/api/research`, `/api/history`, `/api/evolution` e `/api/spotify/history`) já estão migrados para React e Node.js com SQLite.

1. [Concluído] Migrar a pesquisa de `legado/web/` para componentes React, preservando os filtros e a identificação dos talentos.
2. Adaptar as demais rotas de escrita e coleta de `legado/worker/` (cadastro manual, curadoria, bloqueios e coletores) para o backend Node e definir uma implementação de armazenamento compatível em produção.
3. Migrar mapa e relatórios, verificando métricas, cobertura e dados ausentes.
4. Configurar autenticação, credenciais e agendamentos em ambiente isolado.
5. Validar a migração com backup antes de qualquer mudança na produção.

Consulte [o guia original](../legado/docs/guia-de-continuidade.md) e os protótipos em `legado/docs/prototipos/`. A organização dos arquivos não migra dados nem altera a hospedagem publicada.
