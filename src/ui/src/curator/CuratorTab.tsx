import { useState, useEffect, useCallback } from 'react';
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

export default function CuratorTab({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

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

  async function handleFetch() {
    setFetching(true);
    onBusyChange(true);
    try {
      const result = await apiFetch<{ added: number; skipped: number; errors: { sourceRef: string; message: string }[] }>(
        '/curator/fetch',
        { method: 'POST' },
      );
      const variant = result.errors.length > 0 ? 'warning' : 'success';
      const errSummary = result.errors.length > 0 ? ` (${result.errors.length} failed)` : '';
      showToast(`Fetched: ${result.added} added, ${result.skipped} skipped${errSummary}`, variant);
      if (result.errors.length > 0) {
        result.errors.forEach((e) => showToast(`${e.sourceRef}: ${e.message}`, 'danger'));
      }
      loadEntries();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setFetching(false);
      onBusyChange(false);
    }
  }

  return (
    <div>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <button className="btn btn-primary" onClick={handleFetch} disabled={fetching}>
          {fetching ? (
            <><span className="spinner-border spinner-border-sm me-2" />Fetching…</>
          ) : (
            'Fetch Latest'
          )}
        </button>
        <button className="btn btn-outline-secondary" onClick={() => setShowPdf(true)}>
          Upload PDF
        </button>
        <button className="btn btn-outline-secondary" onClick={() => setShowUrl(true)}>
          Add URL
        </button>
        <button className="btn btn-outline-light border ms-auto" onClick={loadEntries} disabled={loading}>
          ↺ Refresh
        </button>
      </div>

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
