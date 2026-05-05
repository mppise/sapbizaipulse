import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';
import EntryList from './EntryList';
import IngestPdfModal from './IngestPdfModal';

export interface ContentEntry {
  id: string;
  title: string;
  sourceType: string;
  sourceRef: string;
  ingestionDate: string;
  publishedDate: string | null;
  approvedAt: string | null;
  sensitivity: 'Internal' | 'Newsletter-ready';
}

interface CurrentProgress {
  url: string;
  title?: string;
}

export default function CuratorTab({ onBusyChange, setHeaderActions }: { onBusyChange: (busy: boolean) => void; setHeaderActions: (node: ReactNode) => void }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<CurrentProgress | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ContentEntry[]>('/curator/entries');
      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => new Date(b.ingestionDate).getTime() - new Date(a.ingestionDate).getTime())
        : [];
      setEntries(sorted);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleFetch = useCallback(async () => {
    setFetching(true);
    setCurrentProgress(null);
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
          setCurrentProgress({ url: data.url as string, title: data.title as string });
        } else if (event === 'article_ingested') {
          setCurrentProgress(null);
          // Immediately prepend the new entry to the list
          setEntries(prev => [{
            id: '',
            title: data.title as string,
            sourceType: 'auto-fetch',
            sourceRef: data.url as string,
            ingestionDate: new Date().toISOString(),
            publishedDate: null,
            approvedAt: null,
            sensitivity: 'Internal',
          } as ContentEntry, ...prev]);
        } else if (event === 'article_skipped' || event === 'article_error') {
          setCurrentProgress(null);
        } else if (event === 'fetch_complete') {
          const added = data.added as number;
          const skipped = data.skipped as number;
          const errors = data.errors as number;
          const variant = errors > 0 ? 'warning' : 'success';
          showToast(`Fetched: ${added} added, ${skipped} skipped${errors > 0 ? `, ${errors} failed` : ''}`, variant);
          // Reload to get accurate IDs and ingestion dates from the server
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
      <div className="d-flex gap-2 flex-wrap">
        <button className="btn btn-sm" style={{ background: '#1a7f4b', color: '#fff', borderColor: '#1a7f4b' }} onClick={() => handleFetchRef.current()} disabled={fetching}>
          {fetching ? <><span className="spinner-border spinner-border-sm me-1" />Fetching…</> : <><i className="bi bi-cloud-download me-1" />Fetch Latest</>}
        </button>
        <button className="btn btn-sm" style={{ background: '#6b3fa0', color: '#fff', borderColor: '#6b3fa0' }} onClick={() => setShowPdf(true)} disabled={fetching}>
          <i className="bi bi-file-earmark-pdf me-1" />Upload PDF
        </button>
      </div>
    );
  }, [fetching, setHeaderActions]);

  return (
    <div>
      {currentProgress && (
        <div className="mb-3 border rounded px-3 py-2 d-flex align-items-center gap-2" style={{ background: '#f8f9fb', fontSize: '.8rem' }}>
          <span className="spinner-border spinner-border-sm text-primary flex-shrink-0" />
          <div className="text-truncate flex-grow-1" title={currentProgress.url}>
            {currentProgress.title ?? currentProgress.url}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <span className="spinner-border" />
        </div>
      ) : (
        <EntryList
            entries={entries}
            onUpdate={(id, patch) => setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))}
            onRemove={(id) => setEntries(prev => prev.filter(e => e.id !== id))}
            onBusyChange={onBusyChange}
          />
      )}

      {showPdf && (
        <IngestPdfModal
          onClose={() => setShowPdf(false)}
          onSaved={() => { setShowPdf(false); loadEntries(); }}
        />
      )}
    </div>
  );
}
