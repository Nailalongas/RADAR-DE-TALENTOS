# Radar de Talentos — catálogo nacional de eventos

**Versão com foco exclusivo em eventos e atrações anunciadas.** O painel principal e as rotinas operacionais não coletam nem usam métricas de redes sociais. As tabelas e o código das fases anteriores permanecem para preservação do histórico, mas não participam do fluxo atual.

## Iniciar no VS Code

Requer Node.js 22.12 ou superior. Abra esta pasta e execute os comandos abaixo. O novo painel é servido pelo Node, sem instalação de React, Vite ou dependências npm.

```sh
npm run db:init
npm run ops:setup
npm test
npm run build
npm start
```

Abra http://127.0.0.1:3000. A base vazia mostra claramente que não há eventos importados. A API e o painel rodam no mesmo servidor. Não use o antigo `dev:web` para iniciar o painel atual. Para carregar a base geográfica nacional:

```sh
npm run geo:sync -- 2025
```

Se a malha territorial falhar, o catálogo municipal já baixado permanece disponível. Para carregar apenas o cadastro de municípios: `npm run geo:sync -- 2025 --catalog-only`. Para usar arquivos oficiais previamente baixados na pasta `data/geography/2025`: `npm run geo:sync -- 2025 --offline`. Sem coordenadas o filtro de raio é limitado. Sem catálogo municipal os conectores não conseguem associar os eventos às cidades.

## Ativação de fontes reais

1. Cadastre uma aplicação no portal oficial da Ticketmaster: https://developer.ticketmaster.com/ e obtenha a chave autorizada.
2. No terminal PowerShell, defina a variável de ambiente local. Não envie credenciais pelo chat, não as inclua no código nem no Git.

```powershell
$env:TICKETMASTER_API_KEY = 'SUA_CHAVE_REAL'
npm run ops:setup -- ticketmaster 'Aplicação autorizada no portal de desenvolvedores'
npm run ops:check
npm run ops:once
npm start
```

Se o servidor já estiver aberto, reinicie-o no terminal que contém a variável de ambiente. Você também pode clicar em **Sincronizar agora**. A coleta respeita limites, tentativas, trava por tarefa e não repete indiscriminadamente uma coleta bem-sucedida no mesmo dia. A chave/documentação da API não garante o catálogo inteiro da plataforma no Brasil.

## Operação diária

Em outro terminal com o mesmo diretório, banco, configuração e variáveis de credencial, execute `npm run ops:worker`. Mantenha esse processo ativo em um servidor persistente. Para produção, use a configuração de autenticação e a infraestrutura em `compose.yaml`; a API e o worker precisam das mesmas credenciais. Reinicie o worker quando alterar a configuração. Não utilize a publicação isolada na Vercel para operação real (não executa o banco persistente e o coletor).

## Documentação atual

Leia **[docs/radar-eventos-operacional.md](docs/radar-eventos-operacional.md)** antes de ativar outras integrações. Os documentos das fases 1–6 são históricos e podem descrever funcionalidades que deixaram de ser prioridades. Antes de migrar uma instalação existente, faça backup de `data/radar.sqlite` e preserve a configuração e as credenciais autorizadas. A migração 009 não apaga históricos.

## Dashboard atual

Consulte [Radar de audiência e tendências](docs/radar-audiencia-e-tendencias.md): audiência por mídia e região em `/audience.html`, oferta das ticketeiras em `/`.
