#!/usr/bin/env python3
"""Read today's (or most recent) daily note from Obsidian vault and return a summary."""

import json, os, re, sys
from datetime import datetime, timedelta

VAULT_DIR = os.path.expanduser("~/ObsidianVault")
NOTES_DIR = os.path.join(VAULT_DIR, "Notes")

TZ_OFFSET = timedelta(hours=8)  # SGT

def today_str():
    return (datetime.utcnow() + TZ_OFFSET).strftime("%Y-%m-%d")

def find_daily_note():
    """Find today's note, or the most recent one."""
    today = today_str()
    today_path = os.path.join(NOTES_DIR, f"{today}.md")
    if os.path.exists(today_path):
        return today_path, "today"

    # Find most recent
    dates = []
    for f in os.listdir(NOTES_DIR):
        m = re.match(r"(\d{4}-\d{2}-\d{2})\.md$", f)
        if m:
            dates.append(m.group(1))
    dates.sort(reverse=True)
    if dates:
        recent = os.path.join(NOTES_DIR, f"{dates[0]}.md")
        return recent, dates[0]
    return None, None

def parse_note(path):
    """Extract sections from a markdown daily note."""
    with open(path) as f:
        text = f.read()

    sections = {"title": "", "weather": "", "schedule": "", "standup": "", "other": []}

    lines = text.split("\n")
    current_section = "other"
    current_lines = []

    # Section headers: ## Something
    section_map = {
        "weather": ["weather", "🌤️"],
        "schedule": ["schedule", "📅"],
        "standup": ["standup", "morning"],
    }

    def flush():
        nonlocal current_lines
        text = "\n".join(current_lines).strip()
        if text:
            if current_section == "other":
                sections["other"].append(text)
            else:
                sections[current_section] = text
        current_lines = []

    for line in lines:
        h_match = re.match(r"^##\s+(.+)$", line)
        if h_match:
            flush()
            heading = h_match.group(1).lower()
            current_section = "other"
            for key, keywords in section_map.items():
                if any(kw in heading for kw in keywords):
                    current_section = key
                    break
            current_lines = []
        else:
            current_lines.append(line)
    flush()

    # Extract title (first # line)
    t_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    if t_match:
        sections["title"] = t_match.group(1)

    return sections

def extract_standup_summary(standup_text):
    """Extract structured info from the Morning Standup block."""
    result = {"weather": "", "events": "", "tip": "", "vault": ""}
    lines = standup_text.split("\n")
    for line in lines:
        line_lower = line.lower()
        if "weather" in line_lower and ":" in line:
            result["weather"] = line.split(":", 1)[1].strip().lstrip("*").lstrip("**").strip()
        elif "event" in line_lower and ":" in line:
            result["events"] = line.split(":", 1)[1].strip().lstrip("*").lstrip("**").strip()
        elif "tip" in line_lower or "pe" in line_lower:
            result["tip"] = line.split(":", 1)[1].strip().lstrip("*").lstrip("**").strip() if ":" in line else line.strip()
        elif "vault" in line_lower:
            result["vault"] = line.split(":", 1)[1].strip().lstrip("*").lstrip("**").strip() if ":" in line else line.strip()
    return result

def main():
    path, date_label = find_daily_note()
    if not path:
        print(json.dumps({
            "date": today_str(),
            "hasNote": False,
            "summary": "No daily note found for today.",
            "standup": None,
            "weather": "",
            "events": [],
            "sections": {}
        }))
        return

    sections = parse_note(path)
    standup_raw = sections.get("standup", "")
    standup = extract_standup_summary(standup_raw) if standup_raw else None

    # Parse events from schedule section
    events = []
    sched = sections.get("schedule", "")
    for line in sched.split("\n"):
        m = re.match(r"-\s+(\d{2}:\d{2})-(\d{2}:\d{2})\s+(.+)", line)
        if m:
            events.append({"start": m.group(1), "end": m.group(2), "title": m.group(3).strip()})

    # Clean up weather section to brief text
    weather_text = sections.get("weather", "")
    brief_weather = ""
    for line in weather_text.split("\n"):
        if "temperature" in line.lower() and "feels" in line.lower():
            brief_weather += line.strip() + " | "
        if "condition" in line.lower():
            brief_weather += line.strip()

    result = {
        "date": date_label if date_label != "today" else today_str(),
        "hasNote": True,
        "sections": sections,
        "standup": standup,
        "weather": brief_weather or sections.get("weather", "")[:200],
        "events": events,
        "summary": standup.get("weather", "") if standup else ""
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
