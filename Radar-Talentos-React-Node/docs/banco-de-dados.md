# Banco de dados local

O backend usa SQLite em `data/radar.sqlite`. Não é necessário instalar um serviço de banco ou um pacote npm. A integração usa [node:sqlite](https://nodejs.org/download/release/v22.12.0/docs/api/sqlite.html), ainda experimental no Node 22. Os comandos incluem `--experimental-sqlite` para compatibilidade com Node 22.12.

## Criar e verificar

Na pasta do projeto:

```sh
npm run db:init
npm test
```

O backend também abre o banco e aplica as migrações ao iniciar. Rodar a inicialização novamente preserva os registros existentes. O comando exibe o caminho, as migrações aplicadas e a quantidade de categorias, e verifica a integridade do banco.

Para escolher outro arquivo, defina `RADAR_DATABASE_PATH` no ambiente. Caminhos relativos são resolvidos a partir da raiz do projeto; por padrão, o arquivo fica em `data/radar.sqlite`.

Exemplo no PowerShell:

```powershell
$env:RADAR_DATABASE_PATH = 'data/radar-desenvolvimento.sqlite'
npm run db:init
npm run dev
```

## Modelo

| Tabela | Conteúdo |
| --- | --- |
| talents | Identidade do talento, nome, tipo e bloqueio. |
| categories / topics | Categorias e temas do legado. |
| talent_categories / talent_topics | Classificação de cada talento. |
| social_accounts | Contas por rede, associação ao talento e evidência de identidade. |
| network_metrics | Métrica permitida em cada rede. |
| metric_snapshots | Valor observado por conta, métrica e dia. |
| collection_runs | Estado e resultado das tentativas de coleta. |
| schema_migrations | Versões aplicadas e verificação do conteúdo das migrações. |

Um talento pode ter várias contas. A combinação rede e identificador externo, quando informado, é única. A URL também é única por rede; o banco não normaliza URLs, portanto futuras rotas de cadastro devem normalizá-las antes de gravar. Confirmar identidade exige uma fonte. Um tema só pode ser associado quando o talento pertence à categoria correspondente.

Seguidores do Instagram, inscritos do YouTube e ouvintes mensais do Spotify são armazenados com métricas distintas. O histórico aceita um registro por conta, métrica e dia, exige valor inteiro não negativo e fonte. Ausência de coleta é ausência de registro; não é substituída por zero. O dia deve estar no formato YYYY-MM-DD; a camada de coleta deverá definir o dia em São Paulo antes da gravação.

## Migrações e arquivos

As migrações SQL estão em `database/migrations/`. Cada arquivo é aplicado em transação e registrado com seu hash. Não edite migrações aplicadas: adicione um novo arquivo numerado. O esquema habilita chaves estrangeiras e usa WAL; o timeout de espera por escrita é de cinco segundos.

O arquivo do banco e seus auxiliares ficam fora do versionamento. Para fazer uma cópia simples, encerre o backend normalmente e copie o arquivo SQLite depois do fechamento das conexões.

## Escopo atual

O banco inicia vazio de talentos, contas e métricas. Apenas categorias, temas e tipos de métrica são cadastrados na criação. Não foram importados dados da hospedagem. O backend abre o banco na inicialização e verifica a conexão em `/api/health`; as rotas de cadastro, pesquisa, mapa, relatórios e coleta ainda precisam ser migradas.
