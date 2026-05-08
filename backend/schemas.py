"""
📚 SCHEMAS.PY - API Data Schemas (Pydantic Models)
==================================================

Schemas define what data looks like when SENDING or RECEIVING from the API.
They're different from database models!

🎓 LEARNING NOTES:
- Database Models = How data is STORED
- Schemas = How data is TRANSFERRED (API requests/responses)

Why separate? Security and flexibility!
- We might not want to expose all database fields
- Request data might have different fields than response data
"""

from pydantic import BaseModel, Field, PlainSerializer
from typing import Annotated, Optional, List
from datetime import datetime, timezone


def _utc_iso(value: Optional[datetime]) -> Optional[str]:
    """Serialise a datetime as a tz-aware ISO 8601 string.

    The DB stores naive datetimes (UTC by convention; SQLAlchemy
    `func.now()` doesn't attach a tz). Pydantic's default datetime
    serialiser emits the value with NO timezone marker. JavaScript's
    `Date.parse` interprets such strings as **local time** per the ECMA
    spec, which silently shifts every timestamp by the client's UTC
    offset and breaks any `Date.parse(...)`-based logic on the frontend
    (the in-app retroactive photo picker is one such victim).

    By stamping `+00:00` here we force the output to look like
    `2026-05-07T07:35:56.579000+00:00`, which JS parses correctly as
    UTC regardless of device timezone.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


# Drop-in replacement for `datetime` on response fields. Use this whenever
# the value is consumed by the JS frontend.
UTCDateTime = Annotated[
    datetime,
    PlainSerializer(_utc_iso, when_used='json', return_type=Optional[str]),
]


RUN_DISTANCES = {
    "1k": 1.0,
    "2k": 2.0,
    "3k": 3.0,
    "5k": 5.0,
    "8k": 8.0,
    "10k": 10.0,
    "15k": 15.0,
    "18k": 18.0,
    "21k": 21.0,
}

LEVEL_DISTANCES = {
    "breath": list(RUN_DISTANCES.keys()),
    "stride": list(RUN_DISTANCES.keys()),
    "flow":   list(RUN_DISTANCES.keys()),
    "zen":    list(RUN_DISTANCES.keys()),
}

LEVEL_MAX = {"breath": "5k", "stride": "10k", "flow": "21k", "zen": "21k"}

LEVEL_GOALS = {
    "breath": {"yearly_km": 250.0, "monthly_km": 20.0},
    "stride": {"yearly_km": 500.0, "monthly_km": 40.0},
    "flow":   {"yearly_km": 1000.0, "monthly_km": 80.0},
    "zen":    {"yearly_km": 1000.0, "monthly_km": 80.0},
}

LEVEL_ORDER = ["breath", "stride", "flow", "zen"]

LEVEL_INFO = {
    "breath": {
        "name": "Breath",
        "tagline": "Every journey begins with a single breath",
        "description": "Perfect for getting started. Build the habit with shorter distances.",
    },
    "stride": {
        "name": "Stride",
        "tagline": "You've found your stride",
        "description": "You're consistent. Time to explore longer distances.",
    },
    "flow": {
        "name": "Flow",
        "tagline": "Running in flow",
        "description": "The distances of a seasoned runner. From 3K to half marathon.",
    },
    "zen": {
        "name": "Zen",
        "tagline": "Pure running, pure zen",
        "description": "Every distance unlocked. The ultimate ZenRunner.",
    },
}


# ==========================================
# 🏃 RUN SCHEMAS
# ==========================================

class RunCreate(BaseModel):
    """
    📥 Schema for CREATING a new run
    
    This is what the frontend sends when you complete a run.
    The completed_at field is optional - defaults to now if not provided.
    """
    run_type: str = Field(..., description="Type of run: 1k, 2k, 3k, 5k, 8k, 10k, 15k, 18k, or 21k")
    duration_seconds: int = Field(..., ge=0, description="How long the run took in seconds")
    notes: Optional[str] = Field(None, description="Optional notes about your run")
    completed_at: Optional[datetime] = Field(None, description="When the run was completed (for backdating)")
    category: Optional[str] = Field("outdoor", description="Category: outdoor or treadmill")
    mood: Optional[str] = Field(None, description="How the run felt: easy, good, tough, great")
    # GPS fields — populated for outdoor GPS-tracked runs
    route_polyline: Optional[str] = Field(None)
    start_lat: Optional[float] = Field(None)
    start_lng: Optional[float] = Field(None)
    end_lat: Optional[float] = Field(None)
    end_lng: Optional[float] = Field(None)
    elevation_gain_m: Optional[float] = Field(None)
    started_at: Optional[datetime] = Field(None)
    distance_km: Optional[float] = Field(None, description="Actual GPS distance; if omitted, derived from run_type")


class RunUpdate(BaseModel):
    """
    ✏️ Schema for UPDATING a run
    
    All fields are optional - only provided fields are updated.
    """
    run_type: Optional[str] = Field(None, description="Type of run: 1k, 2k, 3k, 5k, 8k, 10k, 15k, 18k, or 21k")
    duration_seconds: Optional[int] = Field(None, ge=0, description="How long the run took in seconds")
    notes: Optional[str] = Field(None, description="Optional notes about your run")
    category: Optional[str] = Field(None, description="Category: outdoor or treadmill")
    mood: Optional[str] = Field(None, description="How the run felt: easy, good, tough, great")


class Celebration(BaseModel):
    """
    🎉 Schema for celebration events
    """
    type: str  # "personal_best", "streak", "monthly_goal", "high_steps"
    title: str  # "Personal Best!"
    message: str  # "You beat your 5k record!"


class MilestoneUnlockItem(BaseModel):
    """Badge first unlocked on this activity (path/album milestones)."""

    id: str
    name: str
    description: str
    emoji: str
    category: str


class RunResponse(BaseModel):
    """
    📤 Schema for RETURNING run data
    
    This is what the API sends back. Includes all fields.
    """
    id: int
    run_type: str
    duration_seconds: int
    distance_km: float
    completed_at: UTCDateTime
    notes: Optional[str]
    mood: Optional[str] = None
    category: Optional[str] = None
    route_polyline: Optional[str] = None
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    elevation_gain_m: Optional[float] = None
    started_at: Optional[UTCDateTime] = None
    
    # 🎯 Calculated fields for the frontend
    pace_per_km: str = ""  # e.g., "6:30"
    formatted_duration: str = ""  # e.g., "32:30"
    
    # 🏆 Personal best tracking (legacy, kept for compatibility)
    is_personal_best: bool = False  # True if this is a new PR
    pr_type: Optional[str] = None  # e.g., "fastest_5k", "longest_run"
    
    # 🎉 Celebrations - all achievements unlocked by this run
    celebrations: List[Celebration] = []

    # 🏅 Milestone badges that transitioned locked → unlocked on this save
    milestone_unlocks: List[MilestoneUnlockItem] = []
    
    # 📸 Photo count for scenic runs
    photo_count: int = 0

    neighbourhood_visibility: Optional[str] = "off"
    neighbourhood_published_at: Optional[UTCDateTime] = None
    
    class Config:
        from_attributes = True



# ==========================================
# 📊 STATS SCHEMAS
# ==========================================

class StatsResponse(BaseModel):
    """
    📊 User Statistics Response
    
    Aggregated data about your running journey.
    """
    total_runs: int
    total_km: float
    total_duration_seconds: int = 0
    current_streak: int
    longest_streak: int
    average_pace: str  # Calculated
    
    # 📅 Weekly/Monthly breakdowns
    runs_this_week: int
    km_this_week: float
    runs_this_month: int
    km_this_month: float


class MotivationalMessage(BaseModel):
    """
    🎉 Motivational Message
    
    Encouraging words based on your progress!
    """
    message: str
    emoji: str
    achievement: Optional[str] = None


class WeeklyStreakProgress(BaseModel):
    """
    🔥 Weekly Streak Progress
    
    Shows progress toward this week's streak goal:
    - Need 2 runs of any distance
    """
    runs_completed: int
    runs_needed: int
    is_complete: bool
    current_streak: int
    longest_streak: int
    message: str
    is_comeback: bool = False
    weeks_away: int = 0
    missed_last_week: bool = False


# ==========================================
# 🧠 COACH SCHEMAS
# ==========================================


class CoachSettings(BaseModel):
    """User-facing coach toggles. Mirrors User.coach_* columns."""

    coach_enabled: bool = False
    coach_notes_auto: bool = True
    coach_today_card: bool = True
    coach_voice_during_runs: str = "coach_runs"  # all | coach_runs | journeys_only | off
    coach_consent_at: Optional[UTCDateTime] = None

    class Config:
        from_attributes = True


class CoachOptInRequest(BaseModel):
    """Sent when the user accepts the coach opt-in screen."""

    accepted: bool = Field(..., description="Must be true to opt in.")


class CoachNote(BaseModel):
    """Post-activity note returned to the client."""

    activity_type: str  # "run" | "walk"
    activity_id: int
    text: str
    generated_at: UTCDateTime
    is_stub: bool = False  # true if produced by the LLM stub backend


class CoachTodayCardResponse(BaseModel):
    """One-line recommendation for the Home card."""

    text: str
    generated_at: UTCDateTime
    is_stub: bool = False


class CoachChatTurn(BaseModel):
    """One message in a coach chat exchange."""

    role: str  # "user" | "assistant"
    content: str
    created_at: Optional[UTCDateTime] = None


class CoachChatRequest(BaseModel):
    """Send a new user message to the coach. Server replays prior history
    from the database; clients don't need to track it."""

    message: str = Field(..., min_length=1, max_length=2000)


