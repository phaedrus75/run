"""
📚 MODELS.PY - Database Models
==============================

Models define the STRUCTURE of our database tables.
Think of them as blueprints for our data.

🎓 LEARNING NOTES:
- Each class = one database table
- Each attribute = one column in that table
- SQLAlchemy converts these Python classes to SQL automatically!
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class Run(Base):
    """
    🏃 Run Model - Represents a single run
    
    Each row in this table = one run you completed.
    
    COLUMNS:
    - id: Unique identifier (auto-generated)
    - run_type: What distance (3k, 5k, etc.)
    - duration_seconds: How long it took
    - completed_at: When you finished
    - notes: Optional personal notes
    """
    __tablename__ = "runs"  # 📋 Name of the table in the database
    
    # 🔑 Primary Key - unique ID for each run
    # autoincrement means the database assigns this automatically
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👤 User who logged this run
    user_id = Column(Integer, nullable=True, index=True)
    
    # 🏃 Type of run (3k, 5k, 10k, 15k, 20k)
    run_type = Column(String, nullable=False)
    
    # ⏱️ Duration in seconds
    # We store seconds because it's easier to calculate with
    # The frontend will convert to minutes:seconds for display
    duration_seconds = Column(Integer, nullable=False)
    
    # 📍 Distance in kilometers (derived from run_type, but stored for stats)
    distance_km = Column(Float, nullable=False)
    
    # 📅 When the run was completed
    # server_default=func.now() means the database auto-fills this
    completed_at = Column(DateTime, server_default=func.now())
    
    # 📝 Optional notes about the run
    notes = Column(String, nullable=True)
    
    # 🏃 Run category (outdoor or treadmill)
    category = Column(String, nullable=True, default="outdoor")
    
    # 🎭 How the run felt (easy, good, tough, great)
    mood = Column(String, nullable=True)

    # 🗺️ GPS tracking (populated for outdoor GPS-tracked runs; null for manual/treadmill)
    route_polyline = Column(Text, nullable=True)
    start_lat = Column(Float, nullable=True)
    start_lng = Column(Float, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lng = Column(Float, nullable=True)
    elevation_gain_m = Column(Float, nullable=True)
    started_at = Column(DateTime, nullable=True)

    # Neighbourhood (opt-in share to city feed)
    neighbourhood_visibility = Column(String, nullable=True, default="off")  # off | neighbourhood
    neighbourhood_published_at = Column(DateTime, nullable=True)
    neighbourhood_centroid_lat = Column(Float, nullable=True)
    neighbourhood_centroid_lng = Column(Float, nullable=True)
    neighbourhood_city = Column(String, nullable=True)  # snapshot at publish time

    # Circles share (opt-OUT, default visible). Inside any circle the user
    # belongs to, this run shows up in the feed unless the owner flips
    # this off. The owner always sees their own runs regardless.
    circles_share = Column(Boolean, nullable=True, default=True)

    # 🧠 Coach's note — short post-run journal annotation written by the
    # AI coach. Generated on first view of the summary, then cached.
    coach_note = Column(Text, nullable=True)
    coach_note_generated_at = Column(DateTime, nullable=True)

    # 🌅 Journey attribution — when set, this run counts toward the
    # accumulated distance of the user's active Journey (Phase 5).
    journey_id = Column(Integer, nullable=True, index=True)

    # 🍎 Source of truth for how this row got here.
    #   "live"          — captured by ZenRun's GPS tracker (default)
    #   "apple_health"  — imported from HealthKit (Apple Watch / iPhone)
    #   "manual"        — user-entered, no GPS
    # external_id holds the upstream UUID (HKWorkout.uuid) so we can
    # dedupe re-imports cheaply. Indexed jointly with user_id below.
    source = Column(String, nullable=True, default="live")
    external_id = Column(String, nullable=True, index=True)




class Weight(Base):
    """
    ⚖️ Weight Model - Track weight over time
    
    Each row represents a weight measurement.
    Goal: Start 209lb (Jan 7, 2026) → 180lb (Dec 31, 2026)
    """
    __tablename__ = "weights"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👤 User who logged this weight
    user_id = Column(Integer, nullable=True, index=True)
    
    # ⚖️ Weight in pounds
    weight_lbs = Column(Float, nullable=False)
    
    # 📅 When this weight was recorded
    recorded_at = Column(DateTime, server_default=func.now())
    
    # 📝 Optional notes (e.g., "morning weight", "after workout")
    notes = Column(String, nullable=True)


class User(Base):
    """
    👤 User Model - App users
    
    Each row represents a registered user.
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 📧 Email (unique identifier for login)
    email = Column(String, unique=True, index=True, nullable=False)
    
    # 🔒 Hashed password (never store plain text!)
    hashed_password = Column(String, nullable=False)
    
    # 👤 Display name
    name = Column(String, nullable=True)
    
    # 🏷️ Unique handle for social features (e.g., @runner123)
    handle = Column(String, unique=True, index=True, nullable=True)
    
    # ✅ Is the account active?
    is_active = Column(Boolean, default=True)
    
    # 🎯 Has completed onboarding?
    onboarding_complete = Column(Boolean, default=False)
    
    # 🏃 Runner level: breath, stride, flow, zen
    runner_level = Column(String, default="breath")
    
    # 🔒 Profile privacy: private, circles, public
    profile_privacy = Column(String, default="private")
    
    # 🧪 Beta feature opt-ins
    beta_steps_enabled = Column(Boolean, default=False, server_default='false')
    beta_weight_enabled = Column(Boolean, default=False, server_default='false')
    beta_gym_enabled = Column(Boolean, default=False, server_default='false')
    
    # 📧 Email verification
    email_verified = Column(Boolean, default=False, server_default='false')
    verification_code_hash = Column(String, nullable=True)
    verification_code_expires = Column(DateTime, nullable=True)
    verification_attempts = Column(Integer, default=0, server_default='0')
    
    # 🛡️ Admin flag
    is_admin = Column(Boolean, default=False, server_default='false')

    # 🌳 Neighbourhood (city-level discovery; uses existing handle)
    neighbourhood_opt_in = Column(Boolean, default=False, server_default='false')
    home_city = Column(String, nullable=True)
    home_country = Column(String, nullable=True)  # ISO-2
    home_lat = Column(Float, nullable=True)
    home_lng = Column(Float, nullable=True)
    neighbourhood_widen_radius_km = Column(Integer, default=0, server_default='0')

    # 🧘 Zen tier (auto-promoted at 1000km in a calendar year, maintained on
    # rolling 365d window with a 30-day grace period).
    zen_unlocked_at = Column(DateTime, nullable=True)
    zen_below_since = Column(DateTime, nullable=True)
    zen_celebrated_at = Column(DateTime, nullable=True)
    zen_demoted_at = Column(DateTime, nullable=True)

    # 🧠 Coach (AI companion) — opt-in, with per-surface toggles. Default
    # off everywhere; user opts in via the dedicated screen.
    coach_enabled = Column(Boolean, default=False, server_default='false')
    coach_consent_at = Column(DateTime, nullable=True)
    coach_notes_auto = Column(Boolean, default=True, server_default='true')  # auto-generate post-run notes when coach_enabled
    coach_today_card = Column(Boolean, default=True, server_default='true')  # show Today's recommendation on Home
    coach_voice_during_runs = Column(String, default='coach_runs', server_default='coach_runs')
    # values: 'all' | 'coach_runs' | 'journeys_only' | 'off'

    # 📅 When the account was created
    created_at = Column(DateTime, server_default=func.now())


