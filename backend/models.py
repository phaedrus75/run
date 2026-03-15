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

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Enum
from sqlalchemy.sql import func
from database import Base
import enum


class RunType(str, enum.Enum):
    ONE_K = "1k"
    TWO_K = "2k"
    THREE_K = "3k"
    FIVE_K = "5k"
    EIGHT_K = "8k"
    TEN_K = "10k"
    FIFTEEN_K = "15k"
    EIGHTEEN_K = "18k"
    TWENTY_ONE_K = "21k"


class RunnerLevel(str, enum.Enum):
    BREATH = "breath"
    STRIDE = "stride"
    FLOW = "flow"
    ZEN = "zen"


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


class WeeklyPlan(Base):
    """
    📅 Weekly Plan Model - Your running goals for a week
    
    Plan which runs you want to do each week.
    """
    __tablename__ = "weekly_plans"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👤 User who logged this run
    user_id = Column(Integer, nullable=True, index=True)
    
    # 📅 Week identifier (e.g., "2024-W01" for first week of 2024)
    week_id = Column(String, nullable=False, unique=True)
    
    # 🎯 Planned runs as JSON string
    # Example: ["3k", "5k", "3k", "10k"]
    planned_runs = Column(String, nullable=False)
    
    # 📅 When this plan was created
    created_at = Column(DateTime, server_default=func.now())


class UserStats(Base):
    """
    📊 User Stats Model - Aggregated statistics
    
    We could calculate these on-the-fly, but storing them
    makes the app faster. Updated after each run.
    """
    __tablename__ = "user_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 🔢 Total number of runs completed
    total_runs = Column(Integer, default=0)
    
    # 📏 Total kilometers run
    total_km = Column(Float, default=0.0)
    
    # 🏆 Current streak (consecutive days with runs)
    current_streak = Column(Integer, default=0)
    
    # 🎖️ Longest streak ever
    longest_streak = Column(Integer, default=0)
    
    # 📅 Last updated
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Weight(Base):
    """
    ⚖️ Weight Model - Track weight over time
    
    Each row represents a weight measurement.
    Goal: Start 209lb (Jan 7, 2026) → 180lb (Dec 31, 2026)
    """
    __tablename__ = "weights"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👤 User who logged this run
    user_id = Column(Integer, nullable=True, index=True)
    
    # ⚖️ Weight in pounds
    weight_lbs = Column(Float, nullable=False)
    
    # 📅 When this weight was recorded
    recorded_at = Column(DateTime, server_default=func.now())
    
    # 📝 Optional notes (e.g., "morning weight", "after workout")
    notes = Column(String, nullable=True)
    
    # 👤 User who logged this weight (optional for backward compatibility)
    user_id = Column(Integer, nullable=True)


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
    
    # 📅 When the account was created
    created_at = Column(DateTime, server_default=func.now())


class StepEntry(Base):
    """
    👟 Step Entry Model - Track daily step counts
    
    Captures high step days (15k+, 20k+, 25k+).
    """
    __tablename__ = "step_entries"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 👤 User who logged this run
    user_id = Column(Integer, nullable=True, index=True)
    
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
    
    One check-in per member per week (Sunday-Saturday).
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
    photo_data = Column(String, nullable=False)  # base64-encoded JPEG
    distance_marker_km = Column(Float, nullable=False)  # e.g. 2.0, 5.0
    caption = Column(String, nullable=True)
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