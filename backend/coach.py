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
from models import Journey, Run, RunPhoto, User, UserGoals, Walk, WalkPhoto

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

    # 🌅 Active journey, if any. The Guide is journey-aware: when a journey
    # is in flight, the stage flips to `journeying` and we drop a single
    # plain-text line into the context block so every task knows about it.
    active_journey: Optional[Journey] = (
        db.query(Journey)
        .filter(Journey.user_id == user.id, Journey.status == "active")
        .order_by(desc(Journey.started_at))
        .first()
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
        has_active_journey=active_journey is not None,
    )

    lines: List[str] = []

    # --- Identity ---
    # The Guide never sees the user's real name or handle. Friends rarely use
    # your name in conversation — and we want this voice to feel like a friend.
    level = (getattr(user, "runner_level", None) or "breath").strip()
    lines.append(f"Runner level: {level}. Stage: {stage}.")

    # --- Active journey (if any) ---
    if active_journey is not None:
        journey_line = _format_active_journey(db, active_journey)
        if journey_line:
            lines.append(journey_line)

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
        "active_journey_id": active_journey.id if active_journey else None,
        "active_journey_tier": active_journey.tier if active_journey else None,
    }
    return context_text, signals


def _format_active_journey(db: Session, journey: Journey) -> str:
    """One-line journey context for the Guide.

    Reads as: "Journey: 30k 'The slow thirty', day 1 of 1, 7.4 of 30 km
    accumulated, window closes tonight."
    """
    target = float(journey.target_distance_km or 0.0)
    accumulated = _journey_accumulated_km(db, journey)
    max_days = int(journey.max_days or 1)

    started = journey.started_at
    now = datetime.utcnow()
    if started:
        # Calendar-day style: day 1 is the start day.
        day_index = max(1, (now.date() - started.date()).days + 1)
    else:
        day_index = 1
    day_index = min(day_index, max_days)

    if max_days <= 1:
        when = "today is the day"
    else:
        when = f"day {day_index} of {max_days}"

    # Window status (calendar-day end).
    expires_at = None
    if started and max_days:
        end_day = (started + timedelta(days=max_days - 1)).date()
        expires_at = datetime.combine(end_day, datetime.max.time())
    window_phrase = ""
    if expires_at is not None:
        if now > expires_at:
            window_phrase = " The window has closed; the user can mark this complete or abandon it."
        else:
            hours_left = max(0, int((expires_at - now).total_seconds() // 3600))
            if hours_left < 24:
                window_phrase = f" Window closes in ~{hours_left} hour(s)."
            else:
                window_phrase = f" Window closes {expires_at.strftime('%a %d %b')}."

    name = (journey.name or "").strip()
    if name:
        return (
            f"Active journey: {journey.tier} \"{name}\", {when}, "
            f"{accumulated:.1f} of {target:.0f} km accumulated.{window_phrase}"
        )
    return (
        f"Active journey: {journey.tier}, {when}, "
        f"{accumulated:.1f} of {target:.0f} km accumulated.{window_phrase}"
    )


def _journey_accumulated_km(db: Session, journey: Journey) -> float:
    """Local re-implementation of the journey progress sum so `coach.py`
    doesn't depend on FastAPI app helpers.

    Mirrors `_journey_progress` in main.py.
    """
    run_total = (
        db.query(func.coalesce(func.sum(Run.distance_km), 0.0))
        .filter(Run.journey_id == journey.id, Run.user_id == journey.user_id)
        .scalar()
        or 0.0
    )
    walk_total = (
        db.query(func.coalesce(func.sum(Walk.distance_km), 0.0))
        .filter(Walk.journey_id == journey.id, Walk.user_id == journey.user_id)
        .scalar()
        or 0.0
    )
    return float(run_total) + float(walk_total)


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
# Tasks for Journeys (Phase G — Guide for the slow ultra)
# ---------------------------------------------------------------------------

JOURNEY_NOTE_MAX_TOKENS = 350
JOURNEY_BRIEF_MAX_TOKENS = 250
JOURNEY_PREP_MAX_TOKENS = 350
JOURNEY_SUGGESTIONS_MAX_TOKENS = 1500
JOURNEY_READINESS_MAX_TOKENS = 120
JOURNEY_PREP_CHECKLIST_MAX_TOKENS = 400


def generate_journey_completion_note(db: Session, user: User, journey: Journey) -> str:
    """Write a 3–5 sentence reflection on a just-completed journey.

    Reads the contributing runs+walks (via journey_id) and produces a
    journal-style debrief. Returns the text trimmed; caller persists it
    to `journey.completion_note`.
    """
    context_text, signals = build_user_context(db, user)
    journey_block = _format_journey_for_completion(db, journey)
    full_context = context_text + "\n\n" + journey_block

    system = coach_prompts.compose_system_prompt(
        task="journey_complete",
        activity="journey",
        stage="journeying",
        user_context=full_context,
    )
    user_message = (
        "Write the debrief for this completed journey. 3 to 5 sentences. "
        "Reference one specific thing from the contributing activities. "
        "End softly."
    )
    text = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=JOURNEY_NOTE_MAX_TOKENS,
        temperature=0.6,
    )
    return _clean_text(text)


def generate_journey_day_brief(
    db: Session,
    user: User,
    journey: Journey,
    *,
    day_index: int,
) -> str:
    """Write the start-of-day brief for day N of a multi-day journey.

    `day_index` is 1-based. Returns the brief text trimmed; caller
    persists to `journey_day_briefs`.
    """
    context_text, signals = build_user_context(db, user)
    journey_block = _format_journey_for_day_brief(db, journey, day_index)
    full_context = context_text + "\n\n" + journey_block

    system = coach_prompts.compose_system_prompt(
        task="journey_brief",
        activity="journey",
        stage="journeying",
        user_context=full_context,
    )
    user_message = (
        f"Write the morning brief for day {day_index} of {journey.max_days}. "
        "2 to 4 sentences. Reference yesterday if there was activity, "
        "suggest a soft range for today, never command."
    )
    text = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=JOURNEY_BRIEF_MAX_TOKENS,
        temperature=0.6,
    )
    return _clean_text(text)


