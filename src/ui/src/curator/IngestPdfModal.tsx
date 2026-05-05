import { useState, useRef } from 'react';
import { apiFetchRaw, apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface Preview {
  title: string;
  bodyTextPreview: string;
  fullBodyText: string;
}

export default function IngestPdfModal({ onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetchRaw('/curator/ingest/pdf', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      const p: Preview = body.data ?? body;
      setPreview(p);
      setTitle(p.title);
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
      await apiFetch('/curator/ingest/pdf/confirm', {
        method: 'POST',
        body: JSON.stringify({ title, fullBodyText: preview.fullBodyText, sourceRef: fileRef.current?.files?.[0]?.name ?? title }),
      });
      showToast('PDF entry saved.', 'success');
      onSaved();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,.4)' }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-sm-down">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Upload PDF</h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {!preview ? (
              <div>
                <div className="mb-3">
                  <input ref={fileRef} type="file" className="form-control" accept=".pdf" />
                  <div className="form-text">Max 20 MB · PDF files only</div>
                </div>
                <button className="btn btn-primary" onClick={handleUpload} disabled={loading}>
                  {loading ? <><span className="spinner-border spinner-border-sm me-2" />Extracting…</> : 'Extract Text'}
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Extracted preview</label>
                  <textarea className="form-control font-monospace small" rows={8} readOnly value={preview.fullBodyText} />
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
