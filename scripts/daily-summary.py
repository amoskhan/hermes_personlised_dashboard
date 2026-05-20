#!/usr/bin/env python3
"""
Daily Summary Generator — Reads Obsidian vault for:
1. What you did yesterday (from standup)
2. Weekly patterns (last 7 days)
3. Today's varied suggestions (different every day)
"""

import json, os, re, random
from datetime import datetime, timedelta

VAULT_DIR = os.path.expanduser("~/ObsidianVault")
NOTES_DIR = os.path.join(VAULT_DIR, "Notes")
TZ_OFFSET = timedelta(hours=8)
WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

SUGGESTION_POOLS = {
    "pe_coaching": [
        "Try a new warm-up game for P1-P2 — focus on coordination 🏃",
        "Review your last PE lesson — what engaged students most?",
        "Plan one differentiated activity for mixed-ability classes ✏️",
        "Record a 30-sec reflection on today's lesson 📱",
        "Test a modified game rule to increase participation 🎯",
        "Sketch next week's gymnastics unit plan 🤸",
        "Observe 3 students' fundamental movement skills 👀",
        "Research one new PE pedagogy method 📖",
        "Plan a mini fitness circuit using only cones & hoops 🏋️",
        "Think about one student who needs extra support — plan an adaptation",
        "Review NAPFA test results — spot trends in your class 📊",
        "Draft a low-equipment PE lesson (cones + marked floor only) 🎯",
        "Plan a 5-min cool-down routine with stretching cues 🧘",
        "Try 1 new SEL check-in question for your next class 💬",
        "Map a skill progression for throwing & catching across P1-P4 🎯",
        "Record a quick voice note on lesson flow — what to tweak next time 🎙️",
        "Design a simple peer-assessment card for gymnastics 🤸",
        "Plan a rainy-day indoor PE backup lesson ☔",
        "Review safety considerations for your upcoming PE activity ⚠️",
        "Sketch a 15-min inclusive game for students with varying abilities 🤝",
    ],
    "research": [
        "Search arXiv for 'exercise physiology children singapore' 🔬",
        "Read one saved paper from your backlog — extract 3 findings 📄",
        "Update your sports science research notes 📝",
        "Check Balasekaran's latest on cloth mask physiology 🎭",
        "Compare two PE pedagogy papers — what's the key difference? ⚖️",
        "Draft a research question for a free afternoon 💭",
        "Find a paper on motor skill development in primary kids 🧒",
        "Review your sports science wiki — what's missing? 📚",
        "Search for 'VO2max children pe games' — practical applications 📊",
        "Write a one-paragraph summary of a paper for your notes ✍️",
        "Search Google Scholar for 'physical literacy assessment singapore' 🎓",
        "Read the methodology section of a recent exercise physiology paper 🔬",
        "Find a study on classroom-based physical activity breaks 🪑",
        "Compare 3 definitions of physical literacy — which resonates? 📖",
        "Search for 'sedentary behaviour primary school intervention' 🪑",
        "Read about the latest Singapore PE syllabus changes 📋",
        "Find a paper on motivation in PE — self-determination theory 🧠",
        "Look up 'recess physical activity' interventions in Asian contexts 🌏",
        "Cross-reference a sports science finding with your own teaching 🧪",
        "Write a mini lit review (3 papers) on one coaching method 📚",
    ],
    "coding": [
        "Spend 30 min on the dashboard — pick one UI improvement 🖥️",
        "Review GitHub repos for stale branches to clean 🧹",
        "Add one small feature to the portfolio site 🌐",
        "Check the Telegram bot for any updates needed 🤖",
        "Refactor one component in the dashboard 🔧",
        "Write a docstring for a function you wrote recently 📝",
        "Look at the calendar widget — any edge cases? 📅",
        "Explore VPS logs for recurring errors 🔍",
        "Optimise one API endpoint for speed ⚡",
        "Add error handling to a dashboard API that's missing it 🛡️",
        "Review your package.json — any unused deps to prune? 🧹",
        "Write a quick unit test for one API route 🧪",
        "Check for TypeScript strict-mode violations in the dashboard 📋",
        "Add a loading skeleton to any widget that's missing one 💀",
        "Set up a Prettier config for consistent formatting ✨",
        "Add keyboard shortcut hints to the dashboard ⌨️",
        "Review one Python script — add docstrings and error handling 🐍",
        "Check cron job output logs — any failures to fix? ⏰",
        "Bump outdated npm packages with `npm outdated` 📦",
        "Write a small shell alias or utility for daily use 🛠️",
    ],
    "vault": [
        "Link two related notes that aren't connected yet 🔗",
        "Tag any unlabelled entries from this week 🏷️",
        "Check for broken links — fix at least one 🔧",
        "Create a MOC for a topic you've been exploring 🗺️",
        "Archive notes older than 2 weeks 📦",
        "Add a reference from a recent paper to your research notes 📄",
        "Review the Insights page — update with this week's learnings 💡",
        "Run vault health check and review stats 📊",
        "Add today's daily note while it's fresh in mind ✏️",
        "Consolidate scattered notes on one topic into a single page 📋",
        "Write a minimum-viable note on a new topic (just 3 bullet points) 📝",
        "Rename a poorly titled note for better searchability 🏷️",
        "Merge two overlapping notes into one cohesive page 🔗",
        "Review your template notes — update if outdated 📄",
        "Create a daily note template for teaching days 📋",
        "Add metadata (tags/aliases) to 3 orphan notes 🏷️",
        "Write a dataview query to expose a hidden pattern 🔍",
        "Review last month's daily notes — extract 2 insights 💡",
        "Clean up empty or stub notes from the vault 🧹",
        "Backlink a research finding to a teaching observation 📎",
    ],
    "finance": [
        "Review your monthly spending so far 💰",
        "Check for unclassified PayLah transactions 🔍",
        "Update your net worth tracker 📈",
        "Review subscriptions — any to cancel? 🔄",
        "Check CPF/savings progress toward HDB goal 🏠",
        "Set aside 10 min to review monthly budget 📋",
        "Compare actual vs budgeted spending for this month 📊",
        "Review your insurance coverage — anything to adjust? 🛡️",
        "Check if any recurring bills increased this month 📈",
        "Calculate your monthly savings rate 📊",
        "Review your investment portfolio allocation 📈",
        "Set one financial goal for next month 🎯",
        "Check for unused gift cards or credits 💳",
        "Review your recurring transfer setup — still correct? 🔄",
        "Plan your next big expense — timeline & budget 🗓️",
    ],
    "wellness": [
        "Take a 10-min walk between tasks today 🚶",
        "Hydrate — aim for 2L with this heat 💧",
        "Stretch for 5 min after PE today 🤸",
        "Plan your meals for the rest of the week 🥗",
        "Log your sleep and activity for today 📱",
        "Breathing exercise before bed — 4-7-8 technique 🧘",
        "Step away from screens for 15 min after work 👀",
        "Do a 5-min meditation before your next class 🧘",
        "Prep a healthy snack for tomorrow 🍎",
        "Check your posture during screen time 🧍",
        "Get 7+ hours of sleep tonight — set a wind-down alarm 😴",
        "Do 10 min of sun exposure before noon ☀️",
        "Take the stairs instead of the lift today 🚶",
        "Write down 3 things you're grateful for today 🙏",
        "Do a quick neck & shoulder release — desk stress 🧘",
    ],
    "badminton": [
        "Review your footwork drills — one to practice 🏸",
        "Check if there's a court available this evening 🏟️",
        "Watch a 5-min pro match highlight — note one technique 🎥",
        "Pack your badminton bag for tomorrow's session 🎒",
        "Practice 10 min of shadow footwork at home 👣",
        "Analyse your last game — one shot to improve 📹",
        "Try a new serve variation this session 🎯",
        "Record your smash technique — compare to pro form 📱",
        "Plan a 15-min drill session focused on recovery steps 🏃",
        "Review grip pressure — are you holding too tight? 🤔",
        "Watch a defensive rally — note footwork patterns 👀",
        "Practice net play: 50 cross-court net shots 🎯",
        "Check racket string tension — due for restring? 🏸",
        "Stretch hips and shoulders before next game 🤸",
        "Plan a training session: 3 drills, 1 game situation 📋",
    ],
    "career": [
        "Review GEO2→GEO3 progress — next milestone? 🎯",
        "Note one teaching win from this week for your portfolio ✨",
        "Look up MOE PD courses for this term 🎓",
        "Update LinkedIn/portfolio with a recent accomplishment 📋",
        "Think about one non-MOE path (wellness/coaching/edtech) 🤔",
        "Write a short reflection on your teaching philosophy ✍️",
        "Review NIE module requirements — any coming deadlines? 📅",
        "Reach out to a mentor for a quick check-in 📞",
        "Read one article on teacher wellbeing in Singapore 📖",
        "Draft a bullet-point lesson observation for your portfolio 📝",
        "Check MOE's PD calendar — any free workshops? 🗓️",
        "Write down 3 career goals for this year 🎯",
        "Review your CV — one bullet point to refine 📄",
        "Think about a CCA you could contribute to next term 🏫",
        "Plan a conversation with your reporting officer 💬",
    ],
}