class CoachChatResponse(BaseModel):
    """The coach's reply plus the resulting (recent) history."""

    reply: str
    history: List[CoachChatTurn] = []
    is_stub: bool = False


class CoachRunScriptLine(BaseModel):
    """A single voice line in the in-run companion script."""

    trigger: str  # "start" | "km" | "halfway" | "km_to_go" | "finish"
    text: str
    km: Optional[int] = None
    remaining_km: Optional[int] = None


class CoachRunScriptRequest(BaseModel):
    """Pre-generate the in-run companion script for a planned activity."""

    activity: str = Field("outdoor_run", description="outdoor_run | treadmill | walk | journey")
    target_distance_km: float = Field(..., gt=0, le=120)
    plan_summary: str = Field(..., min_length=1, max_length=400)
    route_landmarks: Optional[List[str]] = Field(None, description="Optional named cues, e.g. 'Teddington Lock at km 6'")


class CoachRunScriptResponse(BaseModel):
    """The pre-generated script. Cached server-side so the client can
    re-fetch on resume without re-generating."""

    id: int
    activity: str
    target_distance_km: float
    plan_summary: Optional[str] = None
    lines: List[CoachRunScriptLine]
    created_at: UTCDateTime
    is_stub: bool = False


# ==========================================
# 🌅 JOURNEY SCHEMAS  (the slow ultra)
# ==========================================


