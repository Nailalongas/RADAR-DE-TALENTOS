# Migração do Radar

A base atual contém uma tela de conexão e o endpoint `GET /api/health`.

1. Migrar a pesquisa de `legado/web/` para componentes React, preservando os filtros e a identificação dos talentos.
2. Adaptar as rotas de `legado/worker/` para o backend Node e definir uma implementação de armazenamento compatível.
3. Migrar mapa e relatórios, verificando métricas, cobertura e dados ausentes.
4. Configurar autenticação, credenciais e agendamentos em ambiente isolado.
5. Validar a migração com backup antes de qualquer mudança na produção.

Consulte [o guia original](../legado/docs/guia-de-continuidade.md) e os protótipos em `legado/docs/prototipos/`. A organização dos arquivos não migra dados nem altera a hospedagem publicada.
