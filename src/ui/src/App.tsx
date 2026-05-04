import { useState, ReactNode } from 'react';
import CuratorTab from './curator/CuratorTab';
import GeneratorTab from './generator/GeneratorTab';
import NewsletterTab from './newsletters/NewsletterTab';
import './app.css';

type Tab = 'curator' | 'generator' | 'newsletters';

const TABS: { id: Tab; label: string; icon: string; desc: string; color: string; bg: string; step: number; stepLabel: string }[] = [
  {
    id: 'curator',
    label: 'Content Curator',
    icon: 'bi-journals',
    desc: 'Fetch, review and approve source content',
    color: '#0070f3',
    bg: '#e8f2ff',
    step: 1,
    stepLabel: 'Curate Content',
  },
  {
    id: 'generator',
    label: 'Newsletter Generator',
    icon: 'bi-stars',
    desc: 'Suggest topics and generate drafts with AI',
    color: '#1a7f4b',
    bg: '#e6f4ed',
    step: 2,
    stepLabel: 'Generate Draft',
  },
  {
    id: 'newsletters',
    label: 'Newsletters',
    icon: 'bi-send',
    desc: 'Review, publish and share newsletters',
    color: '#6b3fa0',
    bg: '#f0eaf8',
    step: 3,
    stepLabel: 'Review & Publish',
  },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('curator');
  const [busy, setBusy] = useState(false);
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  function handleTabChange(t: Tab) {
    setHeaderActions(null);
    setTab(t);
  }

  const active = TABS.find(t => t.id === tab)!;
  const activeIdx = TABS.findIndex(t => t.id === tab);
  const nextTab = activeIdx < TABS.length - 1 ? TABS[activeIdx + 1] : null;
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

      {/* How it works banner */}
      <div className="workflow-banner">
        <i className="bi bi-info-circle-fill workflow-banner-icon" />
        <div className="workflow-banner-text">
          <strong>How it works — 3 steps:&nbsp;</strong>
          <span><strong>Step 1 · Curate</strong> — Fetch or upload SAP AI content and approve entries.</span>
          <span className="workflow-banner-sep">›</span>
          <span><strong>Step 2 · Generate</strong> — Select topics and generate a newsletter draft with AI.</span>
          <span className="workflow-banner-sep">›</span>
          <span><strong>Step 3 · Publish</strong> — Review, edit, and publish the draft as HTML.</span>
        </div>
      </div>

      {/* Workflow stepper bar */}
      <nav className="workflow-bar">
        <div className="workflow-steps">
          {TABS.map((t, idx) => {
            const isPast = idx < activeIdx;
            const isCurrent = idx === activeIdx;
            return (
              <div key={t.id} className="workflow-step-group">
                <button
                  className={`workflow-step ${isCurrent ? 'workflow-step--active' : isPast ? 'workflow-step--done' : 'workflow-step--future'}`}
                  onClick={() => handleTabChange(t.id)}
                  disabled={busy && !isCurrent}
                  title={busy && !isCurrent ? 'Please wait — process running' : undefined}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <div className={`wf-badge ${isCurrent ? 'wf-badge--active' : isPast ? 'wf-badge--done' : 'wf-badge--future'}`} aria-label={`Step ${t.step} of 3`}>
                    {isPast
                      ? <i className="bi bi-check-lg" />
                      : <i className={`bi ${t.icon}`} />}
                  </div>
                  <div className="wf-label">
                    <span className="wf-label-step">Step {t.step}</span>
                    <span className="wf-label-name">{t.stepLabel}</span>
                  </div>
                </button>
                {idx < TABS.length - 1 && (
                  <div className="workflow-arrow" aria-hidden="true">
                    <i className="bi bi-chevron-right" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

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
          {headerActions}
          {nextTab ? (
            <button
              className="btn btn-outline-primary btn-sm ms-auto"
              onClick={() => handleTabChange(nextTab.id)}
              disabled={busy}
            >
              Next: {nextTab.stepLabel} <i className="bi bi-arrow-right ms-1" />
            </button>
          ) : (
            <button
              className="btn btn-outline-secondary btn-sm ms-auto"
              onClick={() => handleTabChange(TABS[0].id)}
              disabled={busy}
            >
              <i className="bi bi-arrow-counterclockwise me-1" /> Start Over
            </button>
          )}
        </div>
        <div className="app-content-body">
          {tab === 'curator'     && <CuratorTab     onBusyChange={setBusy} setHeaderActions={setHeaderActions} />}
          {tab === 'generator'   && <GeneratorTab   onBusyChange={setBusy} onNavigate={handleTabChange} />}
          {tab === 'newsletters' && <NewsletterTab  onBusyChange={setBusy} />}
        </div>
      </div>

    </div>
  );
}