# Tier → target distance lookup. 20k/30k are one-go journeys (single
# calendar day window). 50k/60k/75k/100k can spread across up to 3 days.
JOURNEY_TIERS = {
    "20k": 20.0,
    "30k": 30.0,
    "50k": 50.0,
    "60k": 60.0,
    "75k": 75.0,
    "100k": 100.0,
}

# Tier → max attribution window in calendar days.
JOURNEY_TIER_MAX_DAYS = {
    "20k": 1,
    "30k": 1,
    "50k": 3,
    "60k": 3,
    "75k": 3,
    "100k": 3,
}

# Lifecycle states. `planned` is the new default — the runner schedules a
# journey from the preview screen, then explicitly flips to `active` when
# they're ready to start.
JOURNEY_STATUSES = {"planned", "active", "completed", "abandoned"}


class JourneyWaypoint(BaseModel):
    """A single resolved waypoint on a Guide-suggested route.

    The Guide names places (e.g. "Westminster Bridge, London, UK"); the
    backend route planner geocodes them to lat/lng via Nominatim and
    persists both the name and the resolved coordinates. The frontend
    renders these as numbered pins on the preview map.
    """

    name: str
    note: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class JourneyTemplate(BaseModel):
    """Suggested starter journey for the picker. The coach generates
    these on demand for the active user (region + level aware).

    For Guide-generated suggestions the route fields below are populated:
    a real walkable polyline stitched through resolved waypoints, plus
    short step-by-step directions. Static templates (the rotating fallback
    list) leave these empty — the preview screen falls back to the
    "your usual ground" map for those.
    """

    tier: str
    name: str
    blurb: str
    target_distance_km: float
    waypoints: List[JourneyWaypoint] = []
    directions: List[str] = []
    # Google encoded polyline (precision 5) of the stitched route. Empty
    # when the journey has no specific path (static templates) or when
    # geocoding/stitching all failed (no home_city, transient outage).
    route_polyline: str = ""
    estimated_distance_km: Optional[float] = None
    # "osrm" | "straight_line" | "mixed" | "none" — telemetry hint;
    # frontend can use this to label rough sketches differently if it
    # wants to be transparent about the routing source.
    stitch_method: Optional[str] = None


