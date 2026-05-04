#!/usr/bin/env bash
# SpecGantry engagement contract — runs at SessionStart + PostCompact

set -euo pipefail

CONTRACT_PATH="${CLAUDE_PROJECT_DIR:-.}/.claude/CONTRACT.md"

if [[ ! -f "$CONTRACT_PATH" ]]; then
  python3 -c "
import json, sys
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'SessionStart',
    'additionalContext': sys.argv[1]
  }
}))" "❌ SpecGantry: CONTRACT.md not found — do not proceed until this is resolved."
  exit 1
fi

CONTENT=$(< "$CONTRACT_PATH")

# Read hook event from stdin (Claude Code sends JSON with hook_event_name)
HOOK_EVENT=$(python3 -c "
import json, sys
raw = sys.stdin.read().strip()
if raw:
    print(json.loads(raw).get('hook_event_name', 'SessionStart'))
else:
    print('SessionStart')
" 2>/dev/null || echo "SessionStart")

python3 -c "
import json, sys
event = sys.argv[1]
content = sys.argv[2]
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': event,
    'additionalContext': content
  }
}))" "$HOOK_EVENT" "$CONTENT"