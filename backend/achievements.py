"""
🏆 ACHIEVEMENTS & GOALS SYSTEM
===============================

Tracks personal records, achievements, and goals.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from models import Run

# ==========================================
# 🎯 GOALS CONFIGURATION
# ==========================================

YEARLY_GOAL_KM = 1000  # 1000km for 2026
MONTHLY_GOAL_KM = 100   # 100km per month

# ==========================================
# 🏆 ACHIEVEMENTS DEFINITIONS
# ==========================================

ACHIEVEMENTS = {
    # Distance Milestones
    "first_run": {
        "id": "first_run",
        "name": "First Steps",
        "description": "Complete your first run",
        "emoji": "👟",
        "category": "milestone",
        "check": lambda stats: stats["total_runs"] >= 1,
    },
    "km_50": {
        "id": "km_50",
        "name": "Getting Started",
        "description": "Run 50km total",
        "emoji": "🌱",
        "category": "distance",
        "check": lambda stats: stats["total_km"] >= 50,
    },
    "km_100": {
        "id": "km_100",
        "name": "Century",
        "description": "Run 100km total",
        "emoji": "💯",
        "category": "distance",
        "check": lambda stats: stats["total_km"] >= 100,
    },
    "km_250": {
        "id": "km_250",
        "name": "Quarter Thousand",
        "description": "Run 250km total",
        "emoji": "🏃",
        "category": "distance",
        "check": lambda stats: stats["total_km"] >= 250,
    },
    "km_500": {
        "id": "km_500",
        "name": "Half Way There",
        "description": "Run 500km total",
        "emoji": "🔥",
        "category": "distance",
        "check": lambda stats: stats["total_km"] >= 500,
    },
    "km_1000": {
        "id": "km_1000",
        "name": "Thousand Club",
        "description": "Run 1000km total",
        "emoji": "👑",
        "category": "distance",
        "check": lambda stats: stats["total_km"] >= 1000,
    },
    
    # Run Count Milestones
    "runs_10": {
        "id": "runs_10",
        "name": "Double Digits",
        "description": "Complete 10 runs",
        "emoji": "🔟",
        "category": "milestone",
        "check": lambda stats: stats["total_runs"] >= 10,
    },
    "runs_25": {
        "id": "runs_25",
        "name": "Quarter Century",
        "description": "Complete 25 runs",
        "emoji": "⭐",
        "category": "milestone",
        "check": lambda stats: stats["total_runs"] >= 25,
    },
    "runs_50": {
        "id": "runs_50",
        "name": "Fifty Club",
        "description": "Complete 50 runs",
        "emoji": "🌟",
        "category": "milestone",
        "check": lambda stats: stats["total_runs"] >= 50,
    },
    "runs_100": {
        "id": "runs_100",
        "name": "Century Runner",
        "description": "Complete 100 runs",
        "emoji": "💫",
        "category": "milestone",
        "check": lambda stats: stats["total_runs"] >= 100,
    },
    
    # Distance Type Achievements
    "first_10k": {
        "id": "first_10k",
        "name": "Double Digits",
        "description": "Complete your first 10k",
        "emoji": "🏅",
        "category": "distance_type",
        "check": lambda stats: stats.get("runs_by_type", {}).get("10k", 0) >= 1,
    },
    "first_15k": {
        "id": "first_15k",
        "name": "Going Long",
        "description": "Complete your first 15k",
        "emoji": "🎖️",
        "category": "distance_type",
        "check": lambda stats: stats.get("runs_by_type", {}).get("15k", 0) >= 1,
    },
    "first_20k": {
        "id": "first_20k",
        "name": "Beast Mode",
        "description": "Complete your first 20k",
        "emoji": "🦁",
        "category": "distance_type",
        "check": lambda stats: stats.get("runs_by_type", {}).get("20k", 0) >= 1,
    },
    "ten_10ks": {
        "id": "ten_10ks",
        "name": "10K Specialist",
        "description": "Complete ten 10k runs",
        "emoji": "🏆",
        "category": "distance_type",
        "check": lambda stats: stats.get("runs_by_type", {}).get("10k", 0) >= 10,
    },
    
    # Streak Achievements
    "streak_2": {
        "id": "streak_2",
        "name": "Consistency",
        "description": "Achieve a 2-week streak",
        "emoji": "🔥",
        "category": "streak",
        "check": lambda stats: stats.get("longest_streak", 0) >= 2,
    },
    "streak_4": {
        "id": "streak_4",
        "name": "Month Strong",
        "description": "Achieve a 4-week streak",
        "emoji": "💪",
        "category": "streak",
        "check": lambda stats: stats.get("longest_streak", 0) >= 4,
    },
    "streak_8": {
        "id": "streak_8",
        "name": "Unstoppable",
        "description": "Achieve an 8-week streak",
        "emoji": "⚡",
        "category": "streak",
        "check": lambda stats: stats.get("longest_streak", 0) >= 8,
    },
    "streak_12": {
        "id": "streak_12",
        "name": "Quarter Year",
        "description": "Achieve a 12-week streak",
        "emoji": "🚀",
        "category": "streak",
        "check": lambda stats: stats.get("longest_streak", 0) >= 12,
    },
    
    # Monthly Goals
    "monthly_goal_1": {
        "id": "monthly_goal_1",
        "name": "Goal Getter",
        "description": "Hit your monthly 100km goal",
        "emoji": "🎯",
        "category": "goals",
        "check": lambda stats: stats.get("monthly_goals_hit", 0) >= 1,
    },
    "monthly_goal_3": {
        "id": "monthly_goal_3",
        "name": "Hat Trick",
        "description": "Hit your monthly goal 3 times",
        "emoji": "🎩",
        "category": "goals",
        "check": lambda stats: stats.get("monthly_goals_hit", 0) >= 3,
    },
    "monthly_goal_6": {
        "id": "monthly_goal_6",
        "name": "Half Year Hero",
        "description": "Hit your monthly goal 6 times",
        "emoji": "🦸",
        "category": "goals",
        "check": lambda stats: stats.get("monthly_goals_hit", 0) >= 6,
    },
}


def get_personal_records(db: Session) -> dict:
    """
    🏆 Get personal records for each distance
    
    Returns fastest time for 3k, 5k, 10k, 15k, 20k
    """
    min_date = datetime(2026, 1, 1)
    
    records = {}
    for run_type in ["3k", "5k", "10k", "15k", "18k", "21k"]:
        # Get fastest run for this distance
        fastest = db.query(Run).filter(
            Run.run_type == run_type,
            Run.completed_at >= min_date
        ).order_by(Run.duration_seconds.asc()).first()
        
        if fastest:
            mins = fastest.duration_seconds // 60
            secs = fastest.duration_seconds % 60
            
            # Calculate pace
            distance = {"3k": 3, "5k": 5, "10k": 10, "15k": 15, "18k": 18, "21k": 21}[run_type]
            pace_seconds = fastest.duration_seconds / distance
            pace_mins = int(pace_seconds // 60)
            pace_secs = int(pace_seconds % 60)
            
            records[run_type] = {
                "time": f"{mins}:{secs:02d}",
                "duration_seconds": fastest.duration_seconds,
                "pace": f"{pace_mins}:{pace_secs:02d}",
                "date": fastest.completed_at.strftime("%Y-%m-%d"),
                "run_id": fastest.id,
            }
        else:
            records[run_type] = None
    
    return records


def get_goals_progress(db: Session, yearly_goal: float = None, monthly_goal: float = None) -> dict:
    """
    🎯 Get progress toward yearly and monthly goals
    
    Args:
        db: Database session
        yearly_goal: User's yearly goal (defaults to YEARLY_GOAL_KM if not provided)
        monthly_goal: User's monthly goal (defaults to MONTHLY_GOAL_KM if not provided)
    """
    # Use user goals or defaults
    yearly_target = yearly_goal if yearly_goal is not None else YEARLY_GOAL_KM
    monthly_target = monthly_goal if monthly_goal is not None else MONTHLY_GOAL_KM
    
    min_date = datetime(2026, 1, 1)
    now = datetime.now()
    
    # Yearly progress
    year_start = datetime(2026, 1, 1)
    year_runs = db.query(Run).filter(
        Run.completed_at >= year_start,
        Run.completed_at >= min_date
    ).all()
    yearly_km = sum(r.distance_km for r in year_runs)
    yearly_percent = min(100, (yearly_km / yearly_target) * 100) if yearly_target > 0 else 0
    
    # Monthly progress
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_runs = db.query(Run).filter(
        Run.completed_at >= month_start,
        Run.completed_at >= min_date
    ).all()
    monthly_km = sum(r.distance_km for r in month_runs)
    monthly_percent = min(100, (monthly_km / monthly_target) * 100) if monthly_target > 0 else 0
    
    # Count months where goal was hit (uses default for historical comparison)
    monthly_goals_hit = 0
    for month in range(1, now.month + 1):
        m_start = datetime(2026, month, 1)
        if month == 12:
            m_end = datetime(2027, 1, 1)
        else:
            m_end = datetime(2026, month + 1, 1)
        
        m_runs = db.query(Run).filter(
            Run.completed_at >= m_start,
            Run.completed_at < m_end
        ).all()
        m_km = sum(r.distance_km for r in m_runs)
        if m_km >= monthly_target:
            monthly_goals_hit += 1
    
    # Days remaining calculations
    days_left_in_month = (datetime(now.year, now.month + 1 if now.month < 12 else 1, 1) - now).days
    days_left_in_year = (datetime(2027, 1, 1) - now).days
    
    return {
        "yearly": {
            "goal_km": yearly_target,
            "current_km": round(yearly_km, 1),
            "remaining_km": round(max(0, yearly_target - yearly_km), 1),
            "percent": round(yearly_percent, 1),
            "days_remaining": days_left_in_year,
            "on_track": yearly_km >= (yearly_target * (now.timetuple().tm_yday / 365)),
        },
        "monthly": {
            "goal_km": monthly_target,
            "current_km": round(monthly_km, 1),
            "remaining_km": round(max(0, monthly_target - monthly_km), 1),
            "percent": round(monthly_percent, 1),
            "days_remaining": days_left_in_month,
            "month_name": now.strftime("%B"),
            "is_complete": monthly_km >= monthly_target,
        },
        "monthly_goals_hit": monthly_goals_hit,
    }


def get_achievements(db: Session, stats: dict) -> dict:
    """
    🎖️ Get all achievements and their unlock status
    """
    min_date = datetime(2026, 1, 1)
    
    # Build extended stats for achievement checking
    all_runs = db.query(Run).filter(Run.completed_at >= min_date).all()
    
    runs_by_type = {}
    for run in all_runs:
        runs_by_type[run.run_type] = runs_by_type.get(run.run_type, 0) + 1
    
    goals = get_goals_progress(db)
    
    extended_stats = {
        **stats,
        "runs_by_type": runs_by_type,
        "monthly_goals_hit": goals["monthly_goals_hit"],
    }
    
    # Check each achievement
    unlocked = []
    locked = []
    
    for achievement_id, achievement in ACHIEVEMENTS.items():
        is_unlocked = achievement["check"](extended_stats)
        
        achievement_data = {
            "id": achievement["id"],
            "name": achievement["name"],
            "description": achievement["description"],
            "emoji": achievement["emoji"],
            "category": achievement["category"],
            "unlocked": is_unlocked,
        }
        
        if is_unlocked:
            unlocked.append(achievement_data)
        else:
            locked.append(achievement_data)
    
    return {
        "unlocked": unlocked,
        "locked": locked,
        "total": len(ACHIEVEMENTS),
        "unlocked_count": len(unlocked),
    }


def check_new_pr(db: Session, run: Run) -> Optional[dict]:
    """
    🏆 Check if a run is a new personal record
    
    Returns PR info if it's a new record, None otherwise
    """
    min_date = datetime(2026, 1, 1)
    
    # Get all runs of this type before this run
    previous_runs = db.query(Run).filter(
        Run.run_type == run.run_type,
        Run.completed_at >= min_date,
        Run.id != run.id
    ).all()
    
    if not previous_runs:
        # First run of this type - it's a PR!
        return {
            "is_first": True,
            "message": f"🎉 First {run.run_type.upper()} completed!",
        }
    
    # Check if this is faster than all previous
    fastest_previous = min(r.duration_seconds for r in previous_runs)
    
    if run.duration_seconds < fastest_previous:
        improvement = fastest_previous - run.duration_seconds
        mins = improvement // 60
        secs = improvement % 60
        
        return {
            "is_first": False,
            "improvement_seconds": improvement,
            "message": f"🏆 New {run.run_type.upper()} PR! {mins}:{secs:02d} faster!",
        }
    
    return None
