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