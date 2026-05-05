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
  const [approving, setApproving] = useState<string | null>(null);
  const [unapproving, setUnapproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setApproving(id);
    onBusyChange(true);
    try {
      await apiFetch(`/curator/entries/${id}/approve`, { method: 'POST' });
      onUpdate(id, { sensitivity: 'Newsletter-ready', approvedAt: new Date().toISOString() });
      showToast('Entry approved and embedding generated.', 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setApproving(null);
      onBusyChange(false);
    }
  }

  async function handleUnapprove(id: string) {
    setUnapproving(id);
    onBusyChange(true);
    try {
      await apiFetch(`/curator/entries/${id}/unapprove`, { method: 'POST' });
      onUpdate(id, { sensitivity: 'Internal', approvedAt: null });
      showToast('Entry unapproved — body text and embedding cleared.', 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setUnapproving(null);
      onBusyChange(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/curator/entries/${id}`, { method: 'DELETE' });
      onRemove(id);
      showToast('Entry deleted.', 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setDeleting(null);
    }
  }

  if (entries.length === 0) {
    return <p className="text-muted">No entries yet. Click "Fetch Latest" or add content manually.</p>;
  }

  return (
    <div className="item-grid">
      {entries.map((e) => {
        const isReady = e.sensitivity === 'Newsletter-ready';
        return (
          <div key={e.id} className={`item-card ${isReady ? 'item-card--ready' : 'item-card--pending'}`}>
            <div className="item-card-body">
              <div className="item-card-chips">
                <span className={`item-chip ${isReady ? 'item-chip--green' : 'item-chip--muted'}`}>
                  {isReady ? 'Approved' : 'New'}
                </span>
              </div>
              <div className="item-card-title">
                {e.sourceType !== 'pdf' ? (
                  <a href={e.sourceRef} target="_blank" rel="noreferrer">{e.title}</a>
                ) : (
                  <span>{e.title}</span>
                )}
              </div>
              <div className="item-card-dates">
                {e.publishedDate && (
                  <span className="item-date-meta">
                    <i className="bi bi-calendar-event me-1" />
                    {new Date(e.publishedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {e.approvedAt && (
                  <span className="item-date-meta item-date-meta--approved">
                    <i className="bi bi-check2-circle me-1" />
                    {new Date(e.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            <div className="item-card-actions">
              {e.sensitivity === 'Internal' && (
                <button
                  className="btn btn-sm btn-outline-success"
                  onClick={() => handleApprove(e.id)}
                  disabled={approving === e.id}
                >
                  {approving === e.id
                    ? <span className="spinner-border spinner-border-sm" />
                    : <><i className="bi bi-check-circle me-1" />Approve</>}
                </button>
              )}
              {e.sensitivity === 'Newsletter-ready' && (
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => handleUnapprove(e.id)}
                  disabled={unapproving === e.id}
                >
                  {unapproving === e.id
                    ? <span className="spinner-border spinner-border-sm" />
                    : <><i className="bi bi-x-circle me-1" />Revert</>}
                </button>
              )}
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleDelete(e.id, e.title)}
                disabled={deleting === e.id}
              >
                {deleting === e.id
                  ? <span className="spinner-border spinner-border-sm" />
                  : <i className="bi bi-trash" />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