class StepEntry(Base):
    """
    👟 Step Entry Model - Track daily step counts
    
    Captures high step days (15k+, 20k+, 25k+).
    """
    __tablename__ = "step_entries"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👤 User who logged this
    user_id = Column(Integer, nullable=True, index=True)
    
    # 👟 Step count for the day
    step_count = Column(Integer, nullable=False)
    
    # 📅 Date of the step entry
    recorded_date = Column(DateTime, nullable=False)
    
    # 📝 Optional notes
    notes = Column(String, nullable=True)
    
    # 📅 When this was created
    created_at = Column(DateTime, server_default=func.now())


class UserGoals(Base):
    """
    🎯 User Goals Model - Personal goals for each user
    
    Stores weight goals and running goals.
    """
    __tablename__ = "user_goals"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👤 User this goal belongs to
    user_id = Column(Integer, nullable=False, unique=True, index=True)
    
    # ⚖️ Weight Goals
    start_weight_lbs = Column(Float, nullable=True)
    goal_weight_lbs = Column(Float, nullable=True)
    weight_goal_date = Column(DateTime, nullable=True)
    
    # 🏃 Running Goals (defaults match Breath level)
    yearly_km_goal = Column(Float, default=250.0)
    monthly_km_goal = Column(Float, default=20.0)
    
    # 📅 Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Circle(Base):
    """
    👥 Circle Model - A group of friends competing together
    
    Max 10 users per circle. Users can be in multiple circles.
    """
    __tablename__ = "circles"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 📛 Circle name (e.g., "Office Runners", "Weekend Warriors")
    name = Column(String, nullable=False)
    
    # 🔑 Unique invite code for joining
    invite_code = Column(String, unique=True, index=True, nullable=False)
    
    # 👤 Who created this circle
    created_by = Column(Integer, nullable=False, index=True)
    
    # 📅 When created
    created_at = Column(DateTime, server_default=func.now())


