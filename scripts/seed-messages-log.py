#!/usr/bin/env python3
"""
seed-messages-log.py — Scans recent Hermes cron output and vault activity,
then writes a few recent events to the messages log so the Live Messages
widget has data to display.

Run on first dashboard setup and periodically via cron.
"""

import json, os, subprocess, sys
from datetime import datetime, timezone

LOG_DIR = os.path.expanduser('~/.hermes/cron/output')
LOG_FILE = os.path.join(LOG_DIR, 'messages.log')

def read_log_messages():
    """Return set of (time, source, text) tuples already in the log."""
    if not os.path.exists(LOG_FILE):
        return set()
    seen = set()
    with open(LOG_FILE) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                seen.add((entry.get('time', ''), entry.get('source', ''), entry.get('text', '')))
            except json.JSONDecodeError:
                pass
    return seen

def append(source, text, msg_type='info'):
    entry = {
        'time': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00'),
        'source': source,
        'text': text,
        'type': msg_type,
    }
    with open(LOG_FILE, 'a') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')

def scan_cron_output():
    """Scan recent cron job outputs for interesting events."""
    if not os.path.isdir(LOG_DIR):
        return

    for entry in os.listdir(LOG_DIR):
        job_dir = os.path.join(LOG_DIR, entry)
        if not os.path.isdir(job_dir):
            continue
        # Check for recent output files
        for fname in os.listdir(job_dir):
            fpath = os.path.join(job_dir, fname)
            if not fname.endswith('.txt') and not fname.endswith('.json'):
                continue
            try:
                mtime = os.path.getmtime(fpath)
                age_hours = (datetime.now().timestamp() - mtime) / 3600
                if age_hours > 48:
                    continue  # too old
                with open(fpath) as f:
                    content = f.read().strip()[:200]
                if content:
                    append('cron', f'[{entry[:8]}] {content[:150]}', 'info')
            except Exception:
                pass

def scan_vault():
    """Check if vault-sync.log has recent activity."""
    vault_log = os.path.join(LOG_DIR, 'vault-sync.log')
    if os.path.exists(vault_log):
        try:
            mtime = os.path.getmtime(vault_log)
            age_hours = (datetime.now().timestamp() - mtime) / 3600
            if age_hours < 48:
                with open(vault_log) as f:
                    content = f.read().strip()[:150]
                if content:
                    append('vault', f'Vault sync: {content}', 'info')
        except Exception:
            pass

if __name__ == '__main__':
    existing = read_log_messages()
    before = len(existing)

    scan_cron_output()
    scan_vault()

    after = len(read_log_messages())
    new_count = after - before
    print(f'Seeded {new_count} new message(s). Total: {after}')