class JourneyPreviewRequest(BaseModel):
    """Generate (without persisting) the preview info shown when the user
    taps a Guide suggestion or static template card. Returns readiness +
    a discrete prep checklist + a suggested scheduled date.

    The frontend holds the result in memory and posts the same data back
    on commit — saves a duplicate LLM call and keeps the preview
    deterministic from the user's perspective.

    For Guide suggestions the frontend also forwards the waypoints,
    directions, and stitched polyline so the preview screen can render
    the recommended path immediately (no second LLM round-trip and no
    repeat geocoding).
    """

    tier: str = Field(..., description="One of: 20k, 30k, 50k, 60k, 75k, 100k")
    name: str = Field(..., min_length=1, max_length=120)
    blurb: Optional[str] = Field(None, max_length=400)
    waypoints: Optional[List[JourneyWaypoint]] = None
    directions: Optional[List[str]] = None
    route_polyline: Optional[str] = Field(None, max_length=20000)


class JourneyMapContext(BaseModel):
    """🗺 Map context for a journey preview / planned detail.

    A journey doesn't have a fixed route — the user accumulates distance
    across whatever runs and walks they do. So the "preview map" is
    really a map of *the user's usual ground*: their home pin, plus a
    handful of recently-completed activity polylines as a faint hint of
    the terrain they tend to cover.

    All fields are optional; the frontend renders gracefully when home
    is unknown or no recent routes exist.
    """

    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    home_city: Optional[str] = None
    # List of recent activity polylines, each polyline is a list of
    # [lat, lng] pairs. Down-sampled server-side so the payload stays
    # small (~30-60 points per route).
    recent_routes: List[List[List[float]]] = []
    # Approximate radius (km) the journey distance loosely covers from
    # home. Frontend can render a soft circle to anchor "scale". Optional
    # — only meaningful when home is known.
    suggested_radius_km: Optional[float] = None


class JourneyPreviewResponse(BaseModel):
    """Read-only preview payload for `JourneyPreviewScreen`."""

    tier: str
    target_distance_km: float
    max_days: int
    name: str
    plan_summary: str
    readiness_note: str
    prep_checklist: List[str]
    # Default scheduled day suggested by the server (next Saturday for 1-day
    # tiers, next weekend for multi-day). ISO date string `YYYY-MM-DD` in UTC.
    suggested_scheduled_for: str
    # 🗺 Embedded map context — same shape as GET /me/journey-map-context.
    map_context: JourneyMapContext = Field(default_factory=JourneyMapContext)
    # 🛣 Recommended route — Guide suggestions only. Static templates
    # leave these empty and the preview falls back to the "usual ground"
    # map context above.
    waypoints: List[JourneyWaypoint] = []
    directions: List[str] = []
    route_polyline: str = ""
    estimated_distance_km: Optional[float] = None
    is_stub: bool = False