class CircleMembership(Base):
    """
    🤝 Circle Membership - Tracks which users are in which circles
    """
    __tablename__ = "circle_memberships"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👥 Circle ID
    circle_id = Column(Integer, nullable=False, index=True)
    
    # 👤 User ID
    user_id = Column(Integer, nullable=False, index=True)
    
    # 📅 When they joined
    joined_at = Column(DateTime, server_default=func.now())
    
    # Ensure unique membership per circle
    __table_args__ = (
        # Composite unique constraint
        {'sqlite_autoincrement': True},
    )


class CircleCheckin(Base):
    """
    Circle Check-in - Weekly pulse from circle members
    
    One check-in per member per week (Monday-Sunday).
    """
    __tablename__ = "circle_checkins"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    circle_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    emoji = Column(String, nullable=True)
    message = Column(String, nullable=True)
    week_start = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class RunPhoto(Base):
    """
    📸 Run Photo - Photos tagged to distance markers within a run

    Part of the Scenic Runs feature. Each photo is tagged to a specific
    kilometer marker (e.g. "at the 5K mark" on a 10K run).
    """
    __tablename__ = "run_photos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    run_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    photo_data = Column(String, nullable=False)  # base64-encoded JPEG (full size)
    thumb_data = Column(String, nullable=True)  # base64-encoded JPEG (~360px)
    distance_marker_km = Column(Float, nullable=False)  # e.g. 2.0, 5.0
    caption = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class CircleFeedReaction(Base):
    """Reactions on circle feed items (runs, check-ins)."""
    __tablename__ = "circle_feed_reactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    circle_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    target_type = Column(String, nullable=False)  # "run" or "checkin"
    target_id = Column(Integer, nullable=False)
    emoji = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class WeeklyReflection(Base):
    """End-of-week reflection: how did this week feel?"""
    __tablename__ = "weekly_reflections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    week_start = Column(DateTime, nullable=False)
    reflection = Column(String, nullable=True)
    mood = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class PasswordResetToken(Base):
    """
    🔐 Password Reset Token - For forgot password flow
    
    Stores temporary reset codes with expiration.
    """
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👤 User requesting reset
    user_id = Column(Integer, nullable=False, index=True)
    
    # 📧 Email for quick lookup
    email = Column(String, nullable=False, index=True)
    
    # 🔑 6-digit reset code
    reset_code = Column(String, nullable=False)
    
    # ⏰ When this token expires (15 minutes from creation)
    expires_at = Column(DateTime, nullable=False)
    
    # ✅ Has this token been used?
    used = Column(Boolean, default=False)
    
    # 📅 When created
    created_at = Column(DateTime, server_default=func.now())


