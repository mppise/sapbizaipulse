import { useState } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface Preview {
  title: string;
  bodyTextPreview: string;
  fullBodyText: string;
  sourceRef: string;
}

export default function IngestUrlModal({ onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleFetch() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch<Preview>('/curator/ingest/url', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });
      setPreview(data);
      setTitle(data.title);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setSaving(true);
    try {
      await apiFetch('/curator/ingest/url/confirm', {
        method: 'POST',
        body: JSON.stringify({ title, bodyText: preview.fullBodyText, sourceRef: preview.sourceRef }),
      });
      showToast('URL entry saved.', 'success');
      onSaved();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,.4)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Add URL</h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {!preview ? (
              <div>
                <div className="mb-3">
                  <label className="form-label">Article URL</label>
                  <input
                    className="form-control"
                    type="url"
                    placeholder="https://community.sap.com/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleFetch} disabled={loading || !url.trim()}>
                  {loading ? <><span className="spinner-border spinner-border-sm me-2" />Fetching…</> : 'Fetch Page'}
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Content preview</label>
                  <textarea className="form-control font-monospace small" rows={8} readOnly value={preview.bodyTextPreview} />
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            {preview && (
              <button className="btn btn-primary" onClick={handleConfirm} disabled={saving || !title.trim()}>
                {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : 'Save Entry'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
