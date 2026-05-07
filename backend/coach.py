"""
ZenRun Coach — Brain
====================

The coach module owns:
- Building user-context blocks for the LLM (small, focused, plain text).
- Picking the right activity / stage layers per call.
- The four task entry-points used by the API:
    * run_note         (Phase 1) — post-run journal annotation
    * today_card       (Phase 2) — Home recommendation
    * chat             (Phase 3) — open Q&A
    * run_script       (Phase 4) — pre-generated in-run companion lines

Voice and scope live in coach_prompts.py. This file does the data work
and the orchestration.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

import coach_prompts
import llm
from models import Run, RunPhoto, User, UserGoals, Walk, WalkPhoto

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CONTEXT_LOOKBACK_DAYS = 60
RECENT_RUN_LIMIT = 6  # last few activities to surface in context
RUN_NOTE_MAX_TOKENS = 250
TODAY_CARD_MAX_TOKENS = 80
CHAT_MAX_TOKENS = 600
RUN_SCRIPT_MAX_TOKENS = 1200


# ---------------------------------------------------------------------------
# User context bundling
# ---------------------------------------------------------------------------

def build_user_context(
    db: Session,
    user: User,
    *,
    focus_run: Optional[Run] = None,
    focus_walk: Optional[Walk] = None,
    plan_summary: Optional[str] = None,
) -> Tuple[str, Dict[str, Any]]:
    """Build the plain-text [User context] block plus a metadata dict.

    Returns (context_text, signals) where:
        context_text: ready to drop into compose_system_prompt(user_context=...)
        signals:      dict with at least:
                        - "stage": coach_prompts STAGE label
                        - "activity": coach_prompts ACTIVITY label (or None)
                        - "runs_last_60_days": int
    """
    now = datetime.utcnow()
    since = now - timedelta(days=CONTEXT_LOOKBACK_DAYS)

    runs = (
        db.query(Run)
        .filter(Run.user_id == user.id)
        .filter(Run.completed_at >= since)
        .order_by(desc(Run.completed_at))
        .all()
    )
    walks = (
        db.query(Walk)
        .filter(Walk.user_id == user.id)
        .filter(Walk.started_at >= since)
        .order_by(desc(Walk.started_at))
        .all()
    )

    runs_last_60 = len(runs)
    walks_last_60 = len(walks)
    km_last_30 = sum(
        r.distance_km or 0
        for r in runs
        if r.completed_at and r.completed_at >= now - timedelta(days=30)
    )

    last_activity_at = None
    if runs:
        last_activity_at = runs[0].completed_at
    if walks and (not last_activity_at or (walks[0].started_at and walks[0].started_at > last_activity_at)):
        last_activity_at = walks[0].started_at

    days_since_last = (now - last_activity_at).days if last_activity_at else None

    goals = db.query(UserGoals).filter(UserGoals.user_id == user.id).first()

    # Resolve activity label from focus
    activity_label: Optional[str] = None
    if focus_run is not None:
        activity_label = "treadmill" if (focus_run.category or "outdoor") == "treadmill" else "outdoor_run"
    elif focus_walk is not None:
        activity_label = "walk"

    stage = coach_prompts.infer_stage(
        runner_level=getattr(user, "runner_level", None),
        runs_last_60_days=runs_last_60,
        has_active_journey=False,  # wired in Phase 5
    )

    lines: List[str] = []

    # --- Identity ---
    # The coach never sees the user's real name or handle. Friends rarely use
    # your name in conversation — and we want this voice to feel like a friend.
    level = (getattr(user, "runner_level", None) or "breath").strip()
    lines.append(f"Runner level: {level}. Stage: {stage}.")

    # --- Rhythm ---
    if days_since_last is None:
        lines.append("No recent activity logged.")
    else:
        lines.append(
            f"Last activity: {days_since_last} day(s) ago. "
            f"Last 60 days: {runs_last_60} run(s), {walks_last_60} walk(s). "
            f"Last 30 days distance: {km_last_30:.1f} km."
        )

    # --- Goals ---
    if goals and (goals.yearly_km_goal or goals.monthly_km_goal):
        lines.append(
            f"Goals: {goals.yearly_km_goal:.0f} km/year, "
            f"{goals.monthly_km_goal:.0f} km/month."
        )

    # --- Neighbourhood ---
    home_city = getattr(user, "home_city", None)
    home_country = getattr(user, "home_country", None)
    if home_city:
        lines.append(f"Home: {home_city}{', ' + home_country if home_country else ''}.")

    # --- Recent activity sample ---
    sample = _format_recent_activity(runs[:RECENT_RUN_LIMIT], walks[:RECENT_RUN_LIMIT])
    if sample:
        lines.append("Recent activity (most recent first):")
        lines.append(sample)

    # --- Focus (the run/walk this call is about) ---
    if focus_run is not None:
        lines.append("This run (just finished or in focus):")
        lines.append(_format_run_for_context(db, focus_run))
    elif focus_walk is not None:
        lines.append("This walk (just finished or in focus):")
        lines.append(_format_walk_for_context(db, focus_walk))

    # --- Plan (e.g. "easy 6k along the river" or "Journey day 1: 25k Thames Path") ---
    if plan_summary:
        lines.append(f"Plan for this run: {plan_summary.strip()}")

    context_text = "\n".join(lines)
    signals = {
        "stage": stage,
        "activity": activity_label,
        "runs_last_60_days": runs_last_60,
        "walks_last_60_days": walks_last_60,
        "days_since_last": days_since_last,
    }
    return context_text, signals


def _format_recent_activity(runs: List[Run], walks: List[Walk]) -> str:
    items: List[Tuple[datetime, str]] = []
    for r in runs:
        when = r.completed_at or datetime.utcnow()
        bits = [f"{when.strftime('%a %d %b')}: run {r.distance_km:.1f}km"]
        if r.category and r.category != "outdoor":
            bits.append(f"({r.category})")
        if r.duration_seconds:
            mins = r.duration_seconds // 60
            secs = r.duration_seconds % 60
            bits.append(f"{mins}:{secs:02d}")
        if r.mood:
            bits.append(f"felt {r.mood}")
        if r.notes:
            bits.append(f"note: {r.notes[:80]}")
        items.append((when, " — ".join(bits)))
    for w in walks:
        when = w.started_at or datetime.utcnow()
        bits = [f"{when.strftime('%a %d %b')}: walk {w.distance_km:.1f}km"]
        if w.mood:
            bits.append(f"felt {w.mood}")
        if w.notes:
            bits.append(f"note: {w.notes[:80]}")
        items.append((when, " — ".join(bits)))
    items.sort(key=lambda t: t[0], reverse=True)
    return "\n".join("- " + s for _, s in items[: RECENT_RUN_LIMIT * 2])


def _format_run_for_context(db: Session, run: Run) -> str:
    bits = [f"- Distance: {run.distance_km:.2f} km, type {run.run_type}"]
    if run.duration_seconds:
        mins = run.duration_seconds // 60
        secs = run.duration_seconds % 60
        bits.append(f"- Duration: {mins}:{secs:02d}")
        if run.distance_km:
            pace_s = run.duration_seconds / run.distance_km
            pm, ps = int(pace_s // 60), int(pace_s % 60)
            bits.append(f"- Average pace: {pm}:{ps:02d} per km")
    if run.category:
        bits.append(f"- Category: {run.category}")
    if run.mood:
        bits.append(f"- Mood: {run.mood}")
    if run.notes:
        bits.append(f"- Notes: {run.notes[:200]}")
    if run.elevation_gain_m:
        bits.append(f"- Elevation gain: {int(run.elevation_gain_m)}m")
    if run.completed_at:
        bits.append(f"- When: {run.completed_at.strftime('%a %d %b %H:%M')}")

    photo_count = (
        db.query(func.count(RunPhoto.id)).filter(RunPhoto.run_id == run.id).scalar() or 0
    )
    if photo_count:
        bits.append(f"- Photos taken on this run: {photo_count}")
        captions = (
            db.query(RunPhoto.caption)
            .filter(RunPhoto.run_id == run.id)
            .filter(RunPhoto.caption.isnot(None))
            .limit(3)
            .all()
        )
        clean = [c[0] for c in captions if c[0]]
        if clean:
            bits.append("- Photo captions: " + " | ".join(clean))
    return "\n".join(bits)


def _format_walk_for_context(db: Session, walk: Walk) -> str:
    bits = [f"- Distance: {walk.distance_km:.2f} km"]
    if walk.duration_seconds:
        mins = walk.duration_seconds // 60
        secs = walk.duration_seconds % 60
        bits.append(f"- Duration: {mins}:{secs:02d}")
    if walk.category:
        bits.append(f"- Category: {walk.category}")
    if walk.mood:
        bits.append(f"- Mood: {walk.mood}")
    if walk.notes:
        bits.append(f"- Notes: {walk.notes[:200]}")
    if walk.started_at:
        bits.append(f"- When: {walk.started_at.strftime('%a %d %b %H:%M')}")
    photo_count = (
        db.query(func.count(WalkPhoto.id)).filter(WalkPhoto.walk_id == walk.id).scalar() or 0
    )
    if photo_count:
        bits.append(f"- Photos on this walk: {photo_count}")
    return "\n".join(bits)


# ---------------------------------------------------------------------------
# Task: run_note (Phase 1)
# ---------------------------------------------------------------------------

def generate_run_note(
    db: Session,
    user: User,
    *,
    run: Optional[Run] = None,
    walk: Optional[Walk] = None,
) -> str:
    """Generate the 2–3 sentence Coach's note for a completed run or walk.

    Returns the note text (already trimmed). Caller is responsible for
    persisting it on the activity record.
    """
    if run is None and walk is None:
        raise ValueError("generate_run_note requires either run= or walk=.")

    context_text, signals = build_user_context(db, user, focus_run=run, focus_walk=walk)

    system = coach_prompts.compose_system_prompt(
        task="run_note",
        activity=signals["activity"],
        stage=signals["stage"],
        user_context=context_text,
    )

    user_message = (
        "Write the Coach's note for this activity. Two or three sentences. "
        "No emoji. No exclamation marks. Reference one specific thing."
    )

    text = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=RUN_NOTE_MAX_TOKENS,
        temperature=0.6,
    )
    return _clean_text(text)


# ---------------------------------------------------------------------------
# Task: today_card (Phase 2)
# ---------------------------------------------------------------------------

def generate_today_card(db: Session, user: User) -> str:
    """Generate today's one-line recommendation for the Home card."""
    context_text, signals = build_user_context(db, user)

    system = coach_prompts.compose_system_prompt(
        task="today_card",
        activity=None,
        stage=signals["stage"],
        user_context=context_text,
    )

    user_message = (
        "Write today's recommendation. One sentence. Specific. Calm. "
        "Acknowledge yesterday if it shaped today."
    )

    text = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=TODAY_CARD_MAX_TOKENS,
        temperature=0.7,
    )
    return _clean_text(text)


