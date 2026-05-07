"""
Coach Eval Harness
==================

Runs a battery of fixture scenarios through the ZenRun coach and writes
a readable markdown report at ./coach_eval_output.md.

Usage:
    cd backend
    python coach_eval.py

Without ANTHROPIC_API_KEY set, the LLM client is in stub mode and the
report shows the deterministic stub output. With a real key, you get
the actual model voice — useful for tuning the prompt before any code
ships.

The harness uses a throwaway SQLite database in-memory so it never
touches real user data.
"""

from __future__ import annotations

import os
import sys

# Use a fresh in-memory SQLite for fixtures, no matter what DATABASE_URL is set to
os.environ["DATABASE_URL"] = "sqlite:///./coach_eval.db"

# Remove any leftover eval DB from a previous run so fixtures are deterministic
_eval_db_path = os.path.join(os.path.dirname(__file__) or ".", "coach_eval.db")
if os.path.exists(_eval_db_path):
    os.remove(_eval_db_path)

from datetime import datetime, timedelta  # noqa: E402
from typing import List  # noqa: E402

from sqlalchemy.orm import Session  # noqa: E402

from database import Base, SessionLocal, engine  # noqa: E402
from models import Run, RunPhoto, User, UserGoals, Walk  # noqa: E402
import coach  # noqa: E402
import llm  # noqa: E402


def _setup_schema() -> None:
    Base.metadata.create_all(bind=engine)


def _make_user(
    db: Session,
    *,
    email: str,
    name: str,
    level: str = "stride",
    home_city: str = "London",
) -> User:
    user = User(
        email=email,
        hashed_password="x",
        name=name,
        runner_level=level,
        home_city=home_city,
        home_country="GB",
        coach_enabled=True,
    )
    db.add(user)
    db.flush()
    return user


def _add_runs(
    db: Session,
    user: User,
    runs_spec: List[dict],
) -> List[Run]:
    out: List[Run] = []
    for r in runs_spec:
        run = Run(
            user_id=user.id,
            run_type=r.get("run_type", "5k"),
            distance_km=r["distance_km"],
            duration_seconds=r["duration_seconds"],
            completed_at=r["completed_at"],
            category=r.get("category", "outdoor"),
            mood=r.get("mood"),
            notes=r.get("notes"),
        )
        db.add(run)
        out.append(run)
    db.flush()
    return out


def _add_walks(db: Session, user: User, walks_spec: List[dict]) -> List[Walk]:
    out: List[Walk] = []
    for w in walks_spec:
        walk = Walk(
            user_id=user.id,
            distance_km=w["distance_km"],
            duration_seconds=w["duration_seconds"],
            started_at=w["started_at"],
            mood=w.get("mood"),
            notes=w.get("notes"),
            category=w.get("category", "outdoor"),
        )
        db.add(walk)
        out.append(walk)
    db.flush()
    return out


def _now() -> datetime:
    return datetime.utcnow()


# ---------------------------------------------------------------------------
# Fixture scenarios
# ---------------------------------------------------------------------------

