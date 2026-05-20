#!/usr/bin/env python3
"""
messages-watchdog.py — Cron job script that checks Hermes activity and
logs recent events to the messages log for the Live Messages widget.

Runs every hour via cron.
"""

import json, os, subprocess, sys
from datetime import datetime, timezone

LOG_FILE = os.path.expanduser('~/.hermes/cron/output/messages.log')

def ensure_log():
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'w') as f:
            f.write('')

def read_log_lines():
    ensure_log()
    try:
        with open(LOG_FILE) as f:
            return f.read().strip().split('\n')
    except Exception:
        return ['']

def append(text, source='hermes', msg_type='info'):
    entry = {
        'time': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00'),
        'source': source,
        'text': text,
        'type': msg_type,
    }
    with open(LOG_FILE, 'a') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')

def check_recent_cron_runs():
    """Scan cron output dir for recent (last hour) job runs."""
    cron_dir = os.path.dirname(LOG_FILE)
    now = datetime.now().timestamp()
    count = 0
    for item in os.listdir(cron_dir):
        item_path = os.path.join(cron_dir, item)
        if os.path.isdir(item_path):
            for fname in os.listdir(item_path):
                fpath = os.path.join(item_path, fname)
                if os.path.isfile(fpath):
                    mtime = os.path.getmtime(fpath)
                    if now - mtime < 3600:  # last hour
                        count += 1
    return count

def check_vault_ping():
    """Check if vault sync has been active recently."""
    vault_log = os.path.expanduser('~/.hermes/cron/output/vault-sync.log')
    if os.path.exists(vault_log):
        mtime = os.path.getmtime(vault_log)
        age = (datetime.now().timestamp() - mtime) / 3600
        if age < 24:
            return True
    return False

def check_agent_process():
    """Check if Hermes agent process is running."""
    result = subprocess.run(
        ['pgrep', '-f', 'hermes'],
        capture_output=True, text=True, timeout=5
    )
    return result.returncode == 0

if __name__ == '__main__':
    ensure_log()
    lines_before = len([l for l in read_log_lines() if l.strip()])

    # Check recent cron activity
    recent = check_recent_cron_runs()
    if recent > 0:
        append(f'⏱️ {recent} cron job run(s) detected in last hour', 'cron', 'info')

    # Vault health
    vault_ok = check_vault_ping()
    if vault_ok:
        append('📓 Vault sync active ✓', 'vault', 'success')

    # Agent health
    agent_running = check_agent_process()
    if agent_running:
        append('🤖 Hermes Agent process running ✓', 'system', 'success')
    else:
        append('⚠️ Hermes Agent process not detected (idle mode)', 'system', 'info')

    lines_after = len([l for l in read_log_lines() if l.strip()])
    added = lines_after - lines_before
    print(f'✓ Watchdog: {added} message(s) added. Total: {lines_after}')
