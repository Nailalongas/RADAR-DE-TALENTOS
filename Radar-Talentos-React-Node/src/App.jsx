import { useEffect, useState } from 'react';
import { getHealth } from './services/api.js';

export default function App() {
  const [status, setStatus] = useState('Verificando conexão…');
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(data => setStatus(data.ok ? 'Servidor conectado' : 'Servidor indisponível'))
      .catch(error => { if (error.name !== 'AbortError') setStatus('Servidor indisponível'); });
    return () => controller.abort();
  }, []);
  return <main>
    <header><h1>Radar de Talentos</h1><p role="status">{status}</p></header>
    <section>
      <h2>Ambiente de migração</h2>
      <p>O código atual e os protótipos estão na pasta <code>legado</code>. O Radar publicado continua disponível para consultar os dados e as coletas.</p>
      <a href="https://radar-talentos-naila.longasnaila.chatgpt.site/">Abrir Radar publicado</a>
    </section>
  </main>;
}

