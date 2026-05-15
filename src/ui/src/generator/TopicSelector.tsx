import { useRef } from 'react';

export interface ClusteredTopic {
  title: string;
  entryIds: string[];
  contentPlan?: string[];
}

export interface TopicInput {
  type: 'clustered';
  title: string;
  entryIds: string[];
  contentPlan?: string[];
}

interface Props {
  topics: ClusteredTopic[];
  selected: TopicInput[];
  onChange: (topics: TopicInput[]) => void;
  onReorder: (topics: ClusteredTopic[]) => void;
}

function isSelected(title: string, selected: TopicInput[]): boolean {
  return selected.some((t) => t.title === title);
}

function toggle(topic: ClusteredTopic, selected: TopicInput[]): TopicInput[] {
  const input: TopicInput = { type: 'clustered', title: topic.title, entryIds: topic.entryIds, contentPlan: topic.contentPlan };
  if (isSelected(topic.title, selected)) return selected.filter((t) => t.title !== topic.title);
  return [...selected, input];
}

export default function TopicSelector({ topics, selected, onChange, onReorder }: Props) {
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  if (topics.length === 0) return <p className="text-muted small">No topics found for the active timeframe.</p>;

  function handleDragStart(i: number) {
    dragIndex.current = i;
  }

  function handleDragEnter(i: number) {
    dragOverIndex.current = i;
  }

  function handleDrop() {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) return;
    const reordered = [...topics];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    dragIndex.current = null;
    dragOverIndex.current = null;
    onReorder(reordered);
  }

  return (
    <div>
      <h6 className="text-muted small fw-semibold text-uppercase mb-2">
        Suggested Topics ({topics.length})
        <span className="ms-2 fw-normal text-muted" style={{ fontSize: '0.8em' }}>
          {selected.length} selected
        </span>
      </h6>
      <div className="item-grid">
        {topics.map((t, i) => {
          const checked = isSelected(t.title, selected);
          return (
            <div
              key={t.title}
              className={`item-card ${checked ? 'item-card--ready' : 'item-card--pending'}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{ cursor: 'grab' }}
            >
              <div className="item-card-body">
                <div className="item-card-title-row">
                  <i
                    className="bi bi-grip-vertical text-muted flex-shrink-0"
                    style={{ fontSize: '1.1rem', cursor: 'grab', opacity: 0.5, marginTop: '0.1rem' }}
                  />
                  <div
                    className="item-card-title"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onChange(toggle(t, selected))}
                  >
                    {t.title}
                  </div>
                  <div className="item-card-actions" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={checked}
                      onChange={() => onChange(toggle(t, selected))}
                    />
                  </div>
                </div>
                {t.contentPlan && t.contentPlan.length > 0 && (
                  <ul className="mb-0 mt-2 ps-3 small text-muted" style={{ lineHeight: 1.5 }}>
                    {t.contentPlan.map((bullet, j) => (
                      <li key={j}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
