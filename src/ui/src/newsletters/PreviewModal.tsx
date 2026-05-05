import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';

interface Props {
  newsletterId: string;
  filename: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function PreviewModal({ newsletterId, filename, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [markdown, setMarkdown] = useState<string>('');
  const [original, setOriginal] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ markdownContent: string }>(`/newsletters/${newsletterId}/preview`)
      .then((data) => {
        setMarkdown(data.markdownContent);
        setOriginal(data.markdownContent);
      })
      .catch((e: any) => { showToast(e.message); onClose(); })
      .finally(() => setLoading(false));
  }, [newsletterId]);

  const dirty = markdown !== original;

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/newsletters/${newsletterId}/content`, {
        method: 'PUT',
        body: JSON.stringify({ markdownContent: markdown }),
      });
      setOriginal(markdown);
      showToast('Newsletter saved.', 'success');
      onSaved?.();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,.4)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-fullscreen-sm-down">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Edit — {filename}
              {dirty && <span className="badge bg-warning text-dark ms-2 small">Unsaved changes</span>}
            </h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body p-0">
            {loading ? (
              <div className="text-center py-4"><span className="spinner-border" /></div>
            ) : (
              <textarea
                className="form-control font-monospace border-0 rounded-0"
                style={{ minHeight: '70vh', resize: 'vertical', fontSize: '0.82rem', lineHeight: 1.5 }}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                spellCheck={false}
              />
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !dirty || loading}
            >
              {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