def today_sgt():
    return datetime.utcnow() + TZ_OFFSET

def date_str(dt=None):
    return (dt or today_sgt()).strftime("%Y-%m-%d")

def weekday_name(dt=None):
    return WEEKDAYS[(dt or today_sgt()).weekday()]

def read_note(date_s):
    path = os.path.join(NOTES_DIR, f"{date_s}.md")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return f.read()

def extract_yesterday_summary(text):
    lines = text.split("\n")
    in_section = False
    items = []
    for line in lines:
        if "What did I do yesterday" in line:
            in_section = True
            continue
        if in_section:
            if re.match(r"^##", line) or "What will I do today" in line or "Any blockers" in line:
                break
            s = line.strip()
            if s.startswith("-"):
                items.append(s.lstrip("- ").strip())
    return items[:6]

def extract_today_plan(text):
    lines = text.split("\n")
    in_section = False
    items = []
    for line in lines:
        if "What will I do today" in line:
            in_section = True
            continue
        if in_section:
            if re.match(r"^##", line) or "Any blockers" in line:
                break
            s = line.strip()
            if s.startswith("-"):
                # preserve checkbox state
                items.append(s.lstrip("- ").strip())
    return items[:6]

def extract_day_theme(text):
    m = re.search(r'>\s*\*\*Day theme:\*\*\s*(.+?)(?:\n|$)', text)
    return m.group(1).strip() if m else ""