class JourneyCreateRequest(BaseModel):
    """Plan or start a new journey.

    Default is `as_planned=True` — the new flow is preview → plan → start
    later. The frontend can also pass `as_planned=False` to flip straight
    to active (the legacy "start now" path). Many planned journeys are
    allowed; only one active per user at a time.
    """

    name: str = Field(..., min_length=1, max_length=120)
    tier: str = Field(..., description="One of: 20k, 30k, 50k, 60k, 75k, 100k")
    plan_summary: Optional[str] = Field(None, max_length=400)
    # New plan-then-start fields. Optional so older clients keep working
    # (legacy clients call create with no schedule + as_planned defaulting
    # off via this flag).
    as_planned: bool = Field(
        True,
        description="If true (default), creates the journey in 'planned' "
        "state with the optional scheduled_for date. If false, the "
        "journey is immediately active.",
    )
    scheduled_for: Optional[str] = Field(
        None,
        description="ISO date `YYYY-MM-DD` for the planned start day.",
    )
    # Optional Guide-generated content forwarded from the preview screen.
    # Skipping these is fine; the server will fill them in for 50k+ tiers
    # at create time the same way it has been for prep notes.
    readiness_note: Optional[str] = Field(None, max_length=600)
    prep_checklist: Optional[List[str]] = Field(
        None,
        description="Discrete prep checklist items. Each item is a short "
        "phrase; max 12 items, max 120 chars each.",
    )
    # 🛣 Recommended route — forwarded from the preview when the user
    # tapped a Guide suggestion. Persisted on the journey so the planned
    # detail can render the same path later. No re-stitching server-side.
    waypoints: Optional[List[JourneyWaypoint]] = None
    directions: Optional[List[str]] = None
    route_polyline: Optional[str] = Field(None, max_length=20000)


class JourneyUpdateRequest(BaseModel):
    """Edit notes / name on an existing journey."""

    name: Optional[str] = Field(None, min_length=1, max_length=120)
    notes: Optional[str] = Field(None, max_length=2000)


class JourneyScheduleRequest(BaseModel):
    """Reschedule a planned journey. Only valid for journeys in `planned`
    state — once active/completed/abandoned the schedule is fixed."""

    scheduled_for: Optional[str] = Field(
        None,
        description="ISO date `YYYY-MM-DD`. Pass null to clear the date.",
    )


class JourneyDayBriefResponse(BaseModel):
    """A Guide-written brief for a specific day of a multi-day journey."""

    id: int
    journey_id: int
    day_index: int
    text: str
    is_stub: bool = False
    generated_at: UTCDateTime


class JourneyResponse(BaseModel):
    """Full journey state including derived progress."""

    id: int
    name: str
    tier: str
    target_distance_km: float
    max_days: int = 1
    status: str  # planned | active | completed | abandoned
    plan_summary: Optional[str] = None
    notes: Optional[str] = None
    completion_note: Optional[str] = None
    readiness_note: Optional[str] = None
    prep_checklist: List[str] = []
    scheduled_for: Optional[str] = None  # YYYY-MM-DD
    activated_at: Optional[UTCDateTime] = None
    started_at: UTCDateTime
    completed_at: Optional[UTCDateTime] = None

    # 🛣 Recommended route, persisted from the preview if the user
    # tapped a Guide suggestion. Empty list/string for static-template
    # journeys; the planned-detail screen falls back to the usual-ground
    # map in that case.
    waypoints: List[JourneyWaypoint] = []
    directions: List[str] = []
    route_polyline: str = ""

    # Derived fields
    accumulated_km: float = 0.0
    progress_percent: float = 0.0
    activity_count: int = 0
    days_active: int = 0
    expires_at: Optional[UTCDateTime] = None
    is_expired: bool = False

    class Config:
        from_attributes = True


