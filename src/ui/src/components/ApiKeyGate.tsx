import React, { useState } from 'react';
import '../app.css';

interface Props {
  children: React.ReactNode;
}

export default function ApiKeyGate({ children }: Props) {
  const [key, setKey] = useState(localStorage.getItem('apiKey') ?? '');
  const [saved, setSaved] = useState(!!localStorage.getItem('apiKey'));
  const [input, setInput] = useState('');

  if (saved && key) return <>{children}</>;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    localStorage.setItem('apiKey', input.trim());
    setKey(input.trim());
    setSaved(true);
  }

  return (
    <div className="gate-bg">
      <div className="gate-card">
        <div className="gate-card-header">
          <div className="gate-logo">
            <i className="bi bi-broadcast" />
          </div>
          <div>
            <div className="gate-card-title">SAP Business AI Pulse</div>
            <div className="gate-card-subtitle">Internal Newsletter Platform</div>
          </div>
        </div>
        <div className="gate-card-body">
          <form onSubmit={handleSave}>
            <label className="gate-label" htmlFor="api-key-input">API Key</label>
            <input
              id="api-key-input"
              type="password"
              className="gate-input"
              placeholder="Enter your X-API-Key"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button className="gate-btn" type="submit">
              <i className="bi bi-arrow-right-circle" /> Enter Platform
            </button>
          </form>
          <div className="gate-note">Access is restricted to authorized users only.</div>
        </div>
      </div>
    </div>
  );
}