def scenarios(db: Session) -> List[dict]:
    """Build all eval scenarios, return list of {label, kind, run_fn} dicts."""
    out: List[dict] = []
    now = _now()

    # ---- Scenario A: regular outdoor runner, easy 8k along the canal ----
    user_a = _make_user(db, email="a@example.com", name="Aanya", level="flow")
    runs_a = _add_runs(
        db,
        user_a,
        [
            {"run_type": "10k", "distance_km": 10.2, "duration_seconds": 56 * 60, "completed_at": now - timedelta(days=8), "mood": "great", "notes": "Canal route. Friend joined."},
            {"run_type": "5k", "distance_km": 5.1, "duration_seconds": 27 * 60, "completed_at": now - timedelta(days=5), "mood": "easy"},
            {"run_type": "8k", "distance_km": 8.0, "duration_seconds": 47 * 60, "completed_at": now - timedelta(days=2), "mood": "good"},
            {"run_type": "8k", "distance_km": 8.05, "duration_seconds": 49 * 60, "completed_at": now, "mood": "easy", "notes": "Same loop, slower. Sun was up."},
        ],
    )
    out.append({"label": "Run note — easy 8k along the canal (flow runner)", "kind": "run_note", "user": user_a, "run": runs_a[-1]})
    out.append({"label": "Today's card — flow runner, two strong weeks", "kind": "today_card", "user": user_a})
    out.append({"label": "Chat — flow runner asks for a long run idea", "kind": "chat", "user": user_a, "message": "Want to do a long one this weekend, maybe 18k. Where should I go?"})

    # ---- Scenario B: returning after a gap ----
    user_b = _make_user(db, email="b@example.com", name="Ben", level="breath")
    runs_b = _add_runs(
        db,
        user_b,
        [
            {"run_type": "3k", "distance_km": 3.1, "duration_seconds": 22 * 60, "completed_at": now - timedelta(days=70), "mood": "tough"},
            {"run_type": "3k", "distance_km": 3.0, "duration_seconds": 24 * 60, "completed_at": now, "mood": "tough", "notes": "First run in two months. Legs felt like lead."},
        ],
    )
    out.append({"label": "Run note — restart after 2 months (breath, tough)", "kind": "run_note", "user": user_b, "run": runs_b[-1]})
    out.append({"label": "Today's card — restarting beginner, day after first run", "kind": "today_card", "user": user_b})
    out.append({"label": "Chat — beginner asks 'how do I keep going'", "kind": "chat", "user": user_b, "message": "I've started and stopped running so many times. How do I keep going this time?"})

    # ---- Scenario C: treadmill-only stretch ----
    user_c = _make_user(db, email="c@example.com", name="Chiara", level="stride")
    runs_c = _add_runs(
        db,
        user_c,
        [
            {"run_type": "5k", "distance_km": 5.0, "duration_seconds": 30 * 60, "completed_at": now - timedelta(days=10), "mood": "tough", "category": "treadmill", "notes": "Rain again. Inside."},
            {"run_type": "5k", "distance_km": 5.0, "duration_seconds": 29 * 60, "completed_at": now - timedelta(days=6), "mood": "good", "category": "treadmill"},
            {"run_type": "8k", "distance_km": 8.0, "duration_seconds": 47 * 60, "completed_at": now - timedelta(days=2), "mood": "good", "category": "treadmill"},
            {"run_type": "5k", "distance_km": 5.0, "duration_seconds": 30 * 60, "completed_at": now, "mood": "tough", "category": "treadmill", "notes": "Mind was elsewhere."},
        ],
    )
    out.append({"label": "Run note — treadmill 5k, mind elsewhere", "kind": "run_note", "user": user_c, "run": runs_c[-1]})
    out.append({"label": "Today's card — four treadmill runs in a row", "kind": "today_card", "user": user_c})
    out.append({"label": "Chat — treadmill boredom", "kind": "chat", "user": user_c, "message": "I hate the treadmill. But it's the only way I can fit a run in this month."})

    # ---- Scenario D: walk-only week ----
    user_d = _make_user(db, email="d@example.com", name="Dee", level="breath")
    walks_d = _add_walks(
        db,
        user_d,
        [
            {"distance_km": 3.5, "duration_seconds": 45 * 60, "started_at": now - timedelta(days=3), "mood": "peaceful", "notes": "Park loop with coffee."},
            {"distance_km": 4.2, "duration_seconds": 55 * 60, "started_at": now, "mood": "scenic", "notes": "River path. Long way."},
        ],
    )
    out.append({"label": "Walk note — scenic 4.2k along the river", "kind": "run_note", "user": user_d, "walk": walks_d[-1]})
    out.append({"label": "Today's card — walking-only week", "kind": "today_card", "user": user_d})
    out.append({"label": "Chat — 'do walks count?'", "kind": "chat", "user": user_d, "message": "I've only walked this week. Does that count?"})

    # ---- Scenario E: high mileage week, journey-curious ----
    user_e = _make_user(db, email="e@example.com", name="Esa", level="flow")
    _add_runs(
        db,
        user_e,
        [
            {"run_type": "10k", "distance_km": 10.4, "duration_seconds": 55 * 60, "completed_at": now - timedelta(days=14), "mood": "good"},
            {"run_type": "15k", "distance_km": 15.0, "duration_seconds": 86 * 60, "completed_at": now - timedelta(days=11), "mood": "great"},
            {"run_type": "21k", "distance_km": 21.1, "duration_seconds": 130 * 60, "completed_at": now - timedelta(days=4), "mood": "great", "notes": "Heath, sun, coffee at the end."},
        ],
    )
    out.append({"label": "Today's card — flow, just did a 21k", "kind": "today_card", "user": user_e})
    out.append({"label": "Chat — Journey curiosity (light ultra)", "kind": "chat", "user": user_e, "message": "I'm thinking about a slow 30k along the Thames. Two days, plenty of stops. Where should I start?"})
    out.append({"label": "Run script — easy 8k recovery, outdoor", "kind": "run_script", "user": user_e, "plan": "easy 8k along the canal", "distance": 8.0, "activity": "outdoor_run"})
    out.append({"label": "Run script — Journey day 1, 25k Thames Path", "kind": "run_script", "user": user_e, "plan": "Journey day 1: 25k Thames Path, walk the hills", "distance": 25.0, "activity": "journey", "landmarks": ["Putney Bridge at km 5", "Hammersmith at km 9", "Kew Bridge at km 13", "Richmond Lock at km 18"]})

    # ---- Scenario F: zen runner, photo run ----
    user_f = _make_user(db, email="f@example.com", name="Fen", level="zen")
    runs_f = _add_runs(
        db,
        user_f,
        [
            {"run_type": "10k", "distance_km": 10.0, "duration_seconds": 53 * 60, "completed_at": now - timedelta(days=2), "mood": "good"},
            {"run_type": "8k", "distance_km": 8.3, "duration_seconds": 50 * 60, "completed_at": now, "mood": "scenic", "notes": "Three photo stops. The light at the heath was perfect."},
        ],
    )
    # add a photo so the bundler picks it up
    db.add(RunPhoto(run_id=runs_f[-1].id, user_id=user_f.id, photo_data="b64", distance_marker_km=4.0, caption="One-legged egret on the lake"))
    db.flush()
    out.append({"label": "Run note — zen runner, photo run", "kind": "run_note", "user": user_f, "run": runs_f[-1]})

    # ---- Scenario G: out of scope chat ----
    user_g = _make_user(db, email="g@example.com", name="Gabe", level="stride")
    _add_runs(db, user_g, [
        {"run_type": "5k", "distance_km": 5.0, "duration_seconds": 28 * 60, "completed_at": now - timedelta(days=3), "mood": "good"},
    ])
    out.append({"label": "Chat — out of scope: weight loss", "kind": "chat", "user": user_g, "message": "How fast can I lose 10kg if I run every day?"})
    out.append({"label": "Chat — out of scope: race plan", "kind": "chat", "user": user_g, "message": "Build me a marathon training plan with intervals."})
    out.append({"label": "Chat — knee twinge (medical-ish)", "kind": "chat", "user": user_g, "message": "My right knee twinges on the downhills. Should I take ibuprofen and run through it?"})

    # ---- Scenario H: scripts variety ----
    out.append({"label": "Run script — treadmill 5k structured intervals", "kind": "run_script", "user": user_c, "plan": "Treadmill 5k: 5 easy, 4x3 min steady with 90s walks, 5 easy", "distance": 5.0, "activity": "treadmill"})
    out.append({"label": "Run script — walk 4k, beginner", "kind": "run_script", "user": user_b, "plan": "Walk 4k, gentle loop, no hurry", "distance": 4.0, "activity": "walk"})
    out.append({"label": "Run script — beginner walk-run 3k", "kind": "run_script", "user": user_b, "plan": "Beginner walk-run 3k: 1 min run, 1 min walk", "distance": 3.0, "activity": "outdoor_run"})

    return out


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run() -> None:
    _setup_schema()
    db = SessionLocal()
    try:
        cases = scenarios(db)
        db.commit()

        report_lines: List[str] = []
        report_lines.append(f"# Coach Eval — {datetime.utcnow().isoformat(timespec='seconds')}Z")
        mode = "live" if llm.is_live() else "stub"
        report_lines.append(f"_LLM mode: **{mode}**_  ({len(cases)} scenarios)")
        report_lines.append("")

        by_kind: dict[str, List[dict]] = {}
        for c in cases:
            by_kind.setdefault(c["kind"], []).append(c)

        for kind in ("run_note", "today_card", "chat", "run_script"):
            if kind not in by_kind:
                continue
            report_lines.append(f"## Task: `{kind}`")
            report_lines.append("")
            for c in by_kind[kind]:
                report_lines.append(f"### {c['label']}")
                report_lines.append("")
                try:
                    output = _run_case(db, c)
                except Exception as exc:  # noqa: BLE001
                    output = f"_ERROR: {exc}_"
                report_lines.append("```")
                report_lines.append(output.strip())
                report_lines.append("```")
                report_lines.append("")

        out_path = os.path.join(os.path.dirname(__file__) or ".", "coach_eval_output.md")
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(report_lines))
        print(f"Wrote {out_path} ({len(cases)} scenarios, mode={mode})")
    finally:
        db.close()


def _run_case(db: Session, c: dict) -> str:
    user = c["user"]
    kind = c["kind"]

    if kind == "run_note":
        if "run" in c:
            return coach.generate_run_note(db, user, run=c["run"])
        if "walk" in c:
            return coach.generate_run_note(db, user, walk=c["walk"])
        raise ValueError("run_note case missing run/walk")

    if kind == "today_card":
        return coach.generate_today_card(db, user)

    if kind == "chat":
        return coach.chat(db, user, user_message=c["message"])

    if kind == "run_script":
        lines = coach.generate_run_script(
            db,
            user,
            plan_summary=c["plan"],
            target_distance_km=float(c["distance"]),
            activity=c.get("activity", "outdoor_run"),
            route_landmarks=c.get("landmarks"),
        )
        formatted: List[str] = []
        for ln in lines:
            tag = ln.get("trigger", "?")
            if "km" in ln:
                tag = f"km {ln['km']}"
            elif "remaining_km" in ln:
                tag = f"{ln['remaining_km']} to go"
            formatted.append(f"[{tag}] {ln.get('text', '')}")
        return "\n".join(formatted)

    raise ValueError(f"Unknown kind: {kind}")


if __name__ == "__main__":
    run()
    sys.exit(0)
