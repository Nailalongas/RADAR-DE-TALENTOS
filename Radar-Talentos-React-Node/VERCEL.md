# Vercel e persistência

As funções da Vercel não devem hospedar os SQLite locais do Radar: `/tmp` é efêmero. A API de prévia retorna 503 para impedir gravações em bancos temporários. Use o servidor Node permanente com os dois bancos em volume persistente. A URL Vercel pode redirecionar para o domínio HTTPS desse servidor, somente depois da homologação. Consulte [PERSISTENCIA.md](PERSISTENCIA.md) para importar, iniciar, verificar, fazer backup e configurar o redirecionamento. Não faça o deploy desta mudança antes de o servidor permanente estar disponível.
