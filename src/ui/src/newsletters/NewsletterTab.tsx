import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';
import PreviewModal from './PreviewModal';
import EmailDraftModal from './EmailDraftModal';

interface Newsletter {
  id: string;
  filename: string;
  status: 'draft' | 'published';
  createdAt: string;
  publishedAt?: string;
  topicList?: string[];
}

interface EmailDraft {
  tone: 'professional' | 'conversational' | 'story-led' | 'peer-to-peer';
  body: string;
}

interface EmailDraftState {
  drafts: EmailDraft[];
  newsletterLink: string;
  linkLabel: string;
}

export default function NewsletterTab({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const { showToast } = useToast();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<Newsletter | null>(null);

  const [unpublishing, setUnpublishing] = useState<string | null>(null);
  const [draftingEmail, setDraftingEmail] = useState<string | null>(null);
  const [emailDraftState, setEmailDraftState] = useState<EmailDraftState | null>(null);

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
    const link = `${window.location.origin}/published/${n.filename}.html`;
    const dateMatch = n.filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    const linkLabel = dateMatch
      ? `Newsletter ${new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : 'Read the Newsletter';
    setDraftingEmail(n.id);
    onBusyChange(true);
    try {
      const result = await apiFetch<{ drafts: EmailDraft[] }>(`/newsletters/${n.id}/email-summary`, { method: 'POST' });
      setEmailDraftState({ drafts: result.drafts, newsletterLink: link, linkLabel });
    } catch (e: any) {
      showToast(`Failed to generate email drafts: ${e.message ?? 'unknown error'}`, 'warning');
    } finally {
      setDraftingEmail(null);
      onBusyChange(false);
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
            const fmtDate = (iso: string) =>
              new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <div key={n.id} className={`item-card ${isPublished ? 'item-card--ready' : 'item-card--pending'}`}>
                <div className="item-card-body">
                  <div className="item-card-title-row">
                    <div className="item-card-title font-monospace" style={{ fontSize: '.92rem' }}>{n.filename}</div>
                    <div className="item-card-actions">
                      {n.status === 'draft' && (
                        <>
                          <button className="btn btn-sm btn-outline-secondary" title="Edit" onClick={() => setPreview(n)}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="btn btn-sm btn-outline-primary" title="Publish" onClick={() => handlePublish(n)} disabled={publishing === n.id}>
                            {publishing === n.id
                              ? <span className="spinner-border spinner-border-sm" />
                              : <i className="bi bi-send" />}
                          </button>
                        </>
                      )}
                      {n.status === 'published' && (
                        <>
                          <a href={`/published/${n.filename}.html`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-success" title="View">
                            <i className="bi bi-box-arrow-up-right" />
                          </a>
                          <button className="btn btn-sm btn-outline-secondary" title="Copy email draft" onClick={() => handleDraftMessage(n)} disabled={draftingEmail === n.id}>
                            {draftingEmail === n.id ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-envelope" />}
                          </button>
                          <button className="btn btn-sm btn-outline-warning" title="Unpublish" onClick={() => handleUnpublish(n)} disabled={unpublishing === n.id}>
                            {unpublishing === n.id
                              ? <span className="spinner-border spinner-border-sm" />
                              : <i className="bi bi-arrow-counterclockwise" />}
                          </button>
                        </>
                      )}
                      <button className="btn btn-sm btn-outline-danger" title="Delete" onClick={() => handleDelete(n)} disabled={deleting === n.id}>
                        {deleting === n.id
                          ? <span className="spinner-border spinner-border-sm" />
                          : <i className="bi bi-trash" />}
                      </button>
                    </div>
                  </div>
                  {n.topicList && n.topicList.length > 0 && (
                    <div className="item-card-topics">{n.topicList.join(' · ')}</div>
                  )}
                  <div className="item-card-dates">
                    <span className="item-date-meta">
                      <span className="item-date-label">Created:</span>
                      {fmtDate(n.createdAt)}
                    </span>
                    <span className="item-date-meta">
                      <span className="item-date-label">Published:</span>
                      {n.publishedAt ? fmtDate(n.publishedAt) : '—'}
                    </span>
                  </div>
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

      {emailDraftState && (
        <EmailDraftModal
          drafts={emailDraftState.drafts}
          newsletterLink={emailDraftState.newsletterLink}
          linkLabel={emailDraftState.linkLabel}
          onClose={() => setEmailDraftState(null)}
        />
      )}
    </div>
  );
}
