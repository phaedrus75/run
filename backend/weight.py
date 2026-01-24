"""
⚖️ WEIGHT TRACKING MODULE
===========================

Tracks weight over time with goal progress.
Goal: 209lb (Jan 7, 2026) → 180lb (Dec 31, 2026)
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import Weight

# ==========================================
# 🎯 WEIGHT GOAL CONFIGURATION
# ==========================================

START_WEIGHT = 209.0  # Starting weight on Jan 7, 2026
GOAL_WEIGHT = 180.0   # Target weight by Dec 31, 2026
START_DATE = datetime(2026, 1, 7)
END_DATE = datetime(2026, 12, 31)


def create_weight_entry(db: Session, weight_lbs: float, recorded_at: Optional[datetime] = None, notes: Optional[str] = None, user_id: Optional[int] = None) -> Weight:
    """
    ⚖️ Create a new weight entry
    """
    entry = Weight(
        weight_lbs=weight_lbs,
        recorded_at=recorded_at or datetime.now(),
        notes=notes,
        user_id=user_id
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_all_weights(db: Session, limit: int = 100, user_id: Optional[int] = None) -> List[Weight]:
    """
    📋 Get all weight entries for a user, most recent first
    """
    query = db.query(Weight)
    if user_id is not None:
        query = query.filter(Weight.user_id == user_id)
    return query.order_by(desc(Weight.recorded_at)).limit(limit).all()


def get_latest_weight(db: Session) -> Optional[Weight]:
    """
    📊 Get the most recent weight entry
    """
    return db.query(Weight).order_by(desc(Weight.recorded_at)).first()


def delete_weight_entry(db: Session, weight_id: int) -> bool:
    """
    🗑️ Delete a weight entry
    """
    entry = db.query(Weight).filter(Weight.id == weight_id).first()
    if entry:
        db.delete(entry)
        db.commit()
        return True
    return False


def get_weight_progress(db: Session, user_id: Optional[int] = None) -> dict:
    """
    📊 Get weight progress summary for a specific user
    
    Calculates:
    - How much weight lost
    - Percentage toward goal
    - Whether on track
    - Trend (up/down/stable)
    """
    from models import UserGoals
    
    now = datetime.now()
    
    # Get user's personal weight goals if available
    user_start_weight = None
    user_goal_weight = None
    
    if user_id is not None:
        user_goals = db.query(UserGoals).filter(UserGoals.user_id == user_id).first()
        if user_goals:
            user_start_weight = user_goals.start_weight_lbs
            user_goal_weight = user_goals.goal_weight_lbs
    
    # Use user's goals or defaults
    start_weight = user_start_weight if user_start_weight else START_WEIGHT
    goal_weight = user_goal_weight if user_goal_weight else GOAL_WEIGHT
    
    # Get all weights for 2026 for this user
    query = db.query(Weight).filter(
        Weight.recorded_at >= datetime(2026, 1, 1)
    )
    if user_id is not None:
        query = query.filter(Weight.user_id == user_id)
    weights = query.order_by(Weight.recorded_at).all()
    
    # If no weights logged yet, return based on user's settings
    if not weights:
        # If user hasn't set goals yet, return empty state
        if user_start_weight is None:
            return {
                "start_weight": None,
                "current_weight": None,
                "goal_weight": user_goal_weight,
                "weight_lost": 0,
                "weight_to_lose": 0,
                "percent_complete": 0,
                "on_track": False,
                "trend": "stable",
                "entries_count": 0,
                "needs_setup": True,
            }
        return {
            "start_weight": start_weight,
            "current_weight": start_weight,
            "goal_weight": goal_weight,
            "weight_lost": 0,
            "weight_to_lose": start_weight - goal_weight if goal_weight else 0,
            "percent_complete": 0,
            "on_track": False,
            "trend": "stable",
            "entries_count": 0,
            "needs_setup": False,
        }
    
    # Current weight is the most recent entry
    current_weight = weights[-1].weight_lbs
    
    # Weight lost from start
    weight_lost = start_weight - current_weight if start_weight else 0
    total_to_lose = start_weight - goal_weight if (start_weight and goal_weight) else 0
    weight_to_lose = max(0, current_weight - goal_weight) if goal_weight else 0
    
    # Progress percentage
    if total_to_lose > 0:
        percent_complete = min(100, max(0, (weight_lost / total_to_lose) * 100))
    elif goal_weight and current_weight <= goal_weight:
        percent_complete = 100
    else:
        percent_complete = 0
    
    # Calculate if on track
    # Linear progression from start date to end date
    days_elapsed = (now - START_DATE).days
    total_days = (END_DATE - START_DATE).days
    if start_weight and total_to_lose > 0 and total_days > 0:
        expected_weight = start_weight - (total_to_lose * (days_elapsed / total_days))
        on_track = current_weight <= expected_weight + 2  # 2lb buffer
    else:
        on_track = False
    
    # Calculate trend (compare last 3 entries)
    trend = "stable"
    if len(weights) >= 3:
        recent = [w.weight_lbs for w in weights[-3:]]
        if recent[-1] < recent[0] - 0.5:
            trend = "down"
        elif recent[-1] > recent[0] + 0.5:
            trend = "up"
    elif len(weights) >= 2:
        if weights[-1].weight_lbs < weights[-2].weight_lbs - 0.5:
            trend = "down"
        elif weights[-1].weight_lbs > weights[-2].weight_lbs + 0.5:
            trend = "up"
    
    return {
        "start_weight": start_weight,
        "current_weight": round(current_weight, 1),
        "goal_weight": goal_weight,
        "weight_lost": round(weight_lost, 1) if weight_lost else 0,
        "weight_to_lose": round(weight_to_lose, 1) if weight_to_lose else 0,
        "percent_complete": round(percent_complete, 1),
        "on_track": on_track,
        "trend": trend,
        "entries_count": len(weights),
        "needs_setup": user_start_weight is None,
    }


def get_weight_chart_data(db: Session, user_id: Optional[int] = None) -> List[dict]:
    """
    📈 Get weight data for charting for a specific user
    
    Returns list of {date, weight} for the last 30 entries
    """
    query = db.query(Weight).filter(
        Weight.recorded_at >= datetime(2026, 1, 1)
    )
    if user_id is not None:
        query = query.filter(Weight.user_id == user_id)
    weights = query.order_by(Weight.recorded_at).limit(100).all()
    
    return [
        {
            "date": w.recorded_at.strftime("%Y-%m-%d"),
            "weight": w.weight_lbs,
            "label": w.recorded_at.strftime("%b %d"),
        }
        for w in weights
    ]
