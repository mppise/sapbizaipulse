import { useState } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';
import type { ContentEntry } from './CuratorTab';

interface Props {
  entries: ContentEntry[];
  onUpdate: (id: string, patch: Partial<ContentEntry>) => void;
  onRemove: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
}

export default function EntryList({ entries, onUpdate, onRemove, onBusyChange }: Props) {
  const { showToast } = useToast();
  const [approving, setApproving] = useState<Set<string>>(new Set());
  const [unapproving, setUnapproving] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  async function handleApprove(id: string) {
    setApproving(prev => new Set(prev).add(id));
    onBusyChange(true);
    try {
      await apiFetch(`/curator/entries/${id}/approve`, { method: 'POST' });
      onUpdate(id, { sensitivity: 'Newsletter-ready', approvedAt: new Date().toISOString() });
      showToast('Entry approved and embedding generated.', 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setApproving(prev => { const s = new Set(prev); s.delete(id); return s; });
      onBusyChange(false);
    }
  }

  async function handleUnapprove(id: string) {
    setUnapproving(prev => new Set(prev).add(id));
    onBusyChange(true);
    try {
      await apiFetch(`/curator/entries/${id}/unapprove`, { method: 'POST' });
      onUpdate(id, { sensitivity: 'Internal', approvedAt: null });
      showToast('Entry unapproved — body text and embedding cleared.', 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setUnapproving(prev => { const s = new Set(prev); s.delete(id); return s; });
      onBusyChange(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(prev => new Set(prev).add(id));
    try {
      await apiFetch(`/curator/entries/${id}`, { method: 'DELETE' });
      onRemove(id);
      showToast('Entry deleted.', 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setDeleting(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  if (entries.length === 0) {
    return <p className="text-muted">No entries yet. Click "Fetch Latest" or add content manually.</p>;
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="item-grid">
      {entries.map((e) => {
        const isReady = e.sensitivity === 'Newsletter-ready';
        return (
          <div key={e.id} className={`item-card ${isReady ? 'item-card--ready' : 'item-card--pending'}`}>
            <div className="item-card-body">
              <div className="item-card-title-row">
                <div className="item-card-title">
                  {e.sourceType !== 'pdf' ? (
                    <a href={e.sourceRef} target="_blank" rel="noreferrer">{e.title}</a>
                  ) : (
                    <span>{e.title}</span>
                  )}
                </div>
                <div className="item-card-actions">
                  {e.sensitivity === 'Internal' && (
                    <button
                      className="btn btn-sm btn-outline-success"
                      title="Approve"
                      onClick={() => handleApprove(e.id)}
                      disabled={approving.has(e.id)}
                    >
                      {approving.has(e.id)
                        ? <span className="spinner-border spinner-border-sm" />
                        : <i className="bi bi-check-circle" />}
                    </button>
                  )}
                  {e.sensitivity === 'Newsletter-ready' && (
                    <button
                      className="btn btn-sm btn-outline-warning"
                      title="Revert approval"
                      onClick={() => handleUnapprove(e.id)}
                      disabled={unapproving.has(e.id)}
                    >
                      {unapproving.has(e.id)
                        ? <span className="spinner-border spinner-border-sm" />
                        : <i className="bi bi-x-circle" />}
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    title="Delete"
                    onClick={() => handleDelete(e.id, e.title)}
                    disabled={deleting.has(e.id)}
                  >
                    {deleting.has(e.id)
                      ? <span className="spinner-border spinner-border-sm" />
                      : <i className="bi bi-trash" />}
                  </button>
                </div>
              </div>
              <div className="item-card-dates">
                <span className="item-date-meta">
                  <span className="item-date-label">Published:</span>
                  {e.publishedDate ? fmtDate(e.publishedDate) : '—'}
                </span>
                <span className="item-date-meta">
                  <span className="item-date-label">Fetched:</span>
                  {fmtDate(e.ingestionDate)}
                </span>
                <span className="item-date-meta">
                  <span className="item-date-label">Approved:</span>
                  {e.approvedAt ? fmtDate(e.approvedAt) : '—'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