def generate_journey_prep_note(db: Session, user: User, journey: Journey) -> str:
    """One-time prep checklist for 50k+ journeys, generated at start.

    Caller stores on `journey.plan_summary` if it's empty.
    """
    context_text, signals = build_user_context(db, user)
    journey_block = (
        f"This journey: tier={journey.tier}, target={journey.target_distance_km:.0f} km, "
        f"window={journey.max_days} day(s), name=\"{journey.name}\"."
    )
    full_context = context_text + "\n\n" + journey_block

    system = coach_prompts.compose_system_prompt(
        task="journey_prep",
        activity="journey",
        stage="journeying",
        user_context=full_context,
    )
    user_message = (
        "Write the prep note for this journey. Plain English, plain food. "
        "Cover water, food, layers, charged phone, plaster, and a route fallback."
    )
    text = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=JOURNEY_PREP_MAX_TOKENS,
        temperature=0.6,
    )
    return _clean_text(text)


def generate_journey_suggestions(
    db: Session,
    user: User,
    *,
    tier: str,
    target_distance_km: float,
) -> List[Dict[str, Any]]:
    """Generate 1–2 bespoke journey ideas tailored to the user.

    Each suggestion comes back with named waypoints, step-by-step
    directions, and a stitched walkable polyline through the resolved
    coordinates — so when the user taps a suggestion they see a real
    path on the preview map, not just a name.

    The Guide names the waypoints; the route planner (`services.
    route_planner`) handles geocoding + stitching (OSRM walking-router
    when reachable, straight-line fallback otherwise). Routing is
    best-effort: a suggestion that fails to stitch (offline, no home
    city, invalid waypoints) still gets returned with `waypoints` /
    `directions` populated and an empty `route_polyline`, so the UI
    can render the directions as a list and use the "your usual
    ground" map.

    Caller renders these above the static template list in StartJourney.
    On any parse failure, returns []; the UI quietly hides the section.
    """
    context_text, signals = build_user_context(db, user)
    home_city = (getattr(user, "home_city", None) or "").strip() or None
    home_country = (getattr(user, "home_country", None) or "").strip() or None
    tier_block = (
        f"Selected tier: {tier} (target {target_distance_km:.0f} km, "
        f"{1 if tier in ('20k', '30k') else 3} day window)."
    )
    if home_city:
        tier_block += f"\nhome_city: {home_city}"
    if home_country:
        tier_block += f"\nhome_country: {home_country}"
    full_context = context_text + "\n\n" + tier_block

    system = coach_prompts.compose_system_prompt(
        task="journey_suggestions",
        activity="journey",
        stage=signals["stage"],
        user_context=full_context,
    )
    user_message = (
        f"Suggest one or two journey ideas for the {tier} tier. "
        "Each must include real, geocodable waypoint names anchored "
        "to the user's home_city, plus 6 to 10 short step-by-step "
        "directions. Output JSON only."
    )
    raw = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=JOURNEY_SUGGESTIONS_MAX_TOKENS,
        temperature=0.7,
    )
    suggestions = _parse_journey_suggestions(
        raw, tier=tier, target_distance_km=target_distance_km
    )
    if not suggestions:
        return suggestions

    # Stitch a real route per suggestion. If home_city is unknown the
    # waypoints are unlikely to resolve cleanly — we still try, but the
    # frontend treats `route_polyline=""` as "no route, show directions
    # only and fall back to the usual-ground map".
    for s in suggestions:
        try:
            from services.route_planner import plan_route

            planned = plan_route(
                s.get("waypoints") or [],
                home_city_hint=home_city,
                db=db,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "journey_suggestions: route planner failed for %r: %s",
                s.get("name"),
                exc,
            )
            planned = {
                "waypoints": s.get("waypoints") or [],
                "route_polyline": "",
                "estimated_distance_km": 0.0,
                "stitch_method": "none",
                "proposed_count": 0,
                "resolved_count": 0,
            }
        s["waypoints"] = planned["waypoints"]
        s["route_polyline"] = planned["route_polyline"]
        s["estimated_distance_km"] = planned["estimated_distance_km"]
        s["stitch_method"] = planned["stitch_method"]

        # 🔍 Telemetry — log when a Guide suggestion ships with a degraded
        # route so we can spot pattern failures in the wild. A 30k tier
        # losing 5/8 waypoints to bad geocoding is an exotic edge but a
        # silent one in production; the log is the only signal.
        proposed = int(planned.get("proposed_count") or 0)
        resolved = int(planned.get("resolved_count") or 0)
        if proposed and resolved < max(2, int(proposed * 0.6)):
            logger.warning(
                "journey_suggestions[%s]: degraded route — resolved %d/%d "
                "waypoints (stitch=%s, name=%r)",
                tier,
                resolved,
                proposed,
                planned.get("stitch_method"),
                s.get("name"),
            )
        else:
            logger.info(
                "journey_suggestions[%s]: route OK — resolved %d/%d "
                "waypoints (stitch=%s)",
                tier,
                resolved,
                proposed,
                planned.get("stitch_method"),
            )

    return suggestions