class Exercise(Base):
    """Exercise catalog entry. Built-in exercises have user_id=NULL."""
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)
    name = Column(String, nullable=False)
    muscle_group = Column(String, nullable=False, server_default='other')
    equipment = Column(String, nullable=True)
    default_weight_kg = Column(Float, nullable=False, server_default='0')
    increment_kg = Column(Float, nullable=False, server_default='2.5')
    default_sets = Column(Integer, nullable=False, server_default='3')
    default_reps = Column(Integer, nullable=False, server_default='10')
    is_timed = Column(Boolean, default=False, server_default='false')
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_exercise_user_name'),
    )


class GymWorkout(Base):
    """Logged strength training workout with per-exercise data stored as JSON."""
    __tablename__ = "gym_workouts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    completed_at = Column(DateTime, server_default=func.now())
    exercises = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Walk(Base):
    """
    🚶 Walk Model - Map-tracked walks

    Each row represents one walk with a GPS-tracked route.
    """
    __tablename__ = "walks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)

    # Timing
    started_at = Column(DateTime, server_default=func.now())
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=False)

    # Distance and route
    distance_km = Column(Float, nullable=False)
    route_polyline = Column(Text, nullable=True)  # Google encoded polyline

    # Bounding info (for quick map preview without decoding the polyline)
    start_lat = Column(Float, nullable=True)
    start_lng = Column(Float, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lng = Column(Float, nullable=True)

    # Derived metrics
    elevation_gain_m = Column(Float, nullable=True)
    avg_pace_seconds_per_km = Column(Float, nullable=True)

    # User input
    notes = Column(String, nullable=True)
    mood = Column(String, nullable=True)  # peaceful, energising, tough, scenic
    category = Column(String, nullable=True, default="outdoor")  # outdoor, treadmill, indoor

    # Linked public route (if the user followed one)
    public_walk_id = Column(Integer, nullable=True, index=True)

    # 🧠 Coach's note — short post-walk journal annotation.
    coach_note = Column(Text, nullable=True)
    coach_note_generated_at = Column(DateTime, nullable=True)

    # 🌅 Journey attribution — when set, this walk counts toward the
    # accumulated distance of the user's active Journey (Phase 5).
    journey_id = Column(Integer, nullable=True, index=True)

    # 🍎 Source attribution for HealthKit imports — see Run.source above.
    source = Column(String, nullable=True, default="live")
    external_id = Column(String, nullable=True, index=True)

    created_at = Column(DateTime, server_default=func.now())


class WalkPhoto(Base):
    """
    📸 Walk Photo - Photos pinned along a walk's route
    """
    __tablename__ = "walk_photos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    walk_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    photo_data = Column(String, nullable=False)  # base64-encoded JPEG (full size)
    thumb_data = Column(String, nullable=True)  # base64-encoded JPEG (~360px)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    distance_marker_km = Column(Float, nullable=True)
    caption = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class PublicWalk(Base):
    """
    🌍 Public Walk - Recommended/discoverable walking routes

    Sourced from OpenStreetMap (via Overpass API) or curated.
    """
    __tablename__ = "public_walks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    osm_id = Column(String, nullable=True, index=True)  # OSM relation/way id
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    distance_km = Column(Float, nullable=False)
    estimated_duration_min = Column(Integer, nullable=True)
    difficulty = Column(String, nullable=True)  # easy, moderate, hard
    route_polyline = Column(Text, nullable=False)
    start_lat = Column(Float, nullable=False)
    start_lng = Column(Float, nullable=False)
    region = Column(String, nullable=True)
    country = Column(String, nullable=True)
    tags = Column(String, nullable=True)  # JSON array of tag strings
    source = Column(String, nullable=True)  # 'osm' | 'curated'
    cached_at = Column(DateTime, server_default=func.now())


class GeocodeCache(Base):
    """Reverse-geocode cache keyed by rounded lat/lng to limit Nominatim calls."""
    __tablename__ = "geocode_cache"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    lat_key = Column(Float, nullable=False, index=True)
    lng_key = Column(Float, nullable=False, index=True)
    city = Column(String, nullable=False)
    country = Column(String, nullable=True)
    centroid_lat = Column(Float, nullable=True)
    centroid_lng = Column(Float, nullable=True)
    raw_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("lat_key", "lng_key", name="uq_geocode_lat_lng"),)


