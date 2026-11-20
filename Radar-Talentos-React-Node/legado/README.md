# Radar de Talentos — Referência do Legado (Worker)

Aplicação em português para descobrir talentos e acompanhar métricas do Instagram, YouTube e Spotify. Interface e API originais eram empacotadas em um Worker ESM. Esta pasta preserva as regras de domínio e a suíte de 21 arquivos de teste como referência de especificação durante a migração para React e Node.js.

## Verificação

Requer Node.js 22 ou superior. Os scripts não precisam de dependências externas. Execute dentro da pasta `legado`:

```sh
npm test
npm run build
npm run validate:artifact
```

`npm run check` executa as três etapas. `npm run test:ui` executa apenas os testes da interface.

## Estrutura

- `web/`: interface original, estilos e páginas legais.
- `worker/`: API, integrações e regras de domínio.
- `scripts/`: build, testes e validação.
- `docs/`: documentação e protótipos.
- `.openai/`: configuração da hospedagem original.

Consulte [a arquitetura](docs/arquitetura.md) e [o guia de continuidade](docs/guia-de-continuidade.md).