def generate_journey_readiness(
    db: Session,
    user: User,
    *,
    tier: str,
    target_distance_km: float,
    name: str,
) -> str:
    """Short readiness sentence for the JourneyPreviewScreen.

    Honest comparison of recent practice vs. the ask. 1–2 sentences. Used
    as a guidance line, never a gate — the runner still decides.
    """
    context_text, signals = build_user_context(db, user)
    preview_block = (
        f"Previewed journey: tier={tier}, target={target_distance_km:.0f} km, "
        f"window={1 if tier in ('20k', '30k') else 3} day(s), name=\"{name}\"."
    )
    full_context = context_text + "\n\n" + preview_block

    system = coach_prompts.compose_system_prompt(
        task="journey_readiness",
        activity="journey",
        stage=signals["stage"],
        user_context=full_context,
    )
    user_message = (
        "Write the short readiness assessment for this previewed journey. "
        "1 to 2 sentences. Calm. No scolding."
    )
    text = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=JOURNEY_READINESS_MAX_TOKENS,
        temperature=0.5,
    )
    return _clean_text(text)


def generate_journey_prep_checklist(
    db: Session,
    user: User,
    *,
    tier: str,
    target_distance_km: float,
    name: str,
) -> List[str]:
    """Discrete prep checklist (5–8 short items) for the preview screen.

    On any parse failure falls back to a generic but always-safe checklist
    — never an empty list, so the UI always has something to render.
    """
    context_text, signals = build_user_context(db, user)
    preview_block = (
        f"Previewed journey: tier={tier}, target={target_distance_km:.0f} km, "
        f"window={1 if tier in ('20k', '30k') else 3} day(s), name=\"{name}\"."
    )
    full_context = context_text + "\n\n" + preview_block

    system = coach_prompts.compose_system_prompt(
        task="journey_prep_checklist",
        activity="journey",
        stage="journeying",
        user_context=full_context,
    )
    user_message = (
        f"Produce the prep checklist for this {tier} journey. "
        "Output JSON only."
    )
    raw = llm.complete(
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=JOURNEY_PREP_CHECKLIST_MAX_TOKENS,
        temperature=0.5,
    )
    items = _parse_journey_prep_checklist(raw)
    return items or _fallback_prep_checklist(tier)


