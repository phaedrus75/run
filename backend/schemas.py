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

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class RunType(str, Enum):
    """Valid run types - matches the database model"""
    THREE_K = "3k"
    FIVE_K = "5k"
    TEN_K = "10k"
    FIFTEEN_K = "15k"
    TWENTY_K = "20k"


# 🗺️ Map run types to distances
RUN_DISTANCES = {
    "3k": 3.0,
    "5k": 5.0,
    "10k": 10.0,
    "15k": 15.0,
    "18k": 18.0,
    "21k": 21.0,
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
    run_type: str = Field(..., description="Type of run: 3k, 5k, 10k, 15k, 18k, or 21k")
    duration_seconds: int = Field(..., ge=0, description="How long the run took in seconds")
    notes: Optional[str] = Field(None, description="Optional notes about your run")
    completed_at: Optional[datetime] = Field(None, description="When the run was completed (for backdating)")
    category: Optional[str] = Field("outdoor", description="Category: outdoor or treadmill")
    
    class Config:
        # 📖 Example for the auto-generated docs
        json_schema_extra = {
            "example": {
                "run_type": "5k",
                "duration_seconds": 1800,
                "notes": "Felt great today! 🎉",
                "completed_at": "2024-01-15T09:30:00",
                "category": "outdoor"
            }
        }


class RunUpdate(BaseModel):
    """
    ✏️ Schema for UPDATING a run
    
    All fields are optional - only provided fields are updated.
    """
    run_type: Optional[str] = Field(None, description="Type of run: 3k, 5k, 10k, 15k, 18k, or 21k")
    duration_seconds: Optional[int] = Field(None, ge=0, description="How long the run took in seconds")
    notes: Optional[str] = Field(None, description="Optional notes about your run")
    category: Optional[str] = Field(None, description="Category: outdoor or treadmill")
    
    class Config:
        json_schema_extra = {
            "example": {
                "duration_seconds": 1650,
                "notes": "Updated - actually felt even better!",
                "category": "treadmill"
            }
        }


class RunResponse(BaseModel):
    """
    📤 Schema for RETURNING run data
    
    This is what the API sends back. Includes all fields.
    """
    id: int
    run_type: str
    duration_seconds: int
    distance_km: float
    completed_at: datetime
    notes: Optional[str]
    
    # 🎯 Calculated fields for the frontend
    pace_per_km: str = ""  # e.g., "6:30"
    formatted_duration: str = ""  # e.g., "32:30"
    
    class Config:
        from_attributes = True  # Allows converting from database model


# ==========================================
# 📅 WEEKLY PLAN SCHEMAS
# ==========================================

class WeeklyPlanCreate(BaseModel):
    """Schema for creating a weekly plan"""
    week_id: str = Field(..., description="Week identifier like '2024-W01'")
    planned_runs: List[str] = Field(..., description="List of planned run types")
    
    class Config:
        json_schema_extra = {
            "example": {
                "week_id": "2024-W01",
                "planned_runs": ["3k", "5k", "3k", "10k"]
            }
        }


class WeeklyPlanResponse(BaseModel):
    """Schema for returning weekly plan data"""
    id: int
    week_id: str
    planned_runs: List[str]
    created_at: datetime
    
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
    - Need 1 long run (10k+)
    - Need 2+ short runs (any)
    """
    long_runs_completed: int
    long_runs_needed: int
    short_runs_completed: int
    short_runs_needed: int
    is_complete: bool
    current_streak: int
    longest_streak: int
    message: str


# ==========================================
# ⚖️ WEIGHT TRACKING SCHEMAS
# ==========================================

class WeightCreate(BaseModel):
    """
    📥 Schema for CREATING a weight entry
    """
    weight_lbs: float = Field(..., gt=0, description="Weight in pounds")
    recorded_at: Optional[datetime] = Field(None, description="When this weight was recorded (for backdating)")
    notes: Optional[str] = Field(None, description="Optional notes")
    
    class Config:
        json_schema_extra = {
            "example": {
                "weight_lbs": 205.5,
                "recorded_at": "2026-01-10T08:00:00",
                "notes": "Morning weight"
            }
        }


class WeightResponse(BaseModel):
    """
    📤 Schema for RETURNING weight data
    """
    id: int
    weight_lbs: float
    recorded_at: datetime
    notes: Optional[str]
    
    class Config:
        from_attributes = True


class WeightProgress(BaseModel):
    """
    📊 Weight Progress Summary
    
    Shows progress toward weight goal.
    """
    start_weight: float  # Starting weight (Jan 7: 209lb)
    current_weight: float  # Most recent weight
    goal_weight: float  # Target weight (180lb)
    weight_lost: float  # How much lost so far
    weight_to_lose: float  # How much left to lose
    percent_complete: float  # Progress percentage
    on_track: bool  # Are we on track to hit goal?
    trend: str  # "down", "up", "stable"
    entries_count: int  # Total weight entries
