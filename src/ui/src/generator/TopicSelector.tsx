export interface ClusteredTopic {
  title: string;
  entryIds: string[];
}

export interface TopicInput {
  type: 'clustered';
  title: string;
  entryIds: string[];
}

interface Props {
  topics: ClusteredTopic[];
  selected: TopicInput[];
  onChange: (topics: TopicInput[]) => void;
}

function isSelected(title: string, selected: TopicInput[]): boolean {
  return selected.some((t) => t.title === title);
}

function toggle(topic: ClusteredTopic, selected: TopicInput[]): TopicInput[] {
  const input: TopicInput = { type: 'clustered', title: topic.title, entryIds: topic.entryIds };
  if (isSelected(topic.title, selected)) return selected.filter((t) => t.title !== topic.title);
  return [...selected, input];
}

export default function TopicSelector({ topics, selected, onChange }: Props) {
  return (
    <div>
      <h6 className="text-muted small fw-semibold text-uppercase mb-2">
        Suggested Topics ({topics.length})
        <span className="ms-2 fw-normal text-muted" style={{ fontSize: '0.8em' }}>
          {selected.length} selected
        </span>
      </h6>
      {topics.length === 0 && <p className="text-muted small">No topics found for the active timeframe.</p>}
      <div className="list-group list-group-flush" style={{ maxHeight: 'min(400px, 50vh)', overflowY: 'auto' }}>
        {topics.map((t) => {
          const checked = isSelected(t.title, selected);
          return (
            <label
              key={t.title}
              className={`list-group-item list-group-item-action d-flex gap-2 ${checked ? 'active' : ''}`}
            >
              <input
                type="checkbox"
                className="form-check-input flex-shrink-0 mt-1"
                checked={checked}
                onChange={() => onChange(toggle(t, selected))}
              />
              <div className="small fw-semibold">{t.title}</div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
