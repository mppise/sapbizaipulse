import { useState } from 'react';

interface Draft {
  tone: 'professional' | 'conversational' | 'story-led' | 'peer-to-peer';
  body: string;
}

interface Props {
  drafts: Draft[];
  newsletterLink: string;
  linkLabel: string;
  onClose: () => void;
}

const TONE_META: Record<Draft['tone'], { label: string; icon: string; badge: string }> = {
  professional:   { label: 'Professional',   icon: 'bi-briefcase',       badge: 'bg-primary-subtle text-primary-emphasis' },
  conversational: { label: 'Conversational', icon: 'bi-chat-text',       badge: 'bg-success-subtle text-success-emphasis' },
  'story-led':    { label: 'Story-led',      icon: 'bi-book',            badge: 'bg-info-subtle text-info-emphasis' },
  'peer-to-peer': { label: 'Peer-to-peer',   icon: 'bi-people',          badge: 'bg-warning-subtle text-warning-emphasis' },
};

export default function EmailDraftModal({ drafts, newsletterLink, linkLabel, onClose }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCopy(draft: Draft) {
    const paragraphs = draft.body.split(/\n\n+/).map(p => `  <p>${p.trim()}</p>`).join('\n');
    const html = `<div style="font-family:verdana;font-size:14px;color:#1d2d3e;line-height:1.6;max-width:600px;">
  <p>Hi,</p>
${paragraphs}
  <p>Read it here: <a href="${newsletterLink}" style="color:#0070f3;font-weight:bold;">${linkLabel}</a></p>
</div>`;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
      ]);
      setCopied(draft.tone);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      await navigator.clipboard.writeText(draft.body + `\n\nRead it here: ${newsletterLink}`);
      setCopied(draft.tone);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  return (
    <div className="modal d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,.45)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title"><i className="bi bi-envelope me-2 text-primary" />Email Draft Options</h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body d-flex flex-column gap-3">
            <p className="text-muted small mb-0">Three options generated for your newsletter. Pick the one that fits your audience and copy it straight into your email composer.</p>
            {drafts.map(draft => {
              const meta = TONE_META[draft.tone];
              const isCopied = copied === draft.tone;
              return (
                <div key={draft.tone} className="border rounded p-3" style={{ background: '#fafbfc' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className={`badge rounded-pill px-2 py-1 ${meta.badge}`} style={{ fontSize: '.75rem' }}>
                      <i className={`bi ${meta.icon} me-1`} />{meta.label}
                    </span>
                    <button
                      className={`btn btn-sm ${isCopied ? 'btn-success' : 'btn-outline-primary'}`}
                      style={{ minWidth: '7rem' }}
                      onClick={() => handleCopy(draft)}
                    >
                      {isCopied
                        ? <><i className="bi bi-check2 me-1" />Copied!</>
                        : <><i className="bi bi-clipboard me-1" />Copy this</>}
                    </button>
                  </div>
                  <p className="mb-0 text-body" style={{ fontSize: '.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{draft.body}</p>
                </div>
              );
            })}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
