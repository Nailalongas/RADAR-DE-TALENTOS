# Vercel — não indicada para a operação atual

O Radar de Talentos focado em eventos depende de um servidor Node com banco SQLite persistente e processo coletor contínuo. O deploy isolado da Vercel não oferece a API e o worker desta arquitetura. Os arquivos de preview da fase anterior permanecem como registro histórico, mas não devem ser usados para operar o catálogo. Para iniciar localmente ou publicar em um servidor persistente, siga [README.md](README.md) e [docs/radar-eventos-operacional.md](docs/radar-eventos-operacional.md).