def _parse_journey_prep_checklist(raw: str) -> List[str]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        logger.warning("journey_prep_checklist JSON parse failed; using fallback")
        return []
    items = parsed.get("items") if isinstance(parsed, dict) else None
    if not isinstance(items, list):
        return []
    cleaned: List[str] = []
    for item in items[:12]:
        if isinstance(item, str):
            line = item.strip()
            if line:
                cleaned.append(line[:120])
    return cleaned


def _fallback_prep_checklist(tier: str) -> List[str]:
    """Always-safe checklist when the LLM is in stub mode or parse fails."""
    base = [
        "Carry water — refill at any tap or shop along the way",
        "Snack with salt for the back half (banana, savoury bar)",
        "Layer for the weather; the wind matters more than the temperature",
        "Charge the phone overnight and bring a small power bank",
        "Tape or plaster for hot spots — pack one even if you never use it",
        "Plan a fallback: a route home if a body part complains",
    ]
    if tier in ("50k", "60k", "75k", "100k"):
        base.append("Pace the days, not the kilometres — early days set the rest")
        base.append("Eat earlier than you feel like and again at the halfway")
    return base


def _parse_journey_suggestions(
    raw: str, *, tier: str, target_distance_km: float
) -> List[Dict[str, Any]]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        logger.warning("journey_suggestions JSON parse failed; returning empty list")
        return []
    items = parsed.get("suggestions") if isinstance(parsed, dict) else None
    if not isinstance(items, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in items[:2]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        blurb = str(item.get("blurb", "")).strip()
        if not name or not blurb:
            continue
        try:
            target = float(item.get("target_distance_km") or target_distance_km)
        except (TypeError, ValueError):
            target = target_distance_km
        # Waypoints — list of {name, note?}. Drop entries without a
        # name; cap length so a malformed response can't blow up the
        # geocoder.
        wps_raw = item.get("waypoints") if isinstance(item.get("waypoints"), list) else []
        waypoints: List[Dict[str, Any]] = []
        for wp in wps_raw[:18]:
            if not isinstance(wp, dict):
                continue
            wp_name = str(wp.get("name", "")).strip()
            if not wp_name:
                continue
            wp_note = str(wp.get("note") or "").strip() or None
            waypoints.append({"name": wp_name[:160], "note": wp_note[:80] if wp_note else None})

        # Step-by-step directions — list of short strings.
        dirs_raw = item.get("directions") if isinstance(item.get("directions"), list) else []
        directions: List[str] = []
        for d in dirs_raw[:14]:
            if not isinstance(d, str):
                continue
            d_clean = d.strip()
            if d_clean:
                directions.append(d_clean[:280])

        out.append(
            {
                "tier": tier,
                "name": name[:80],
                "blurb": blurb[:240],
                "target_distance_km": target,
                "waypoints": waypoints,
                "directions": directions,
                # Filled by `generate_journey_suggestions` after route stitching.
                "route_polyline": "",
                "estimated_distance_km": 0.0,
                "stitch_method": "none",
            }
        )
    return out


def _format_journey_for_completion(db: Session, journey: Journey) -> str:
    """Plain-text block describing the just-completed journey for the LLM."""
    runs = (
        db.query(Run)
        .filter(Run.journey_id == journey.id, Run.user_id == journey.user_id)
        .order_by(Run.completed_at.asc())
        .all()
    )
    walks = (
        db.query(Walk)
        .filter(Walk.journey_id == journey.id, Walk.user_id == journey.user_id)
        .order_by(Walk.started_at.asc())
        .all()
    )

    items: List[str] = []
    for r in runs:
        when = (r.completed_at or datetime.utcnow()).strftime("%a %d %b")
        bits = [f"{when}: run {r.distance_km:.1f}km"]
        if r.category and r.category != "outdoor":
            bits.append(f"({r.category})")
        if r.mood:
            bits.append(f"felt {r.mood}")
        if r.notes:
            bits.append(f"note: {r.notes[:80]}")
        items.append("- " + " — ".join(bits))
    for w in walks:
        when = (w.started_at or datetime.utcnow()).strftime("%a %d %b")
        bits = [f"{when}: walk {w.distance_km:.1f}km"]
        if w.mood:
            bits.append(f"felt {w.mood}")
        if w.notes:
            bits.append(f"note: {w.notes[:80]}")
        items.append("- " + " — ".join(bits))

    accumulated = sum((r.distance_km or 0.0) for r in runs) + sum(
        (w.distance_km or 0.0) for w in walks
    )
    distinct_days = len(
        {
            (r.completed_at.date() if r.completed_at else None)
            for r in runs
            if r.completed_at
        }
        | {
            (w.started_at.date() if w.started_at else None)
            for w in walks
            if w.started_at
        }
    )

    header = (
        f"This journey just completed: tier={journey.tier}, target="
        f"{journey.target_distance_km:.0f} km, window={journey.max_days} day(s), "
        f"name=\"{journey.name}\". Accumulated: {accumulated:.1f} km across "
        f"{len(runs) + len(walks)} activit(ies) over {max(1, distinct_days)} day(s)."
    )
    if not items:
        return header
    return header + "\nContributing activities (chronological):\n" + "\n".join(items)


def _format_journey_for_day_brief(
    db: Session, journey: Journey, day_index: int
) -> str:
    """Plain-text journey state up to the start of `day_index` for the brief."""
    started = journey.started_at or datetime.utcnow()
    today = (started + timedelta(days=day_index - 1)).date()
    yesterday = (started + timedelta(days=day_index - 2)).date() if day_index > 1 else None

    runs = (
        db.query(Run)
        .filter(Run.journey_id == journey.id, Run.user_id == journey.user_id)
        .order_by(Run.completed_at.asc())
        .all()
    )
    walks = (
        db.query(Walk)
        .filter(Walk.journey_id == journey.id, Walk.user_id == journey.user_id)
        .order_by(Walk.started_at.asc())
        .all()
    )

    accumulated = sum((r.distance_km or 0.0) for r in runs) + sum(
        (w.distance_km or 0.0) for w in walks
    )
    target = float(journey.target_distance_km or 0.0)
    remaining = max(0.0, target - accumulated)
    days_left = max(0, journey.max_days - day_index + 1)

    yesterday_block = ""
    if yesterday is not None:
        y_runs = [r for r in runs if r.completed_at and r.completed_at.date() == yesterday]
        y_walks = [w for w in walks if w.started_at and w.started_at.date() == yesterday]
        y_total = sum(r.distance_km or 0.0 for r in y_runs) + sum(
            w.distance_km or 0.0 for w in y_walks
        )
        moods = [a.mood for a in (y_runs + y_walks) if getattr(a, "mood", None)]
        mood_str = f" Mood: {moods[0]}." if moods else ""
        if y_total > 0:
            yesterday_block = (
                f"\nYesterday (day {day_index - 1}): {y_total:.1f} km across "
                f"{len(y_runs) + len(y_walks)} activit(ies).{mood_str}"
            )
        else:
            yesterday_block = f"\nYesterday (day {day_index - 1}): nothing logged."

    return (
        f"Today is day {day_index} of {journey.max_days} of journey \"{journey.name}\" "
        f"(tier {journey.tier}). Target: {target:.0f} km. "
        f"Accumulated so far: {accumulated:.1f} km. Remaining: {remaining:.1f} km "
        f"with {days_left} day(s) left.{yesterday_block}"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    """Strip surrounding whitespace and accidental code fences."""
    out = (text or "").strip()
    if out.startswith("```"):
        out = out.strip("`").strip()
    return out
