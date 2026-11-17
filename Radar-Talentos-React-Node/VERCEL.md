# Publicar a estrutura inicial na Vercel

Este projeto publica a interface React e a função `api/health.js`. O servidor em `server/src/` e o banco SQLite local não são executados pela função Vercel.

## Configuração

1. Envie o projeto para o repositório `Nailalongas/RADAR-DE-TALENTOS`.
2. Importe o repositório em https://vercel.com/new.
3. Como o repositório contém a pasta de trabalho completa, configure **Root Directory** como `Radar-Talentos-React-Node`. Se enviar apenas o conteúdo desta pasta ao Git, use a raiz do repositório.
4. Selecione **Vite**, **Node.js 22.x**, build `npm run build` e saída `dist`.
5. Publique e copie o endereço informado pela Vercel. Nenhum endereço de produção está configurado neste pacote.

`vercel.json` define o framework e o build. A pasta `api/` contém a função de status; ela suporta GET e HEAD e rejeita outros métodos. Localmente, `npm run dev` continua usando o servidor Node e o SQLite. Na Vercel, o status indica apenas que a função responde, sem verificar o banco local.

## Banco e funcionalidades

O banco em `data/radar.sqlite` permanece local. A Vercel não oferece o sistema de arquivos persistente compartilhado necessário para usar esse arquivo como banco de produção: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel. Antes de migrar cadastro, pesquisa e coletas, será necessário conectar um banco persistente externo e adaptar a camada de acesso.

Pesquisa, mapa, relatórios e coletas ainda estão no legado. Esta publicação é somente da estrutura inicial.

## Verificação

Execute `npm test` e `npm run build` antes de publicar. O build depende da instalação das dependências React e Vite com `npm install`. Após publicar, confirme a página inicial e `/api/health` no endereço retornado pela Vercel.
