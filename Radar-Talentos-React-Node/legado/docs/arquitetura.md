# Arquitetura do Legado

A interface fica em `web/`; API, coleta e regras de domínio ficam em `worker/`. Os caminhos existentes foram preservados para manter a compatibilidade dos scripts.

## Build

`scripts/build-real.mjs` insere estilos e código do mapa no HTML e concatena os módulos do Worker em ordem explícita. Gera `worker/index.js`, `dist/server/index.js` e copia o manifesto para `dist/.openai/hosting.json`. Edite as fontes, pois esses arquivos são sobrescritos. Novos módulos precisam entrar na lista ordenada do build; eles compartilham escopo após a concatenação.

O roteamento entrega páginas legais, encaminha `/api/*` à API e serve a interface nas demais rotas. O armazenamento usa o binding `BUCKET` da hospedagem.

## Verificação

`npm test` executa automaticamente os arquivos `scripts/test-*.mjs`. Os testes usam cenários locais e simulações; não comprovam a disponibilidade das integrações em produção. A validação do artefato verifica o manifesto e a exportação ESM `default.fetch`.

## Ambientes

Use hospedagem e armazenamento isolados no desenvolvimento. `.openai/hosting.json` aponta para o projeto existente. Configure credenciais no serviço de hospedagem e não salve senhas ou bases de produção no repositório. O build local não publica alterações.
