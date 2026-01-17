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
    """
    🏃 Run Types
    
    Using an Enum ensures only valid run types can be stored.
    This prevents typos and invalid data!
    """
    THREE_K = "3k"
    FIVE_K = "5k"
    TEN_K = "10k"
    FIFTEEN_K = "15k"
    TWENTY_K = "20k"


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


class WeeklyPlan(Base):
    """
    📅 Weekly Plan Model - Your running goals for a week
    
    Plan which runs you want to do each week.
    """
    __tablename__ = "weekly_plans"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
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
    
    # ⚖️ Weight in pounds
    weight_lbs = Column(Float, nullable=False)
    
    # 📅 When this weight was recorded
    recorded_at = Column(DateTime, server_default=func.now())
    
    # 📝 Optional notes (e.g., "morning weight", "after workout")
    notes = Column(String, nullable=True)
