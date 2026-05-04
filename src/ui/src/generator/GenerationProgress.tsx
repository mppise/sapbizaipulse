const SECTION_LABELS: Record<string, string> = {
  'executive-summary': 'The Big Picture',
  'leadership-execution': 'Strategy in Motion',
  'technical-insight': 'Under the Hood',
};

interface TopicProgress {
  title: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  sections: Record<string, string>;
  errorMessage?: string;
}

interface Props {
  topics: TopicProgress[];
}

export type { TopicProgress };

export default function GenerationProgress({ topics }: Props) {
  if (topics.length === 0) return null;

  return (
    <div className="mt-3">
      {topics.map((t) => (
        <div key={t.title} className="card mb-2">
          <div className="card-header d-flex align-items-center gap-2 py-2">
            {t.status === 'generating' && <span className="spinner-border spinner-border-sm" />}
            {t.status === 'done' && <i className="bi bi-check-circle-fill text-success fs-5" />}
            {t.status === 'error' && <i className="bi bi-x-circle-fill text-danger fs-5" />}
            {t.status === 'pending' && <i className="bi bi-circle text-muted fs-5" />}
            <strong className="small">{t.title}</strong>
          </div>
          {(t.status === 'generating' || t.status === 'done') && Object.keys(t.sections).length > 0 && (
            <div className="card-body py-2 small">
              {Object.entries(t.sections).map(([section, text]) => (
                <div key={section} className="mb-2">
                  <div className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>{SECTION_LABELS[section] ?? section.replace(/-/g, ' ')}</div>
                  <div className="font-monospace" style={{ whiteSpace: 'pre-wrap', fontSize: '0.78rem' }}>{text}</div>
                </div>
              ))}
            </div>
          )}
          {t.status === 'error' && (
            <div className="card-body py-2">
              <span className="text-danger small">{t.errorMessage}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