def extract_tags(text):
    tags = re.findall(r'#([\w-]+)', text)
    return [t for t in tags if t.lower() not in (
        "daily-log", "lesson-plan", "project", "research"
    )][:8]

def get_weekly_summary():
    today = today_sgt()
    days = []
    tags = []
    for i in range(1, 8):
        d = today - timedelta(days=i)
        ds = date_str(d)
        text = read_note(ds)
        if text:
            theme = extract_day_theme(text)
            days.append({"date": ds, "theme": theme, "day": WEEKDAYS[d.weekday()]})
            tags.extend(extract_tags(text))
    
    tag_counts = {}
    for t in tags:
        tag_counts[t] = tag_counts.get(t, 0) + 1
    top_tags = sorted(tag_counts.items(), key=lambda x: -x[1])[:5]
    
    themes = [d["theme"] for d in days if d["theme"]]
    summary_parts = []
    if any("teaching" in t.lower() for t in themes):
        summary_parts.append("Teaching week 🏫")
    if any("research" in t.lower() for t in themes):
        summary_parts.append("Research active 🔬")
    if any("rest" in t.lower() for t in themes):
        summary_parts.append("Had rest days 😌")
    if any("cowork" in t.lower() or "enterprise" in t.lower() for t in themes):
        summary_parts.append("Coworking 💼")
    if any("badminton" in t.lower() for t in themes):
        summary_parts.append("Badminton 🏸")
    
    return {
        "summary": " · ".join(summary_parts) if summary_parts else "Quiet week",
        "tags": [{"tag": t, "count": c} for t, c in top_tags],
        "activeDays": len(days),
        "days": [{"date": d["date"], "theme": d["theme"], "day": d["day"]} for d in days]
    }

