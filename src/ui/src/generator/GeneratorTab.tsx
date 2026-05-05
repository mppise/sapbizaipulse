import { useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { apiFetch } from '../api';
import { useToast } from '../components/ToastContainer';
import TopicSelector, { type ClusteredTopic, type TopicInput } from './TopicSelector';
import GenerationProgress, { type TopicProgress } from './GenerationProgress';

interface SuggestResult {
  topics: ClusteredTopic[];
  timeframeFrom: string;
  timeframeTo: string;
  entryCount: number;
  message: string;
}

type Tab = 'curator' | 'generator' | 'newsletters';

export default function GeneratorTab({ onBusyChange, onNavigate, setHeaderActions }: { onBusyChange: (busy: boolean) => void; onNavigate: (tab: Tab) => void; setHeaderActions: (node: ReactNode) => void }) {
  const { showToast } = useToast();
  const [topics, setTopics] = useState<ClusteredTopic[]>([]);
  const [selected, setSelected] = useState<TopicInput[]>([]);
  const [suggestMeta, setSuggestMeta] = useState<{ entryCount: number; from: string; message: string } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [topicsProgress, setTopicsProgress] = useState<TopicProgress[]>([]);
  const [doneMessage, setDoneMessage] = useState('');
  const autoNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSuggest = useCallback(async () => {
    setSuggesting(true);
    onBusyChange(true);
    setSelected([]);
    setTopicsProgress([]);
    setDoneMessage('');
    setSuggestMeta(null);
    try {
      const result = await apiFetch<SuggestResult>('/generator/topics/suggest');
      const clustered = Array.isArray(result.topics) ? result.topics : [];
      setTopics(clustered);
      setSelected(clustered.map((t) => ({ type: 'clustered', title: t.title, entryIds: t.entryIds })));
      setSuggestMeta({
        entryCount: result.entryCount,
        from: result.timeframeFrom,
        message: result.message,
      });
      if (result.message) showToast(result.message);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setSuggesting(false);
      onBusyChange(false);
    }
  }, [showToast, onBusyChange]);

  const handleSuggestRef = useRef(handleSuggest);
  useEffect(() => { handleSuggestRef.current = handleSuggest; }, [handleSuggest]);

  useEffect(() => { handleSuggestRef.current(); }, []);

  const handleGenerateRef = useRef<() => void>(() => {});

  useEffect(() => {
    setHeaderActions(
      <div className="d-flex gap-2 flex-wrap">
        <button className="btn btn-sm" style={{ background: '#1a7f4b', color: '#fff', borderColor: '#1a7f4b' }} onClick={() => handleSuggestRef.current()} disabled={suggesting || generating}>
          {suggesting ? <><span className="spinner-border spinner-border-sm me-1" />Suggesting…</> : <><i className="bi bi-arrow-clockwise me-1" />Suggest Topics</>}
        </button>
        {selected.length > 0 && (
          <button className="btn btn-sm" style={{ background: '#6b3fa0', color: '#fff', borderColor: '#6b3fa0' }} onClick={() => handleGenerateRef.current()} disabled={generating || suggesting}>
            {generating
              ? <><span className="spinner-border spinner-border-sm me-1" />Generating…</>
              : <><i className="bi bi-stars me-1" />Generate Newsletter ({selected.length} topic{selected.length !== 1 ? 's' : ''})</>}
          </button>
        )}
      </div>
    );
  }, [suggesting, generating, selected, setHeaderActions]);

  async function handleGenerate() {
    if (selected.length === 0) { showToast('Select at least one topic.', 'warning'); return; }
    setGenerating(true);
    onBusyChange(true);
    setDoneMessage('');
    if (autoNavTimer.current) { clearTimeout(autoNavTimer.current); autoNavTimer.current = null; }
    const progress: TopicProgress[] = selected.map((t) => ({
      title: t.title,
      status: 'pending',
      sections: {},
    }));
    setTopicsProgress([...progress]);

    const apiKey = localStorage.getItem('apiKey') ?? '';

    try {
      const res = await fetch('/api/v1/generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ topics: selected }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function dispatch(event: string, data: Record<string, unknown>) {
        setTopicsProgress((prev) => {
          const next = prev.map((t) => ({ ...t, sections: { ...t.sections } }));
          const idx = next.findIndex((t) => t.title === data.topicTitle);
          if (event === 'topic_start' && idx >= 0) next[idx].status = 'generating';
          if (event === 'section_chunk' && idx >= 0) {
            const sec = data.section as string;
            next[idx].sections[sec] = (next[idx].sections[sec] ?? '') + (data.chunk as string);
          }
          if (event === 'topic_complete' && idx >= 0) next[idx].status = 'done';
          if (event === 'topic_error' && idx >= 0) {
            next[idx].status = 'error';
            next[idx].errorMessage = data.message as string;
          }
          return next;
        });

        if (event === 'generation_complete') {
          setDoneMessage(`Draft saved — newsletter ID: ${data.newsletterId}`);
          showToast('Draft saved — opening Newsletters…', 'success');
          autoNavTimer.current = setTimeout(() => {
            onNavigate('newsletters');
          }, 2000);
        }
        if (event === 'generation_failed') {
          showToast(`Generation failed: ${data.message}`);
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() ?? '';
        for (const msg of messages) {
          const lines = msg.split('\n');
          let event = '';
          let dataStr = '';
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
      setGenerating(false);
      onBusyChange(false);
    }
  }

  handleGenerateRef.current = handleGenerate;

  function handleNextCta() {
    if (autoNavTimer.current) { clearTimeout(autoNavTimer.current); autoNavTimer.current = null; }
    onNavigate('newsletters');
  }

  const fromDate = suggestMeta?.from ? new Date(suggestMeta.from).toLocaleDateString() : '';

  return (
    <div>
      {suggesting && (
        <div className="d-flex align-items-center gap-2 mb-3 text-muted small">
          <span className="spinner-border spinner-border-sm" />
          Suggesting topics…
        </div>
      )}

      {suggestMeta && !suggesting && (
        <div className="mb-3">
          <span className="text-muted small">
            {suggestMeta.entryCount} entr{suggestMeta.entryCount !== 1 ? 'ies' : 'y'} since {fromDate}
          </span>
        </div>
      )}

      {topics.length > 0 && !generating && (
        <TopicSelector
          topics={topics}
          selected={selected}
          onChange={setSelected}
        />
      )}

      {topicsProgress.length > 0 && <GenerationProgress topics={topicsProgress} />}

      {doneMessage && (
        <div className="mt-3">
          <div className="alert alert-success">
            {doneMessage}
          </div>
          <button className="btn btn-primary" onClick={handleNextCta}>
            Next: Review Newsletters <i className="bi bi-arrow-right ms-1" />
          </button>
        </div>
      )}
    </div>
  );
}
