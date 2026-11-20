import Operations from "./Operations.jsx";
import EventTrends from './EventTrends.jsx';
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
    <EventTrends/><Operations/>

  </main>;
}

