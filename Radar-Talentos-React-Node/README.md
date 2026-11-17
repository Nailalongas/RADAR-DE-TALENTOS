# Radar de Talentos — React e Node.js

Projeto principal para migração do Radar. A interface React consulta a rota de status do backend Node. Pesquisa, mapa, relatórios, armazenamento e coletas ainda precisam ser migrados.

## Desenvolvimento

Use Node.js 22.12 ou superior. Abra `../Radar-Talentos.code-workspace` no VS Code e execute nesta pasta:

```sh
npm install
```

Em dois terminais:

```sh
npm run dev
```

```sh
npm run dev:web
```

Abra o endereço mostrado pelo Vite. O backend usa `http://127.0.0.1:3000`; o Vite encaminha `/api` para essa porta.

## Verificação e build

```sh
npm test
npm run build
npm start
```

Os testes verificam o servidor local. Após o build, `npm start` serve o frontend compilado e a API. Configure `HOST` e `PORT` no ambiente de hospedagem quando necessário. Se alterar a porta do backend no desenvolvimento, ajuste também o proxy em `vite.config.mjs`.

## Organização

- `src/`: frontend React, estilos e acesso à API.
- `server/src/`: aplicação HTTP e inicialização do backend.
- `tests/`: testes da versão Node.
- `docs/`: arquitetura e plano de migração.
- `legado/`: fontes, testes e documentação do Worker original.
- `dist/`: frontend compilado, gerado pelo Vite.
- `.vscode/`: tarefas para executar no VS Code.

Consulte [a arquitetura](docs/arquitetura.md) e [a migração](docs/migracao.md). O pacote não contém as credenciais nem a base da hospedagem.

## Banco de dados

O banco local SQLite fica em `data/radar.sqlite`. Execute `npm run db:init` para criá-lo; o backend também aplica as migrações ao iniciar. Não exige instalação adicional de dependências. Consulte [o modelo e os comandos](docs/banco-de-dados.md). A base é criada sem talentos ou métricas fictícias.

## Vercel

A configuração da estrutura inicial está em `vercel.json` e `api/health.js`. Para publicar este repositório, selecione `Radar-Talentos-React-Node` como Root Directory. Consulte [o guia Vercel](VERCEL.md), incluindo a diferença entre o banco local e o armazenamento necessário em produção.
