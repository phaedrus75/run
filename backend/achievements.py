"""
🏆 ACHIEVEMENTS & GOALS SYSTEM
===============================

Tracks personal records, achievements, and goals.
50 achievements across 8 categories.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from models import Run

# ==========================================
# 🎯 GOALS CONFIGURATION
# ==========================================

YEARLY_GOAL_KM = 1000
MONTHLY_GOAL_KM = 100

# ==========================================
# 🏆 ACHIEVEMENTS DEFINITIONS (50 total)
# ==========================================

ACHIEVEMENTS = {
    # ---- MILESTONE: Run Count (8) ----
    "first_run": {
        "id": "first_run", "name": "First Steps",
        "description": "Complete your first run",
        "emoji": "👟", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 1,
    },
    "runs_5": {
        "id": "runs_5", "name": "High Five",
        "description": "Complete 5 runs",
        "emoji": "🖐️", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 5,
    },
    "runs_10": {
        "id": "runs_10", "name": "Double Digits",
        "description": "Complete 10 runs",
        "emoji": "🔟", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 10,
    },
    "runs_25": {
        "id": "runs_25", "name": "Quarter Century",
        "description": "Complete 25 runs",
        "emoji": "⭐", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 25,
    },
    "runs_50": {
        "id": "runs_50", "name": "Fifty Club",
        "description": "Complete 50 runs",
        "emoji": "🌟", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 50,
    },
    "runs_75": {
        "id": "runs_75", "name": "Diamond Runner",
        "description": "Complete 75 runs",
        "emoji": "💎", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 75,
    },
    "runs_100": {
        "id": "runs_100", "name": "Century Runner",
        "description": "Complete 100 runs",
        "emoji": "💫", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 100,
    },
    "runs_200": {
        "id": "runs_200", "name": "Unstoppable",
        "description": "Complete 200 runs",
        "emoji": "🏛️", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 200,
    },

    # ---- DISTANCE: Total KM (8) ----
    "km_25": {
        "id": "km_25", "name": "Warming Up",
        "description": "Run 25km total",
        "emoji": "🌤️", "category": "distance",
        "check": lambda s: s["total_km"] >= 25,
    },
    "km_50": {
        "id": "km_50", "name": "Getting Started",
        "description": "Run 50km total",
        "emoji": "🌱", "category": "distance",
        "check": lambda s: s["total_km"] >= 50,
    },
    "km_100": {
        "id": "km_100", "name": "Century",
        "description": "Run 100km total",
        "emoji": "💯", "category": "distance",
        "check": lambda s: s["total_km"] >= 100,
    },
    "km_250": {
        "id": "km_250", "name": "Quarter Thousand",
        "description": "Run 250km total",
        "emoji": "🏃", "category": "distance",
        "check": lambda s: s["total_km"] >= 250,
    },
    "km_500": {
        "id": "km_500", "name": "Half Way There",
        "description": "Run 500km total",
        "emoji": "🔥", "category": "distance",
        "check": lambda s: s["total_km"] >= 500,
    },
    "km_750": {
        "id": "km_750", "name": "Three Quarters",
        "description": "Run 750km total",
        "emoji": "🗻", "category": "distance",
        "check": lambda s: s["total_km"] >= 750,
    },
    "km_1000": {
        "id": "km_1000", "name": "Thousand Club",
        "description": "Run 1000km total",
        "emoji": "👑", "category": "distance",
        "check": lambda s: s["total_km"] >= 1000,
    },
    "km_1500": {
        "id": "km_1500", "name": "Ultra Distance",
        "description": "Run 1500km total",
        "emoji": "🌍", "category": "distance",
        "check": lambda s: s["total_km"] >= 1500,
    },

    # ---- DISTANCE TYPE: First completions (7) ----
    "first_3k": {
        "id": "first_3k", "name": "Starter",
        "description": "Complete your first 3K",
        "emoji": "🚶", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("3k", 0) >= 1,
    },
    "first_5k": {
        "id": "first_5k", "name": "Park Runner",
        "description": "Complete your first 5K",
        "emoji": "🌳", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("5k", 0) >= 1,
    },
    "first_10k": {
        "id": "first_10k", "name": "Into Double Digits",
        "description": "Complete your first 10K",
        "emoji": "🏅", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("10k", 0) >= 1,
    },
    "first_15k": {
        "id": "first_15k", "name": "Going Long",
        "description": "Complete your first 15K",
        "emoji": "🎖️", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("15k", 0) >= 1,
    },
    "first_18k": {
        "id": "first_18k", "name": "Almost There",
        "description": "Complete your first 18K",
        "emoji": "🦅", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("18k", 0) >= 1,
    },
    "first_21k": {
        "id": "first_21k", "name": "Half Marathon",
        "description": "Complete your first 21K",
        "emoji": "🦁", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("21k", 0) >= 1,
    },
    "all_distances": {
        "id": "all_distances", "name": "Full Spectrum",
        "description": "Run every distance at least once (3K-21K)",
        "emoji": "🌈", "category": "distance_type",
        "check": lambda s: all(
            s.get("runs_by_type", {}).get(d, 0) >= 1
            for d in ["3k", "5k", "10k", "15k", "18k", "21k"]
        ),
    },

    # ---- SPECIALIST: Repeat distances (7) ----
    "ten_3ks": {
        "id": "ten_3ks", "name": "3K Regular",
        "description": "Complete ten 3K runs",
        "emoji": "🔄", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("3k", 0) >= 10,
    },
    "ten_5ks": {
        "id": "ten_5ks", "name": "5K Veteran",
        "description": "Complete ten 5K runs",
        "emoji": "🎯", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("5k", 0) >= 10,
    },
    "ten_10ks": {
        "id": "ten_10ks", "name": "10K Specialist",
        "description": "Complete ten 10K runs",
        "emoji": "🏆", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("10k", 0) >= 10,
    },
    "five_15ks": {
        "id": "five_15ks", "name": "15K Warrior",
        "description": "Complete five 15K runs",
        "emoji": "⚔️", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("15k", 0) >= 5,
    },
    "five_18ks": {
        "id": "five_18ks", "name": "18K Iron Runner",
        "description": "Complete five 18K runs",
        "emoji": "🛡️", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("18k", 0) >= 5,
    },
    "five_21ks": {
        "id": "five_21ks", "name": "Half Marathon Veteran",
        "description": "Complete five 21K runs",
        "emoji": "🎖️", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("21k", 0) >= 5,
    },
    "twenty_5ks": {
        "id": "twenty_5ks", "name": "Parkrun Legend",
        "description": "Complete twenty 5K runs",
        "emoji": "🌲", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("5k", 0) >= 20,
    },

    # ---- STREAK: Consistency (6) ----
    "streak_2": {
        "id": "streak_2", "name": "Consistency",
        "description": "Achieve a 2-week streak",
        "emoji": "🔥", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 2,
    },
    "streak_4": {
        "id": "streak_4", "name": "Month Strong",
        "description": "Achieve a 4-week streak",
        "emoji": "💪", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 4,
    },
    "streak_8": {
        "id": "streak_8", "name": "Two Months",
        "description": "Achieve an 8-week streak",
        "emoji": "⚡", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 8,
    },
    "streak_12": {
        "id": "streak_12", "name": "Quarter Year",
        "description": "Achieve a 12-week streak",
        "emoji": "🚀", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 12,
    },
    "streak_26": {
        "id": "streak_26", "name": "Half Year Streak",
        "description": "Achieve a 26-week streak",
        "emoji": "🏔️", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 26,
    },
    "streak_52": {
        "id": "streak_52", "name": "Full Year Streak",
        "description": "Achieve a 52-week streak",
        "emoji": "🌅", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 52,
    },

    # ---- GOALS: Monthly goal hits (5) ----
    "monthly_goal_1": {
        "id": "monthly_goal_1", "name": "Goal Getter",
        "description": "Hit your monthly goal once",
        "emoji": "🎯", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 1,
    },
    "monthly_goal_3": {
        "id": "monthly_goal_3", "name": "Hat Trick",
        "description": "Hit your monthly goal 3 times",
        "emoji": "🎩", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 3,
    },
    "monthly_goal_6": {
        "id": "monthly_goal_6", "name": "Half Year Hero",
        "description": "Hit your monthly goal 6 times",
        "emoji": "🦸", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 6,
    },
    "monthly_goal_9": {
        "id": "monthly_goal_9", "name": "Nine Lives",
        "description": "Hit your monthly goal 9 times",
        "emoji": "🐱", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 9,
    },
    "monthly_goal_12": {
        "id": "monthly_goal_12", "name": "Perfect Year",
        "description": "Hit your monthly goal every month",
        "emoji": "🏅", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 12,
    },

    # ---- CATEGORY: Outdoor vs Treadmill (4) ----
    "outdoor_10": {
        "id": "outdoor_10", "name": "Nature Lover",
        "description": "Complete 10 outdoor runs",
        "emoji": "🌳", "category": "category",
        "check": lambda s: s.get("outdoor_runs", 0) >= 10,
    },
    "outdoor_50": {
        "id": "outdoor_50", "name": "Trail Blazer",
        "description": "Complete 50 outdoor runs",
        "emoji": "🏞️", "category": "category",
        "check": lambda s: s.get("outdoor_runs", 0) >= 50,
    },
    "treadmill_10": {
        "id": "treadmill_10", "name": "Gym Rat",
        "description": "Complete 10 treadmill runs",
        "emoji": "🏋️", "category": "category",
        "check": lambda s: s.get("treadmill_runs", 0) >= 10,
    },
    "both_categories": {
        "id": "both_categories", "name": "Best of Both",
        "description": "Complete 5+ outdoor and 5+ treadmill runs",
        "emoji": "🔀", "category": "category",
        "check": lambda s: s.get("outdoor_runs", 0) >= 5 and s.get("treadmill_runs", 0) >= 5,
    },

    # ---- STEPS: High Step Days (5) ----
    "steps_first": {
        "id": "steps_first", "name": "Step Counter",
        "description": "Log your first high step day",
        "emoji": "👟", "category": "steps",
        "check": lambda s: s.get("total_step_entries", 0) >= 1,
    },
    "steps_10": {
        "id": "steps_10", "name": "Step Tracker",
        "description": "Log 10 high step days",
        "emoji": "🚶", "category": "steps",
        "check": lambda s: s.get("total_step_entries", 0) >= 10,
    },
    "steps_25": {
        "id": "steps_25", "name": "Step Master",
        "description": "Log 25 high step days",
        "emoji": "🏃‍♂️", "category": "steps",
        "check": lambda s: s.get("total_step_entries", 0) >= 25,
    },
    "steps_20k_5": {
        "id": "steps_20k_5", "name": "High Stepper",
        "description": "Log five 20K+ step days",
        "emoji": "📈", "category": "steps",
        "check": lambda s: s.get("days_20k_steps", 0) >= 5,
    },
    "steps_25k_3": {
        "id": "steps_25k_3", "name": "Marathon Walker",
        "description": "Log three 25K+ step days",
        "emoji": "🦿", "category": "steps",
        "check": lambda s: s.get("days_25k_steps", 0) >= 3,
    },
}


def get_personal_records(db: Session, user_id: int = None) -> dict:
    """Get personal records for each distance."""
    min_date = datetime(2026, 1, 1)
    
    records = {}
    for run_type in ["3k", "5k", "10k", "15k", "18k", "21k"]:
        query = db.query(Run).filter(
            Run.run_type == run_type,
            Run.completed_at >= min_date
        )
        if user_id is not None:
            query = query.filter(Run.user_id == user_id)
        fastest = query.order_by(Run.duration_seconds.asc()).first()
        
        if fastest:
            mins = fastest.duration_seconds // 60
            secs = fastest.duration_seconds % 60
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


def get_goals_progress(db: Session, yearly_goal: float = None, monthly_goal: float = None, user_id: int = None) -> dict:
    """Get progress toward yearly and monthly goals."""
    yearly_target = yearly_goal if yearly_goal is not None else YEARLY_GOAL_KM
    monthly_target = monthly_goal if monthly_goal is not None else MONTHLY_GOAL_KM
    
    min_date = datetime(2026, 1, 1)
    now = datetime.now()
    
    def base_query():
        q = db.query(Run)
        if user_id is not None:
            q = q.filter(Run.user_id == user_id)
        return q
    
    year_start = datetime(2026, 1, 1)
    year_runs = base_query().filter(
        Run.completed_at >= year_start,
        Run.completed_at >= min_date
    ).all()
    yearly_km = sum(r.distance_km for r in year_runs)
    yearly_percent = min(100, (yearly_km / yearly_target) * 100) if yearly_target > 0 else 0
    
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_runs = base_query().filter(
        Run.completed_at >= month_start,
        Run.completed_at >= min_date
    ).all()
    monthly_km = sum(r.distance_km for r in month_runs)
    monthly_percent = min(100, (monthly_km / monthly_target) * 100) if monthly_target > 0 else 0
    
    monthly_goals_hit = 0
    for month in range(1, now.month + 1):
        m_start = datetime(2026, month, 1)
        if month == 12:
            m_end = datetime(2027, 1, 1)
        else:
            m_end = datetime(2026, month + 1, 1)
        
        m_runs = base_query().filter(
            Run.completed_at >= m_start,
            Run.completed_at < m_end
        ).all()
        m_km = sum(r.distance_km for r in m_runs)
        if m_km >= monthly_target:
            monthly_goals_hit += 1
    
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


def get_achievements(db: Session, stats: dict, user_id: int = None) -> dict:
    """Get all achievements and their unlock status."""
    from models import StepEntry
    
    min_date = datetime(2026, 1, 1)
    
    query = db.query(Run).filter(Run.completed_at >= min_date)
    if user_id is not None:
        query = query.filter(Run.user_id == user_id)
    all_runs = query.all()
    
    runs_by_type = {}
    outdoor_runs = 0
    treadmill_runs = 0
    for run in all_runs:
        runs_by_type[run.run_type] = runs_by_type.get(run.run_type, 0) + 1
        cat = getattr(run, 'category', 'outdoor') or 'outdoor'
        if cat == 'treadmill':
            treadmill_runs += 1
        else:
            outdoor_runs += 1
    
    # Step data
    step_query = db.query(StepEntry)
    if user_id is not None:
        step_query = step_query.filter(StepEntry.user_id == user_id)
    step_entries = step_query.all()
    total_step_entries = len(step_entries)
    days_20k_steps = sum(1 for s in step_entries if s.step_count >= 20000)
    days_25k_steps = sum(1 for s in step_entries if s.step_count >= 25000)
    
    goals = get_goals_progress(db, user_id=user_id)
    
    extended_stats = {
        **stats,
        "runs_by_type": runs_by_type,
        "monthly_goals_hit": goals["monthly_goals_hit"],
        "outdoor_runs": outdoor_runs,
        "treadmill_runs": treadmill_runs,
        "total_step_entries": total_step_entries,
        "days_20k_steps": days_20k_steps,
        "days_25k_steps": days_25k_steps,
    }
    
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
    """Check if a run is a new personal record."""
    min_date = datetime(2026, 1, 1)
    
    previous_runs = db.query(Run).filter(
        Run.run_type == run.run_type,
        Run.completed_at >= min_date,
        Run.id != run.id
    ).all()
    
    if not previous_runs:
        return {
            "is_first": True,
            "message": f"🎉 First {run.run_type.upper()} completed!",
        }
    
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
