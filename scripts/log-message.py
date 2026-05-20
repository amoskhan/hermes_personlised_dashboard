#!/usr/bin/env python3
"""
log-message.py — Appends a structured JSON line to the Hermes messages log.

Usage:
  python3 log-message.py <source> <text> [--type info|success|warning|error]

Example:
  python3 log-message.py dashboard "Dashboard widget added" --type success
  python3 log-message.py bot "Cron job: Daily summary generated" --type info

The log file lives at ~/.hermes/cron/output/messages.log and is read by
the /api/messages dashboard endpoint for the Live Messages widget.
"""

import json
import os
import sys
from datetime import datetime, timezone

LOG_DIR = os.path.expanduser('~/.hermes/cron/output')
LOG_FILE = os.path.join(LOG_DIR, 'messages.log')

def log(source: str, text: str, msg_type: str = 'info') -> str:
    os.makedirs(LOG_DIR, exist_ok=True)

    entry = {
        'time': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00'),
        'source': source,
        'text': text,
        'type': msg_type,
    }

    line = json.dumps(entry, ensure_ascii=False)

    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')

    return line


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    source = sys.argv[1]
    text = sys.argv[2]
    msg_type = 'info'

    if '--type' in sys.argv:
        idx = sys.argv.index('--type')
        if idx + 1 < len(sys.argv):
            msg_type = sys.argv[idx + 1]

    log(source, text, msg_type)
    print(f'✓ Logged: [{source}] {text}')
