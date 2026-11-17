# Estrutura e responsabilidades

```text
Radar-Talentos-React-Node/
├── src/
│   ├── main.jsx                       # Montagem do React
│   ├── App.jsx                        # Pesquisa, navegação e painel de evolução
│   ├── components/
│   │   ├── ResearchFilters.jsx        # Filtros de redes, categorias, período, temas e faixas
│   │   ├── ResultSummary.jsx          # Resumo da consulta e motivos de exclusão
│   │   ├── ResearchTable.jsx          # Tabelas de descoberta e crescimento com paginação
│   │   └── TalentDetailModal.jsx      # Detalhe e gráficos de evolução do talento
│   ├── domain/
│   │   ├── taxonomy.js                # Categorias, subcategorias e validação hierárquica
│   │   └── research.js                # Identidade, agrupamento, análise e exportação CSV
│   ├── services/api.js                # Consultas ao backend e cache de pesquisa
│   └── styles/global.css
├── server/src/
│   ├── app.mjs                        # Servidor HTTP, API e arquivos compilados
│   ├── index.mjs                      # Inicialização, host e porta
│   └── database/
│       ├── index.mjs                  # Conexão SQLite e aplicação de migrações
│       └── research.mjs               # Consultas de taxonomia, pesquisa, histórico e evolução
├── tests/
│   ├── server.test.mjs
│   ├── database.test.mjs
│   └── research.test.mjs
├── docs/
├── legado/
├── .vscode/tasks.json
├── index.html
├── package.json
└── vite.config.mjs
```

`src/services/` concentra as consultas à API. `server/src/app.mjs` cria o servidor sem abrir uma porta na importação, permitindo testes isolados. `server/src/index.mjs` inicia o processo.

No desenvolvimento, o Vite serve o React e encaminha `/api` ao Node. No build, o Vite escreve em `dist/`, na raiz deste projeto. O backend resolve esse diretório a partir de seu próprio arquivo e serve o frontend compilado.

As dependências do projeto principal ficam no `package.json` da raiz. Não há workspaces npm ou instalações separadas para frontend e backend. `node_modules/`, `dist/`, credenciais locais e cache npm ficam fora do versionamento.

O legado mantém sua estrutura original porque os scripts dependem dos caminhos internos. Execute seus comandos a partir de `legado/`; eles são independentes dos testes do Node. A cópia anterior foi preservada em `../../arquivo/radar-worker-anterior/`, sem substituir o conteúdo do ZIP.

## Persistência

- `database/migrations/`: versões SQL do modelo e taxonomia inicial.
- `server/src/database/index.mjs`: conexão SQLite e aplicação de migrações.
- `scripts/init-database.mjs`: criação e verificação da base local.
- `data/`: arquivos locais do banco, ignorados pelo Git.
- `tests/database.test.mjs`: persistência, restrições e integração.

O processo abre a base antes de iniciar o servidor HTTP e fecha a conexão ao encerrar. O endpoint de status verifica a conexão injetada. Veja [o banco de dados](banco-de-dados.md).

## Entrada da Vercel

`api/health.js` é uma função independente da inicialização do Node local. `vercel.json` publica o build Vite. A função de status não abre nem consulta o SQLite local. Consulte [a publicação na Vercel](../VERCEL.md).