# ---------------------------------------------------------------------------
# Task: chat (Phase 3)
# ---------------------------------------------------------------------------

def chat(
    db: Session,
    user: User,
    *,
    user_message: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Single-turn (or short multi-turn) chat reply.

    `history` is a list of prior {"role": "user"|"assistant", "content": "..."}
    messages, in chronological order. Pass an empty list (or None) for the
    first turn.
    """
    if not user_message or not user_message.strip():
        raise ValueError("chat() requires a non-empty user_message.")

    context_text, signals = build_user_context(db, user)

    system = coach_prompts.compose_system_prompt(
        task="chat",
        activity=None,
        stage=signals["stage"],
        user_context=context_text,
    )

    messages: List[Dict[str, str]] = []
    for turn in (history or [])[-10:]:  # cap history length
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)})
    messages.append({"role": "user", "content": user_message.strip()})

    text = llm.complete(
        system=system,
        messages=messages,
        max_tokens=CHAT_MAX_TOKENS,
        temperature=0.7,
    )
    return _clean_text(text)


# ---------------------------------------------------------------------------
# Task: run_script (Phase 4)
# ---------------------------------------------------------------------------

def generate_run_script(
    db: Session,
    user: User,
    *,
    plan_summary: str,
    target_distance_km: float,
    activity: str = "outdoor_run",
    route_landmarks: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Pre-generate the in-run companion lines.

    Args:
        plan_summary: e.g. "easy 8k along the river" or "Journey day 1: 25k Thames Path".
        target_distance_km: float.
        activity: outdoor_run | treadmill | walk | journey
        route_landmarks: optional names like ["the bridge at km 3", "Teddington Lock at km 6"].

    Returns the list of line dicts (parsed JSON). On any parse failure,
    falls back to a minimal default script so the UI never breaks.
    """
    if activity not in coach_prompts.VALID_ACTIVITIES:
        activity = "outdoor_run"

    context_text, signals = build_user_context(db, user, plan_summary=plan_summary)

    landmark_block = ""
    if route_landmarks:
        landmark_block = "\nKnown route landmarks (use 1-2 if relevant):\n- " + "\n- ".join(route_landmarks)

    system = coach_prompts.compose_system_prompt(
        task="run_script",
        activity=activity,
        stage=signals["stage"],
        user_context=context_text + landmark_block,
    )

    user_message = (
        f"Generate the in-run companion script for a {target_distance_km:.1f} km "
        f"{activity.replace('_', ' ')}. Plan: {plan_summary}. "
        "Output JSON only, matching the schema in the system prompt."
    )

    raw = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=RUN_SCRIPT_MAX_TOKENS,
        temperature=0.6,
    )
    return _parse_run_script(raw, target_distance_km)