class WaypointGeocodeCache(Base):
    """🗺 Forward-geocode cache for journey waypoints.

    The Guide names places like "Westminster Bridge, London, UK"; the
    route planner forward-geocodes them via Nominatim to draw the path
    on the map. Nominatim's free tier caps at 1 req/s, so without a
    cache, generating a single 30k journey suggestion (8 waypoints) is
    a guaranteed rate-limit storm — most names fail silently and the
    map shows a stub line between the survivors.

    We hash the normalised (lower-cased, whitespace-collapsed) query
    string + the optional city hint to a single cache key. On a hit we
    skip Nominatim entirely. Misses are also persisted so we don't
    repeat lookups that we know don't resolve.
    """
    __tablename__ = "waypoint_geocode_cache"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    cache_key = Column(String, nullable=False, unique=True, index=True)
    query = Column(String, nullable=False)  # original waypoint name
    city_hint = Column(String, nullable=True)  # home_city forwarded at lookup time
    lat = Column(Float, nullable=True)  # NULL = remembered miss
    lng = Column(Float, nullable=True)
    resolved = Column(Boolean, default=False, server_default="false", nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class NeighbourhoodSave(Base):
    __tablename__ = "neighbourhood_saves"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "run_id", name="uq_neighbourhood_save_user_run"),)


class NeighbourhoodIRanThis(Base):
    __tablename__ = "neighbourhood_iran_this"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "run_id", name="uq_neighbourhood_iran_user_run"),)


class NeighbourhoodBlockedHandle(Base):
    """Viewer hides runs from these handles in their neighbourhood feed."""
    __tablename__ = "neighbourhood_blocked_handles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    blocked_handle = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "blocked_handle", name="uq_neighbourhood_block_user_handle"),)


class NeighbourhoodReport(Base):
    __tablename__ = "neighbourhood_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reporter_id = Column(Integer, nullable=False, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class RunReaction(Base):
    """Public, count-displayed reactions on a run from the Neighbourhood
    feed. Like / Zen are stored here; Love is intentionally kept in
    NeighbourhoodIRanThis (it doubles as the "I want to run this" signal
    used by the existing share + map experience). One row per
    (user, run, emoji)."""

    __tablename__ = "run_reactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    run_id = Column(Integer, nullable=False, index=True)
    emoji = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "run_id", "emoji", name="uq_run_reaction"),
    )


class UserAchievement(Base):
    """Records the moment a user first transitioned a badge from locked
    to unlocked. Used to show genuinely "recent" milestones on Home and
    in any future "just earned" toast. One row per (user, achievement)."""

    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    achievement_id = Column(String, nullable=False, index=True)
    unlocked_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )


class CoachMessage(Base):
    """Single turn in an "Ask coach" conversation.

    Per-user rolling history; we keep the last N turns when composing
    context. role is "user" or "assistant". Older turns are pruned by
    time, not by deletion of this row.
    """
    __tablename__ = "coach_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)


class CoachRunScript(Base):
    """Pre-generated voice lines for an in-run companion session.

    A script is generated when a user starts a coach-prescribed run and
    consumed line-by-line by the client. Scripts are immutable; if the
    plan changes, a new script is created.
    """
    __tablename__ = "coach_run_scripts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    activity = Column(String, nullable=False)  # outdoor_run | treadmill | walk | journey
    target_distance_km = Column(Float, nullable=False)
    plan_summary = Column(Text, nullable=True)
    lines_json = Column(Text, nullable=False)  # JSON: list of line dicts
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class CoachTodayCard(Base):
    """Cached one-line Today's recommendation for a given user-day.

    Daily cache so we don't burn an LLM call every time Home is opened.
    Key: (user_id, day_iso). Generated lazily on the first read of the
    day for users with coach_today_card enabled.
    """
    __tablename__ = "coach_today_cards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    day_iso = Column(String, nullable=False)  # "YYYY-MM-DD" in user's local tz at generation time
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "day_iso", name="uq_coach_today_card_user_day"),
    )