def extract_completed_tasks(text):
    """Extract tasks that were marked as completed [x] from a note."""
    if not text:
        return []
    completed = []
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("- [x]") or s.startswith("- [X]"):
            completed.append(s.replace("- [x]", "").replace("- [X]", "").strip().lower())
        elif s.startswith("[x]") or s.startswith("[X]"):
            completed.append(s.replace("[x]", "").replace("[X]", "").strip().lower())
    return completed

def generate_suggestions(today, weekly, yesterday_items, completed_tasks=None):
    dt = today
    day_idx = dt.weekday()
    rng = random.Random(f"{date_str(dt)}-v3")  # bumped seed for new version
    
    if day_idx == 5:
        focus = "weekend"
    elif day_idx == 6:
        focus = "rest"
    elif day_idx == 2:
        focus = "cowork"
    elif day_idx == 4:
        focus = "badminton_day"
    else:
        focus = "teaching"
    
    cat_priorities = {
        "teaching": ["pe_coaching", "career", "vault", "research"],
        "cowork": ["coding", "research", "vault", "pe_coaching"],
        "badminton_day": ["badminton", "pe_coaching", "research", "vault"],
        "weekend": ["vault", "coding", "research", "finance", "wellness"],
        "rest": ["wellness", "vault", "finance", "reading"],
    }
    
    cats = cat_priorities.get(focus, list(SUGGESTION_POOLS.keys()))
    rng.shuffle(cats)
    
    suggestions = []
    used_texts = set()
    for cat in cats[:4]:
        pool = SUGGESTION_POOLS.get(cat, [])
        rng.shuffle(pool)
        for s in pool:
            if s not in used_texts:
                # Skip if suggestion matches a recently completed task
                s_lower = s.lower()[:60]
                if completed_tasks and any(
                    s_lower in t or t[:60] in s_lower for t in completed_tasks
                ):
                    continue
                suggestions.append({"category": cat, "text": s})
                used_texts.add(s)
                break
        if len(suggestions) >= 3:
            break
    
    return suggestions[:3]

def main():
    today = today_sgt()
    yesterday = today - timedelta(days=1)
    today_s = date_str(today)
    yesterday_s = date_str(yesterday)
    
    today_note = read_note(today_s)
    yesterday_note = read_note(yesterday_s)
    
    # Yesterday recap
    yesterday_items = []
    if yesterday_note:
        yesterday_items = extract_yesterday_summary(yesterday_note)
    if not yesterday_items and today_note:
        # fallback: today's note references yesterday
        yesterday_items = extract_yesterday_summary(today_note)
    
    # Today's planned items
    today_plan = extract_today_plan(today_note) if today_note else []
    
    # Weekly trends
    weekly = get_weekly_summary()
    
    # Check for recently completed tasks (scan last 3 days)
    completed_tasks = []
    for i in range(1, 4):
        d = today - timedelta(days=i)
        note = read_note(date_str(d))
        if note:
            completed_tasks.extend(extract_completed_tasks(note))

    # Fresh daily suggestions (filtered to exclude completed tasks)
    suggestions = generate_suggestions(today, weekly, yesterday_items, completed_tasks)
    
    # Today's theme
    today_theme = extract_day_theme(today_note) if today_note else ""
    day_name = weekday_name(today)
    
    # Greeting based on time of day
    h = today.hour
    if h < 12: greeting = "Good morning"
    elif h < 17: greeting = "Good afternoon"
    else: greeting = "Good evening"
    
    is_weekend = today.weekday() >= 5
    day_theme_str = today_theme or (f"{day_name} — free day" if is_weekend else day_name)
    
    result = {
        "date": today_s,
        "dayName": day_name,
        "dayTheme": day_theme_str,
        "hasNote": today_note is not None,
        "greeting": greeting,
        "yesterday": {
            "date": yesterday_s,
            "hasNote": yesterday_note is not None,
            "items": yesterday_items,
            "total": len(yesterday_items)
        },
        "todayPlan": today_plan,
        "weekly": weekly,
        "suggestions": suggestions
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
