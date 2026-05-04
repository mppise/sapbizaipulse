import { useState } from 'react';
import CuratorTab from './curator/CuratorTab';
import GeneratorTab from './generator/GeneratorTab';
import NewsletterTab from './newsletters/NewsletterTab';
import './app.css';

type Tab = 'curator' | 'generator' | 'newsletters';

const TABS: { id: Tab; label: string; icon: string; desc: string; color: string; bg: string }[] = [
  {
    id: 'curator',
    label: 'Content Curator',
    icon: 'bi-journals',
    desc: 'Fetch, review and approve source content',
    color: '#0070f3',
    bg: '#e8f2ff',
  },
  {
    id: 'generator',
    label: 'Newsletter Generator',
    icon: 'bi-stars',
    desc: 'Suggest topics and generate drafts with AI',
    color: '#1a7f4b',
    bg: '#e6f4ed',
  },
  {
    id: 'newsletters',
    label: 'Newsletters',
    icon: 'bi-send',
    desc: 'Review, publish and share newsletters',
    color: '#6b3fa0',
    bg: '#f0eaf8',
  },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('curator');
  const [busy, setBusy] = useState(false);

  const active = TABS.find(t => t.id === tab)!;

  return (
    <div className="app-shell">

      {/* Top bar */}
      <header className="app-topbar">
        <div className="app-topbar-brand">
          <div className="app-topbar-logo">
            <i className="bi bi-broadcast" />
          </div>
          <span className="app-topbar-title">SAP Business AI Pulse</span>
          <span className="app-topbar-subtitle">Internal Platform</span>
        </div>
        <div className="app-topbar-divider" />
        <div className="app-topbar-actions">
          <button
            className="topbar-btn"
            onClick={() => { localStorage.removeItem('apiKey'); window.location.reload(); }}
          >
            <i className="bi bi-key" /> Change API Key
          </button>
        </div>
      </header>

      {/* Busy strip */}
      {busy && <div className="busy-strip" />}

      {/* Body */}
      <div className="app-body">

        {/* Sidebar */}
        <aside className="app-sidebar">
          <div className="sidebar-section-label">Workspace</div>
          <ul className="sidebar-nav">
            {TABS.map(t => (
              <li key={t.id} className="sidebar-nav-item">
                <button
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => setTab(t.id)}
                  disabled={busy && tab !== t.id}
                  title={busy && tab !== t.id ? 'Please wait — process running' : undefined}
                >
                  <i className={`bi ${t.icon} nav-icon`} />
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="sidebar-footer">
            <div className="sidebar-footer-text">
              AI-curated content platform<br />for SAP customer engagement
            </div>
          </div>
        </aside>

        {/* Content area */}
        <div className="app-content">
          <div className="app-content-header">
            <div className="content-header-icon" style={{ background: active.bg, color: active.color }}>
              <i className={`bi ${active.icon}`} />
            </div>
            <div>
              <div className="content-header-title">{active.label}</div>
              <div className="content-header-desc">{active.desc}</div>
            </div>
          </div>
          <div className="app-content-body">
            {tab === 'curator'     && <CuratorTab     onBusyChange={setBusy} />}
            {tab === 'generator'   && <GeneratorTab   onBusyChange={setBusy} />}
            {tab === 'newsletters' && <NewsletterTab  onBusyChange={setBusy} />}
          </div>
        </div>

      </div>
    </div>
  );
}
