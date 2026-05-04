import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';
import PreviewModal from './PreviewModal';

interface Newsletter {
  id: string;
  filename: string;
  status: 'draft' | 'published';
  createdAt: string;
  publishedAt?: string;
  topicList?: string[];
}

export default function NewsletterTab({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const { showToast } = useToast();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<Newsletter | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Newsletter[]>('/newsletters');
      setNewsletters(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish(n: Newsletter) {
    setPublishing(n.id);
    onBusyChange(true);
    try {
      await apiFetch(`/newsletters/${n.id}/publish`, { method: 'POST' });
      showToast(`"${n.filename}" published.`, 'success');
      load();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setPublishing(null);
      onBusyChange(false);
    }
  }

  async function handleDraftMessage(n: Newsletter) {
    const date = n.publishedAt
      ? new Date(n.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date(n.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const topicCount = n.topicList?.length ?? 0;
    const topicCountLabel = `${topicCount} topic${topicCount !== 1 ? 's' : ''}`;
    const link = `${window.location.origin}/published/${n.filename}.html`;

    const topicsHtml = n.topicList && n.topicList.length > 0
      ? `<ol style="margin:0 0 16px;padding-left:20px;">${n.topicList.map(t => `<li style="margin-bottom:4px;">${t}</li>`).join('')}</ol>`
      : '<p style="color:#666;">Topics not available.</p>';

    const html = `
<div style="font-family:verdana;font-size:14px;color:#1d2d3e;line-height:1.6;max-width:600px;">
  <p>Hi,</p>
  <p>Another update on SAP Business AI is here! I’ve put together a curated set of insights highlighting some of the latest developments and innovations in this space.</p>
  <p><strong>Read it online here:</strong><br/>
  <a href="${link}" style="color:#0070f3;">${link}</a></p>
  <div style="border-top:1px solid #e8eaed;margin-top:24px;padding-top:12px;padding-bottom:12px;">
    <p>This edition covers <strong>${topicCountLabel}</strong>:</p>
  </div>
  ${topicsHtml}
</div>`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      showToast('Formatted email copied — paste it into your email composer.', 'success');
    } catch {
      showToast('Clipboard write failed — please copy manually.', 'warning');
    }
  }

  async function handleDelete(n: Newsletter) {
    if (!confirm(`Delete "${n.filename}"?`)) return;
    setDeleting(n.id);
    onBusyChange(true);
    try {
      await apiFetch(`/newsletters/${n.id}`, { method: 'DELETE' });
      showToast('Newsletter deleted.', 'success');
      load();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setDeleting(null);
      onBusyChange(false);
    }
  }

  return (
    <div>
      <div className="d-flex mb-3">
        <button className="btn btn-outline-light border ms-auto" onClick={load} disabled={loading}>
          ↺ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5"><span className="spinner-border" /></div>
      ) : newsletters.length === 0 ? (
        <p className="text-muted">No newsletters yet. Generate one from the Generator tab.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Filename</th>
                <th>Status</th>
                <th>Topics</th>
                <th>Created</th>
                <th>Published</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {newsletters.map((n) => (
                <tr key={n.id}>
                  <td className="small font-monospace">{n.filename}</td>
                  <td>
                    <span className={`badge ${n.status === 'published' ? 'bg-success' : 'bg-secondary'}`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="small text-muted">
                    {n.topicList ? n.topicList.join(', ') : '—'}
                  </td>
                  <td className="small text-nowrap text-muted">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </td>
                  <td className="small text-nowrap text-muted">
                    {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="text-end text-nowrap">
                    {n.status === 'draft' && (
                      <>
                        <button
                          className="btn btn-sm btn-outline-secondary me-1"
                          onClick={() => setPreview(n)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => handlePublish(n)}
                          disabled={publishing === n.id}
                        >
                          {publishing === n.id ? <span className="spinner-border spinner-border-sm" /> : 'Publish'}
                        </button>
                      </>
                    )}
                    {n.status === 'published' && (
                      <>
                        <a
                          href={`/published/${n.filename}.html`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-success me-1"
                        >
                          View
                        </a>
                        <button
                          className="btn btn-sm btn-outline-secondary me-1"
                          onClick={() => handleDraftMessage(n)}
                          title="Copy email draft to clipboard"
                        >
                          <i className="bi bi-envelope" /> Draft Message
                        </button>
                      </>
                    )}
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(n)}
                      disabled={deleting === n.id}
                    >
                      {deleting === n.id ? <span className="spinner-border spinner-border-sm" /> : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <PreviewModal
          newsletterId={preview.id}
          filename={preview.filename}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