def _parse_run_script(raw: str, target_distance_km: float) -> List[Dict[str, Any]]:
    text = raw.strip()
    if text.startswith("```"):
        # strip ``` or ```json fences
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    try:
        parsed = json.loads(text)
        lines = parsed.get("lines") if isinstance(parsed, dict) else None
        if isinstance(lines, list) and lines:
            return [_normalise_line(item) for item in lines if isinstance(item, dict)]
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("run_script JSON parse failed: %s", exc)
    return _fallback_run_script(target_distance_km)


def _normalise_line(item: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "trigger": str(item.get("trigger", "km")).strip(),
        "text": str(item.get("text", "")).strip(),
    }
    if "km" in item:
        try:
            out["km"] = int(item["km"])
        except (TypeError, ValueError):
            pass
    if "remaining_km" in item:
        try:
            out["remaining_km"] = int(item["remaining_km"])
        except (TypeError, ValueError):
            pass
    return out


def _fallback_run_script(target_distance_km: float) -> List[Dict[str, Any]]:
    """Used when the model returns invalid JSON. Always-safe default."""
    lines: List[Dict[str, Any]] = [
        {"trigger": "start", "text": "Off you go. Settle in for a minute or two."},
    ]
    n = max(1, int(round(target_distance_km)))
    for km in range(1, n):
        lines.append({"trigger": "km", "km": km, "text": f"{_kmword(km)} kilometres in. Easy as you like."})
    lines.append({"trigger": "finish", "text": "Done. Stretch when you're inside."})
    return lines


def _kmword(km: int) -> str:
    words = {
        1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five",
        6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
        15: "Fifteen", 20: "Twenty", 25: "Twenty-five", 30: "Thirty",
    }
    return words.get(km, str(km))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    """Strip surrounding whitespace and accidental code fences."""
    out = (text or "").strip()
    if out.startswith("```"):
        out = out.strip("`").strip()
    return out
