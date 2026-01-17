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


def create_weight_entry(db: Session, weight_lbs: float, recorded_at: Optional[datetime] = None, notes: Optional[str] = None) -> Weight:
    """
    ⚖️ Create a new weight entry
    """
    entry = Weight(
        weight_lbs=weight_lbs,
        recorded_at=recorded_at or datetime.now(),
        notes=notes
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_all_weights(db: Session, limit: int = 100) -> List[Weight]:
    """
    📋 Get all weight entries, most recent first
    """
    return db.query(Weight).order_by(desc(Weight.recorded_at)).limit(limit).all()


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


def get_weight_progress(db: Session) -> dict:
    """
    📊 Get weight progress summary
    
    Calculates:
    - How much weight lost
    - Percentage toward goal
    - Whether on track
    - Trend (up/down/stable)
    """
    now = datetime.now()
    
    # Get all weights for 2026
    weights = db.query(Weight).filter(
        Weight.recorded_at >= datetime(2026, 1, 1)
    ).order_by(Weight.recorded_at).all()
    
    if not weights:
        return {
            "start_weight": START_WEIGHT,
            "current_weight": START_WEIGHT,
            "goal_weight": GOAL_WEIGHT,
            "weight_lost": 0,
            "weight_to_lose": START_WEIGHT - GOAL_WEIGHT,
            "percent_complete": 0,
            "on_track": False,
            "trend": "stable",
            "entries_count": 0,
        }
    
    # Current weight is the most recent entry
    current_weight = weights[-1].weight_lbs
    
    # Weight lost from start
    weight_lost = START_WEIGHT - current_weight
    total_to_lose = START_WEIGHT - GOAL_WEIGHT  # 29 lbs total
    weight_to_lose = max(0, current_weight - GOAL_WEIGHT)
    
    # Progress percentage
    if total_to_lose > 0:
        percent_complete = min(100, max(0, (weight_lost / total_to_lose) * 100))
    else:
        percent_complete = 100 if current_weight <= GOAL_WEIGHT else 0
    
    # Calculate if on track
    # Linear progression: should lose ~0.56 lbs/week (29 lbs over 52 weeks)
    days_elapsed = (now - START_DATE).days
    total_days = (END_DATE - START_DATE).days
    expected_weight = START_WEIGHT - (total_to_lose * (days_elapsed / total_days))
    on_track = current_weight <= expected_weight + 2  # 2lb buffer
    
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
        "start_weight": START_WEIGHT,
        "current_weight": round(current_weight, 1),
        "goal_weight": GOAL_WEIGHT,
        "weight_lost": round(weight_lost, 1),
        "weight_to_lose": round(weight_to_lose, 1),
        "percent_complete": round(percent_complete, 1),
        "on_track": on_track,
        "trend": trend,
        "entries_count": len(weights),
    }


def get_weight_chart_data(db: Session) -> List[dict]:
    """
    📈 Get weight data for charting
    
    Returns list of {date, weight} for the last 30 entries
    """
    weights = db.query(Weight).filter(
        Weight.recorded_at >= datetime(2026, 1, 1)
    ).order_by(Weight.recorded_at).limit(100).all()
    
    return [
        {
            "date": w.recorded_at.strftime("%Y-%m-%d"),
            "weight": w.weight_lbs,
            "label": w.recorded_at.strftime("%b %d"),
        }
        for w in weights
    ]
