import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Home, MonitorSmartphone, ShoppingBag, Users } from 'lucide-react';
import { getApiHealth } from '../services/api';

const navigation = [
  { label: 'Inicio', icon: Home }, { label: 'Clientes', icon: Users },
  { label: 'Equipos', icon: MonitorSmartphone }, { label: 'Ventas', icon: ShoppingBag },
];
const descriptions: Record<string, string> = {
  Clientes: 'Cada persona tiene un único registro identificado por su DNI.',
  Equipos: 'Cada dispositivo conserva su propietario y el registro independiente de sus IMEIs.',
  Ventas: 'Una operación puede incluir varios equipos y un comprador distinto del propietario.',
};

export function App() {
  const [page, setPage] = useState('Inicio');
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    const controller = new AbortController();
    getApiHealth(controller.signal).then(ok => setHealth(ok ? 'online' : 'offline')).catch(() => { if (!controller.signal.aborted) setHealth('offline'); });
    return () => controller.abort();
  }, []);
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#inicio" onClick={() => setPage('Inicio')} aria-label="COMUNIC@TE POS, inicio">COMUNIC<span>@</span>TE <small>POS</small></a>
      <p className="nav-label">ESPACIO DE TRABAJO</p>
      <nav aria-label="Navegación principal">{navigation.map(({ label, icon: Icon }) => <button key={label} onClick={() => setPage(label)} aria-current={page === label ? 'page' : undefined} className={`nav-item ${page === label ? 'selected' : ''}`}><Icon size={19} aria-hidden="true" />{label}</button>)}</nav>
      <div className="sidebar-footer"><span className="tag">FASE 01</span><p>Una nueva base<br />para tu negocio.</p></div>
    </aside>
    <div className="main-panel">
      <header><span>COMUNIC@TE POS / <strong>{page}</strong></span><span className="connection" role="status"><Circle size={8} fill="currentColor" />{health === 'checking' ? 'Verificando API…' : health === 'online' ? 'API disponible' : 'API sin conexión'}</span></header>
      <main id="inicio">
        <p className="eyebrow">{page === 'Inicio' ? 'FUNDACIÓN DEL SISTEMA' : 'MÓDULO INICIAL'}</p>
        <h1>{page === 'Inicio' ? 'Todo empieza con una buena base.' : page}</h1>
        <p className="intro">{page === 'Inicio' ? 'Clientes, equipos y ventas conectados. Un registro claro para cada persona, cada dispositivo y cada operación.' : descriptions[page]}</p>
        {page === 'Inicio' ? <>
          <section className="module-list" aria-label="Módulos">{navigation.slice(1).map(({ label, icon: Icon }, index) => <button key={label} onClick={() => setPage(label)} className="module-row"><span className="module-number">0{index + 1}</span><Icon size={24} aria-hidden="true" /><span className="module-content"><strong>{label}</strong><span>{descriptions[label]}</span></span><ArrowRight size={20} aria-hidden="true" /></button>)}</section>
          <section className="foundation-note"><CheckCircle2 size={22} aria-hidden="true" /><div><h2>Construido desde cero</h2><p>La primera fase prepara la estructura del sistema. Los flujos comerciales se incorporarán en las siguientes etapas.</p></div></section>
        </> : <section className="empty-state"><MonitorSmartphone size={32} aria-hidden="true" /><h2>Espacio preparado</h2><p>La interfaz de {page.toLowerCase()} se habilitará en una siguiente fase. La base técnica ya contempla este módulo.</p><button onClick={() => setPage('Inicio')} className="back-button">Volver al inicio <ArrowRight size={16} /></button></section>}
      </main>
      <footer>COMUNIC@TE POS <span>Fundación · v0.1.0</span></footer>
    </div>
  </div>;
}