class Journey(Base):
    """🌅 Slow ultra — a single big day, or a 2–3 day adventure.

    Two flavours:
    - 20k / 30k → "one go" journeys (max_days = 1). The runner sets out for
      one big day. All activities in that calendar day count toward the line.
    - 50k / 75k / 100k → multi-day journeys (max_days = 3). The runner can
      split the distance across up to three calendar days.

    A journey is "expired" (past its window) when now > started_at +
    max_days. Expired journeys remain `active` until the user marks them
    complete or abandoned, but new runs/walks no longer auto-attribute to
    them.

    Lifecycle:
    - planned    : on the to-do list, with an optional scheduled_for date.
                   Not attributing yet. The user will tap "Start it now"
                   when they're ready (usually on the scheduled day).
    - active     : within (or just past) the journey window. Auto-attributing
                   runs and walks to its accumulated_km.
    - completed  : the user marked the journey done (auto on hitting target).
    - abandoned  : the user explicitly bailed out.

    A user can hold many `planned` journeys + one `active` at a time.
    """
    __tablename__ = "journeys"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False)
    tier = Column(String, nullable=False, index=True)  # "20k" | "30k" | "50k" | "60k" | "75k" | "100k"
    target_distance_km = Column(Float, nullable=False)
    # Hard time-window for attribution: 1 for one-go journeys (20k/30k),
    # 3 for multi-day journeys (50k/75k/100k).
    max_days = Column(Integer, nullable=False, default=1)
    status = Column(String, nullable=False, default="planned", index=True)
    plan_summary = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    # 🌅 Guide-written reflection on the completed journey. Generated once on
    # auto-complete (or manual complete) and immutable thereafter. NULL while
    # the journey is active or abandoned.
    completion_note = Column(Text, nullable=True)
    # 🌅 Guide-written readiness assessment, generated at preview time and
    # persisted on the journey. 1–2 sentences: what we noticed in the user's
    # recent activity vs. the ask. Shown on the planned journey detail.
    readiness_note = Column(Text, nullable=True)
    # 🌅 Discrete prep checklist (JSON array of short strings). Generated at
    # preview time. Distinct from `plan_summary`, which is the prose blurb.
    prep_checklist_json = Column(Text, nullable=True)
    # 🗓 Optional planned date (calendar date the user means to start). Stored
    # as a DateTime at midnight UTC of the chosen day; only the date portion
    # is meaningful. NULL if the user just hit "start now".
    scheduled_for = Column(DateTime, nullable=True)
    # 🗓 When the user actually flipped from planned → active. NULL while
    # planned. For journeys that go straight to active, equals started_at.
    activated_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, server_default=func.now(), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # 🛣 Recommended route — Guide suggestions only. NULL for static-template
    # journeys; the planned-detail screen falls back to the "usual ground"
    # map context in that case. Polyline is Google encoded format
    # (precision 5), waypoints/directions are JSON arrays.
    waypoints_json = Column(Text, nullable=True)
    directions_json = Column(Text, nullable=True)
    route_polyline = Column(Text, nullable=True)


class JourneyDayBrief(Base):
    """🌅 Per-day Guide brief for multi-day journeys (50k/60k/75k/100k).

    Generated once per (journey, day_index) on the first activity save of
    that day. Day 1 is the start day. Stored verbatim — re-reading the
    brief later returns the exact same text the runner saw that morning.
    """
    __tablename__ = "journey_day_briefs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    journey_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    day_index = Column(Integer, nullable=False)  # 1-based: day 1 / day 2 / day 3
    text = Column(Text, nullable=False)
    is_stub = Column(Boolean, default=False)
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)