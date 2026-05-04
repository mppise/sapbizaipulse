import { useState } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';
import type { ContentEntry } from './CuratorTab';

interface Props {
  entries: ContentEntry[];
  onRefresh: () => void;
  onBusyChange: (busy: boolean) => void;
}

export default function EntryList({ entries, onRefresh, onBusyChange }: Props) {
  const { showToast } = useToast();
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setApproving(id);
    onBusyChange(true);
    try {
      await apiFetch(`/curator/entries/${id}/approve`, { method: 'PATCH' });
      showToast('Entry approved and embedding generated.', 'success');
      onRefresh();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setApproving(null);
      onBusyChange(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/curator/entries/${id}`, { method: 'DELETE' });
      showToast('Entry deleted.', 'success');
      onRefresh();
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
    <div className="table-responsive">
      <table className="table table-sm table-hover align-middle">
        <thead className="table-light">
          <tr>
            <th>Title</th>
            <th>Source</th>
            <th>Ingested</th>
            <th>Approved</th>
            <th>Sensitivity</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>
                {e.sourceType !== 'pdf' ? (
                  <a
                    href={e.sourceRef}
                    target="_blank"
                    rel="noreferrer"
                    title={e.title}
                  >
                    {e.title.length > 96 ? e.title.slice(0, 96) + '…' : e.title}
                  </a>
                ) : (
                  <span title={e.title}>
                    {e.title.length > 96 ? e.title.slice(0, 96) + '…' : e.title}
                  </span>
                )}
              </td>
              <td>
                <span className="badge bg-secondary">{e.sourceType}</span>
              </td>
              <td className="text-nowrap small text-muted">
                {new Date(e.ingestionDate).toLocaleDateString()}
              </td>
              <td className="text-nowrap small">
                {e.approvedAt
                  ? <span className="text-success">{new Date(e.approvedAt).toLocaleDateString()}</span>
                  : <span className="text-muted">—</span>}
              </td>
              <td>
                <span
                  className={`badge ${e.sensitivity === 'Newsletter-ready' ? 'bg-success' : 'bg-warning text-dark'}`}
                >
                  {e.sensitivity}
                </span>
              </td>
              <td className="text-end text-nowrap">
                {e.sensitivity === 'Internal' && (
                  <button
                    className="btn btn-sm btn-outline-success me-1"
                    onClick={() => handleApprove(e.id)}
                    disabled={approving === e.id}
                  >
                    {approving === e.id ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-circle me-1" />Approve</>}
                  </button>
                )}
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleDelete(e.id, e.title)}
                  disabled={deleting === e.id}
                >
                  {deleting === e.id ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-trash me-1" />Delete</>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
