# Radar — persistência real dos bancos (implantação incremental)

Base: RADAR-DE-TALENTOS-BACKUP-GERAL.zip recebido em 19/11/2026. Inclui a correção anterior de seed sintético. Não substitui dashboards, CSS, menus, tabelas nem bancos de produção. O pacote não contém bancos ou segredos.

## Arquitetura

Node.js 22.12+ em uma máquina persistente (VPS Linux ou computador local para homologação), API e interface no mesmo domínio, worker de operação em processo separado. Docker Compose usa dois volumes externos nomeados: `radar-talentos-data` (ambos os SQLite, inbox e secrets) e `radar-talentos-backups` (cópias). Os dois serviços compartilham o volume de dados local com SQLite WAL. Não execute réplicas em outros hosts nem use filesystem de rede para SQLite WAL. Os volumes permanecem após recriar containers; não são protegidos contra remoção manual, falha do disco ou perda do servidor. Faça cópias fora do host.

A Vercel anterior é somente uma prévia temporária. A rota antiga agora retorna HTTP 503 em vez de abrir SQLite em /tmp. NÃO publique essa alteração na Vercel antes de homologar o servidor novo e configurar o redirecionamento, para não interromper a versão em uso. O link antigo pode redirecionar ao novo domínio; a URL final muda. Não encaminhe a API para a nova máquina por rewrite sem ajustar e testar autenticação, origem e proxy. A interface Node usa os arquivos atuais de dashboard, não modifica seu CSS.

## 1. Preparar no VS Code

Abra o diretório Radar-Talentos-React-Node, confirme que está na versão do backup atual, mescle os arquivos do patch e preserve as mudanças posteriores do Gemini. Execute `npm test` e `npm run build` com Node 22.12+. Não aplique sobre outra versão sem comparar. O código de seed incluído só carrega geografia: nunca recria métricas sintéticas. Se o sistema já recebeu a correção, mantenha a versão igual/mais segura. O Dockerfile não precisa instalar dependências npm para o dashboard nativo; o build local é uma checagem adicional.

## 2. Preparar origem de dados

Desative novas coletas no ambiente de origem durante a migração. Preserve o ZIP original completo, incluindo ambos os bancos. Se houver dados posteriores ao backup, exporte cópias consistentes do ambiente que realmente os armazena, não os arquivos SQLite enquanto estiverem sendo escritos. Use `VACUUM INTO`/backup SQLite ou pare todos os escritores e faça checkpoint WAL antes de copiar. Um banco temporário perdido na Vercel não pode ser recuperado por este patch.

Crie `migration-input/` na raiz do projeto, fora do Git. Coloque dois arquivos de snapshots:

- `migration-input/radar.sqlite`: para homologação, use `homologacao/radar-saneado.sqlite` do pacote RADAR-CORRECAO-DADOS-SINTETICOS.zip, renomeado para radar.sqlite. Para produção, audite e preserve os dados legítimos mais recentes. Não substitua dados atuais por uma cópia anterior automaticamente.
- `migration-input/discovery.sqlite`: snapshot do discovery.sqlite correspondente, auditado. O backup analisado tinha a base Discovery vazia.

Os arquivos de entrada devem ser legíveis pelo usuário Node UID 1000 no container; em Linux configure acesso com ACL ou ownership apropriado, mantendo diretório privado. Não use arquivos -wal/-shm soltos ou cópias feitas com escritores ativos. O importador confere as tabelas mínimas e integridade/foreign keys, cria cópias SQLite e recusa destino que contenha dados. Se o volume já contém uma instalação, não rode migrate; faça backup e procedimento de migração específico. Nunca delete o volume para contornar a proteção. Em caso de interrupção abrupta e sobras `.import-lock`/`.stage-*`, preserve tudo e inspecione antes de qualquer remoção manual; a aplicação não inicia sem marcador e ambos bancos.

## 3. Configurar serviços

Linux (shell), no servidor com Docker Engine + Compose plugin. Para teste local, Docker Desktop também é opção. Copie `config/persistence.env.example` para `.env.worker` se este arquivo não existir; caso exista, mescle as variáveis, sem sobrescrever credenciais de APIs. Configure RADAR_USER e uma senha aleatória de pelo menos 24 caracteres (não use exemplo). Preserve `config/operations.json`; se não existir, copie `config/operations.example.json` e habilite apenas fontes efetivamente autorizadas.

