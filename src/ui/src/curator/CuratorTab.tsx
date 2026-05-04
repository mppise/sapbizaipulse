import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';
import EntryList from './EntryList';
import IngestPdfModal from './IngestPdfModal';
import IngestUrlModal from './IngestUrlModal';

export interface ContentEntry {
  id: string;
  title: string;
  sourceType: string;
  sourceRef: string;
  ingestionDate: string;
  approvedAt: string | null;
  sensitivity: 'Internal' | 'Newsletter-ready';
}

type ProgressStatus = 'processing' | 'ingested' | 'skipped' | 'error';

interface ProgressRow {
  url: string;
  title?: string;
  status: ProgressStatus;
  detail?: string;
}

export default function CuratorTab({ onBusyChange, setHeaderActions }: { onBusyChange: (busy: boolean) => void; setHeaderActions: (node: ReactNode) => void }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [progress, setProgress] = useState<ProgressRow[]>([]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ContentEntry[]>('/curator/entries');
      setEntries(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleFetch = useCallback(async () => {
    setFetching(true);
    setProgress([]);
    onBusyChange(true);
    const apiKey = localStorage.getItem('apiKey') ?? '';

    try {
      const res = await fetch('/api/v1/curator/fetch', {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const dispatch = (event: string, data: Record<string, unknown>) => {
        if (event === 'article_processing') {
          setProgress(p => [...p, { url: data.url as string, title: data.title as string, status: 'processing' }]);
        } else if (event === 'article_ingested') {
          setProgress(p => p.map(r => r.url === data.url ? { ...r, status: 'ingested' } : r));
        } else if (event === 'article_skipped') {
          setProgress(p => p.map(r => r.url === data.url
            ? { ...r, status: 'skipped', detail: data.reason as string }
            : r));
        } else if (event === 'article_error') {
          setProgress(p => p.map(r => r.url === data.url
            ? { ...r, status: 'error', detail: data.message as string }
            : r));
        } else if (event === 'fetch_complete') {
          const added = data.added as number;
          const skipped = data.skipped as number;
          const errors = data.errors as number;
          const variant = errors > 0 ? 'warning' : 'success';
          showToast(`Fetched: ${added} added, ${skipped} skipped${errors > 0 ? `, ${errors} failed` : ''}`, variant);
          loadEntries();
        } else if (event === 'fetch_error') {
          showToast(data.message as string);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() ?? '';
        for (const msg of messages) {
          const lines = msg.split('\n');
          let event = '', dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }
          if (event && dataStr) {
            try { dispatch(event, JSON.parse(dataStr)); } catch { /* ignore unparseable */ }
          }
        }
      }
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setFetching(false);
      onBusyChange(false);
    }
  }, [showToast, onBusyChange, loadEntries]);

  // Keep a stable ref so the header-actions effect doesn't need handleFetch as a dep
  const handleFetchRef = useRef(handleFetch);
  useEffect(() => { handleFetchRef.current = handleFetch; }, [handleFetch]);

  useEffect(() => {
    setHeaderActions(
      <div className="d-flex gap-2 ms-auto me-2">
        <button className="btn btn-sm" style={{ background: '#0070f3', color: '#fff', borderColor: '#0070f3' }} onClick={() => handleFetchRef.current()} disabled={fetching}>
          {fetching ? <><span className="spinner-border spinner-border-sm me-1" />Fetching…</> : <><i className="bi bi-cloud-download me-1" />Fetch Latest</>}
        </button>
        <button className="btn btn-sm" style={{ background: '#e65c00', color: '#fff', borderColor: '#e65c00' }} onClick={() => setShowPdf(true)} disabled={fetching}>
          <i className="bi bi-file-earmark-pdf me-1" />Upload PDF
        </button>
        <button className="btn btn-sm" style={{ background: '#1a7f4b', color: '#fff', borderColor: '#1a7f4b' }} onClick={() => setShowUrl(true)} disabled={fetching}>
          <i className="bi bi-link-45deg me-1" />Add URL
        </button>
      </div>
    );
  }, [fetching, setHeaderActions]);

  const statusBadge = (s: ProgressStatus) => {
    if (s === 'processing') return <span className="badge rounded-pill text-bg-primary" style={{ fontSize: '.65rem' }}>Processing…</span>;
    if (s === 'ingested')   return <span className="badge rounded-pill text-bg-success" style={{ fontSize: '.65rem' }}>Ingested</span>;
    if (s === 'skipped')    return <span className="badge rounded-pill text-bg-secondary" style={{ fontSize: '.65rem' }}>Skipped</span>;
    if (s === 'error')      return <span className="badge rounded-pill text-bg-danger" style={{ fontSize: '.65rem' }}>Error</span>;
  };

  const currentRow = progress.findLast(r => r.status === 'processing') ?? progress[progress.length - 1];
  const previousRow = currentRow ? progress.slice(0, progress.indexOf(currentRow)).findLast(r => r.status !== 'processing') : undefined;

  return (
    <div>
      {progress.length > 0 && (
        <div className="mb-3 border rounded px-3 py-2" style={{ background: '#f8f9fb', fontSize: '.8rem' }}>
          {previousRow && (
            <div className="d-flex align-items-center gap-2 pb-1 mb-1" style={{ borderBottom: '1px solid #eee', opacity: 0.7 }}>
              <div className="text-truncate flex-grow-1" title={previousRow.url}>
                {previousRow.title ?? previousRow.url}
              </div>
              {statusBadge(previousRow.status)}
            </div>
          )}
          {currentRow && (
            <div className="d-flex align-items-center gap-2">
              <div className="text-truncate flex-grow-1" title={currentRow.url}>
                {currentRow.title ?? currentRow.url}
              </div>
              {statusBadge(currentRow.status)}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <span className="spinner-border" />
        </div>
      ) : (
        <EntryList entries={entries} onRefresh={loadEntries} onBusyChange={onBusyChange} />
      )}

      {showPdf && (
        <IngestPdfModal
          onClose={() => setShowPdf(false)}
          onSaved={() => { setShowPdf(false); loadEntries(); }}
        />
      )}
      {showUrl && (
        <IngestUrlModal
          onClose={() => setShowUrl(false)}
          onSaved={() => { setShowUrl(false); loadEntries(); }}
        />
      )}
    </div>
  );
}
