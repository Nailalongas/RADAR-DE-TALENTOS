# Radar de Talentos

Aplicação em português para descobrir talentos e acompanhar métricas do Instagram, YouTube e Spotify. Interface e API são empacotadas em um Worker ESM. Integrações e histórico dependem dos serviços configurados na hospedagem.

## Começar

Requer Node.js 22 ou superior, com npm. Os scripts atuais não precisam de dependências externas. Execute dentro da pasta `Radar-Talentos`:

```sh
npm test
npm run build
npm run validate:artifact
```

`npm run check` executa as três etapas. `npm run test:ui` executa apenas os testes da interface.

## Estrutura

- `web/`: interface, estilos e páginas legais.
- `worker/`: API, integrações e regras de domínio.
- `scripts/`: build, testes e validação.
- `docs/`: documentação e protótipos.
- `.openai/`: configuração da hospedagem existente.
- `dist/`: artefato gerado pelo build.

Edite as fontes: `worker/index.js` e `dist/` são sobrescritos pelo build. O artefato precisa de um ambiente compatível com Workers; abrir um HTML isolado não reproduz a aplicação completa.

Consulte [a arquitetura](docs/arquitetura.md) e [o guia de continuidade](docs/guia-de-continuidade.md).