```
docker volume create radar-talentos-data
docker volume create radar-talentos-backups
docker compose --env-file .env.worker config --quiet
docker compose --env-file .env.worker build
docker compose --env-file .env.worker --profile migration run --rm --no-deps migrate
docker compose --env-file .env.worker up -d radar worker
docker compose --env-file .env.worker ps
curl -fsS http://127.0.0.1:3000/api/health
```

Os volumes novos normalmente recebem as permissões dos diretórios da imagem na primeira montagem. Caso Docker reporte EACCES, inspecione o volume; em volumes NOVOS e vazios pode inicializar a posse UID/GID 1000 via container temporário root antes da migração. Não faça chown indiscriminado de um volume antigo. Não execute `docker volume rm` nem `docker compose down -v`. O volume externo é independente do ciclo de vida do projeto Compose. Nunca rode o servidor anterior escrevendo nos arquivos novos simultaneamente durante a migração.

## 4. Homologar antes do corte

Abra http://127.0.0.1:3000 no host ou use um túnel SSH local; faça login. Confirme Home e Motor de Dados, contagens, filtros e fontes; cadastre candidato legítimo de teste com evidência ou importe um registro autorizado; anote ID e contagem. Rode `docker compose --env-file .env.worker up -d --force-recreate radar worker` e verifique o mesmo ID e o histórico após reiniciar. Confira logs do worker e backups. Os testes automáticos deste pacote já validaram reabertura entre processos Node, mas estes comandos Docker e a conectividade pública devem ser homologados no destino.

## 5. Acesso HTTPS e Vercel

Configure DNS de um domínio próprio apontando para a VPS, Caddy no host e firewall (80/443 e SSH restrito). Copie config/Caddyfile.example para configuração do Caddy, substituindo o domínio e mantendo o proxy para 127.0.0.1:3000. Não publique porta 3000 diretamente; Basic Auth exige TLS fora de localhost. Verifique o endereço HTTPS e login no navegador. Depois, execute na pasta do projeto:

```
node scripts/vercel-redirect.mjs https://SEU-DOMINIO-REAL
```

O script modifica vercel.json para redirecionar todos os caminhos para o servidor HTTPS (redirecionamento temporário). Revise o diff, faça deploy do projeto Vercel e teste o endereço antigo e os links internos. Não há domínio contratado/configurado neste pacote. Para rollback do redirecionamento restaure o vercel.json anterior somente se a versão anterior for segura, evitando reativar gravações em /tmp. A rota 503 é intencional em preview sem backend, não um erro de banco novo.

## 6. Backups e restauração

O worker existente roda continuamente e faz snapshots verificados diários dos dois bancos em `/app/backups/radar/` e `/app/backups/discovery/`, retenção de 14 dias. São snapshots independentes (não há uma transação distribuída); para um par consistente no tempo sem gravações, pare radar/worker e qualquer importador ou coletor adicional antes de executar o backup manual:

```
docker compose --env-file .env.worker stop radar worker
docker compose --env-file .env.worker run --rm --no-deps worker node --experimental-sqlite scripts/persistent-backup.mjs /app/backups
docker compose --env-file .env.worker up -d radar worker
```

O comando gera uma pasta com timestamp no volume de backups, com ambos os arquivos validados. Copie a pasta para armazenamento externo protegido (outro servidor, armazenamento de objetos com criptografia e restrição de acesso). O backup automático online não substitui esta cópia fora do host. Para restaurar, não sobrescreva dados existentes: use snapshots verificados como migration-input e um NOVO volume vazio. Defina RADAR_DATA_VOLUME e RADAR_BACKUP_VOLUME em uma configuração separada, crie esses volumes antes de rodar o importador e faça teste em outra porta RADAR_BIND_PORT, com outro projeto Compose (`-p radar-restore`). Valide os registros antes de substituir a instalação em uso. Não execute dois coletores contra as mesmas fontes sem controle durante restauração.

## Limites

O pacote não provisiona VPS/domínio/TLS nem publica na Vercel. A persistência dos dois bancos foi testada localmente, não no Docker real (Docker indisponível no ambiente de teste). O worker opera as tarefas já configuradas em operations.json; o refresh social do Discovery ainda tem comando e configuração próprios e precisa ser agendado/ativado separadamente, com credenciais reais. Persistência não equivale a coleta iniciada. Nenhuma API comercial foi contratada. Servidor local pode ser gratuito se já disponível, mas só funciona enquanto ligado; VPS, DNS/domínio, cópias externas e APIs podem ter custos.
