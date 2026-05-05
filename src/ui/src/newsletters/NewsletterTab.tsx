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

  const [unpublishing, setUnpublishing] = useState<string | null>(null);

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
      setNewsletters(prev => prev.map(x => x.id === n.id ? { ...x, status: 'published', publishedAt: new Date().toISOString() } : x));
      showToast(`"${n.filename}" published.`, 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setPublishing(null);
      onBusyChange(false);
    }
  }

  async function handleDraftMessage(n: Newsletter) {
    const topicCount = n.topicList?.length ?? 0;
    const topicCountLabel = `${topicCount} topic${topicCount !== 1 ? 's' : ''}`;
    const link = `${window.location.origin}/published/${n.filename}.html`;

    const topicsHtml = n.topicList && n.topicList.length > 0
      ? `<ol style="margin:0 0 16px;padding-left:20px;">${n.topicList.map(t => `<li style="margin-bottom:4px;">${t}</li>`).join('')}</ol>`
      : '<p style="color:#666;">Topics not available.</p>';

    const html = `
<div style="font-family:verdana;font-size:14px;color:#1d2d3e;line-height:1.6;max-width:600px;">
  <p>Hi,</p>
  <p>Another update on SAP Business AI is here! I've put together a curated set of insights highlighting some of the latest developments and innovations in this space.</p>
  <p><strong>Read it online here:</strong><br/>
  <a href="${link}" style="color:#0070f3;">${link}</a></p>
  <div style="border-top:1px solid #e8eaed;margin-top:24px;padding-top:12px;padding-bottom:12px;">
    <p>This edition covers <strong>${topicCountLabel}</strong>:</p>
  </div>
  ${topicsHtml}
</div>`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
      ]);
      showToast('Formatted email copied — paste it into your email composer.', 'success');
    } catch {
      showToast('Clipboard write failed — please copy manually.', 'warning');
    }
  }

  async function handleUnpublish(n: Newsletter) {
    if (!confirm(`Unpublish "${n.filename}"? The public URL will stop working.`)) return;
    setUnpublishing(n.id);
    onBusyChange(true);
    try {
      await apiFetch(`/newsletters/${n.id}/unpublish`, { method: 'POST' });
      setNewsletters(prev => prev.map(x => x.id === n.id ? { ...x, status: 'draft', publishedAt: undefined } : x));
      showToast(`"${n.filename}" unpublished — you can now edit and re-publish.`, 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setUnpublishing(null);
      onBusyChange(false);
    }
  }

  async function handleDelete(n: Newsletter) {
    if (!confirm(`Delete "${n.filename}"?`)) return;
    setDeleting(n.id);
    onBusyChange(true);
    try {
      await apiFetch(`/newsletters/${n.id}`, { method: 'DELETE' });
      setNewsletters(prev => prev.filter(x => x.id !== n.id));
      showToast('Newsletter deleted.', 'success');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setDeleting(null);
      onBusyChange(false);
    }
  }

  return (
    <div>
      {loading ? (
        <div className="text-center py-5"><span className="spinner-border" /></div>
      ) : newsletters.length === 0 ? (
        <p className="text-muted">No newsletters yet. Generate one from the Generator tab.</p>
      ) : (
        <div className="item-grid">
          {newsletters.map((n) => {
            const isPublished = n.status === 'published';
            return (
              <div key={n.id} className={`item-card ${isPublished ? 'item-card--ready' : 'item-card--pending'}`}>
                <div className="item-card-body">
                  <div className="item-card-chips">
                    <span className={`item-chip ${isPublished ? 'item-chip--green' : 'item-chip--muted'}`}>
                      {isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div className="item-card-title font-monospace" style={{ fontSize: '.92rem' }}>{n.filename}</div>
                  {n.topicList && n.topicList.length > 0 && (
                    <div className="item-card-topics">{n.topicList.join(' · ')}</div>
                  )}
                  <div className="item-card-dates">
                    <span className="item-date-meta">
                      <i className="bi bi-plus-circle me-1" />
                      {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {n.publishedAt && (
                      <span className="item-date-meta item-date-meta--approved">
                        <i className="bi bi-send me-1" />
                        {new Date(n.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="item-card-actions">
                  {n.status === 'draft' && (
                    <>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setPreview(n)}>
                        <i className="bi bi-pencil me-1" />Edit
                      </button>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => handlePublish(n)} disabled={publishing === n.id}>
                        {publishing === n.id
                          ? <span className="spinner-border spinner-border-sm" />
                          : <><i className="bi bi-send me-1" />Publish</>}
                      </button>
                    </>
                  )}
                  {n.status === 'published' && (
                    <>
                      <a href={`/published/${n.filename}.html`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-success">
                        <i className="bi bi-box-arrow-up-right me-1" />View
                      </a>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => handleDraftMessage(n)} title="Copy email draft to clipboard">
                        <i className="bi bi-envelope me-1" />Draft
                      </button>
                      <button className="btn btn-sm btn-outline-warning" onClick={() => handleUnpublish(n)} disabled={unpublishing === n.id}>
                        {unpublishing === n.id
                          ? <span className="spinner-border spinner-border-sm" />
                          : <><i className="bi bi-arrow-counterclockwise me-1" />Unpublish</>}
                      </button>
                    </>
                  )}
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(n)} disabled={deleting === n.id}>
                    {deleting === n.id
                      ? <span className="spinner-border spinner-border-sm" />
                      : <i className="bi bi-trash" />}
                  </button>
                </div>
              </div>
            );
          })}
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
