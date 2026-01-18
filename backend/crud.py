"""
📚 CRUD.PY - Create, Read, Update, Delete Operations
====================================================

This file contains all database operations.
CRUD is a common pattern - it stands for:
- Create: Add new data
- Read: Get existing data
- Update: Modify existing data
- Delete: Remove data

🎓 LEARNING NOTES:
- These functions are the "bridge" between your API and database
- They use SQLAlchemy to write Python instead of raw SQL
- Each function does ONE thing (Single Responsibility Principle)
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from typing import List, Optional
import json

from models import Run, WeeklyPlan, UserStats
from schemas import RunCreate, WeeklyPlanCreate, RUN_DISTANCES


# ==========================================
# 🏃 RUN OPERATIONS
# ==========================================

def create_run(db: Session, run: RunCreate) -> Run:
    """
    ✨ Create a new run record
    
    Args:
        db: Database session
        run: Run data from the API request
    
    Returns:
        The created Run object with all fields filled in
    
    🎓 LEARNING:
    - We create a Run object (model)
    - db.add() stages it for insertion
    - db.commit() saves it to the database
    - db.refresh() reloads it with auto-generated fields (like id)
    """
    # Get distance from run type
    distance = RUN_DISTANCES.get(run.run_type, 0.0)
    
    # Create the database object
    db_run = Run(
        run_type=run.run_type,
        duration_seconds=run.duration_seconds,
        distance_km=distance,
        notes=run.notes,
        category=run.category or "outdoor"
    )
    
    # Set completed_at if provided (for backdating)
    if run.completed_at:
        db_run.completed_at = run.completed_at
    
    # Save to database
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    
    # Update user stats
    update_stats_after_run(db, distance)
    
    return db_run


def get_runs(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    run_type: Optional[str] = None
) -> List[Run]:
    """
    📖 Get a list of runs
    
    Args:
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return
        run_type: Optional filter by run type
    
    🎓 LEARNING:
    - query() starts building a database query
    - filter() adds WHERE conditions
    - offset() and limit() handle pagination
    - all() executes and returns results as a list
    """
    query = db.query(Run)
    
    if run_type:
        query = query.filter(Run.run_type == run_type)
    
    return query.order_by(Run.completed_at.desc()).offset(skip).limit(limit).all()


def get_run(db: Session, run_id: int) -> Optional[Run]:
    """
    🔍 Get a single run by ID
    
    Returns None if not found.
    """
    return db.query(Run).filter(Run.id == run_id).first()


def delete_run(db: Session, run_id: int) -> bool:
    """
    🗑️ Delete a run
    
    Returns True if deleted, False if not found.
    """
    run = get_run(db, run_id)
    if run:
        db.delete(run)
        db.commit()
        return True
    return False


def update_run(db: Session, run_id: int, run_type: str = None, duration_seconds: int = None, notes: str = None, category: str = None) -> Optional[Run]:
    """
    ✏️ Update an existing run
    
    Only updates fields that are provided (not None).
    Returns the updated run, or None if not found.
    """
    run = get_run(db, run_id)
    if not run:
        return None
    
    if run_type is not None:
        run.run_type = run_type
        run.distance_km = RUN_DISTANCES.get(run_type, run.distance_km)
    
    if duration_seconds is not None:
        run.duration_seconds = duration_seconds
    
    if notes is not None:
        run.notes = notes
    
    if category is not None:
        run.category = category
    
    db.commit()
    db.refresh(run)
    return run


# ==========================================
# 📅 WEEKLY PLAN OPERATIONS
# ==========================================

def create_weekly_plan(db: Session, plan: WeeklyPlanCreate) -> WeeklyPlan:
    """Create or update a weekly plan"""
    # Check if plan for this week exists
    existing = db.query(WeeklyPlan).filter(WeeklyPlan.week_id == plan.week_id).first()
    
    if existing:
        # Update existing plan
        existing.planned_runs = json.dumps(plan.planned_runs)
        db.commit()
        db.refresh(existing)
        return existing
    
    # Create new plan
    db_plan = WeeklyPlan(
        week_id=plan.week_id,
        planned_runs=json.dumps(plan.planned_runs)
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


def get_weekly_plan(db: Session, week_id: str) -> Optional[WeeklyPlan]:
    """Get the plan for a specific week"""
    return db.query(WeeklyPlan).filter(WeeklyPlan.week_id == week_id).first()


def get_current_week_id() -> str:
    """
    📅 Get the current week identifier
    
    Format: YYYY-Www (e.g., "2024-W01")
    Uses Sunday-Saturday weeks (US standard).
    """
    now = datetime.now()
    # Adjust for Sunday-start weeks
    # Sunday = 6 in weekday(), we want it to be day 0 of the week
    # Add 1 day to shift Sunday to the next week's calculation
    adjusted = now + timedelta(days=1)
    return adjusted.strftime("%Y-W%W")


# ==========================================
# 📊 STATS OPERATIONS
# ==========================================

def get_or_create_stats(db: Session) -> UserStats:
    """Get user stats, creating if they don't exist"""
    stats = db.query(UserStats).first()
    if not stats:
        stats = UserStats(total_runs=0, total_km=0.0)
        db.add(stats)
        db.commit()
        db.refresh(stats)
    return stats


def is_valid_streak_week(runs: List[Run]) -> bool:
    """
    🔥 Check if a week qualifies for the streak
    
    A valid streak week requires:
    - At least 1 long run (10k or above)
    - At least 2 more short runs (any distance)
    - Total: 3+ runs with at least one being 10k+
    """
    if len(runs) < 3:
        return False
    
    long_runs = [r for r in runs if r.distance_km >= 10]
    short_runs = [r for r in runs if r.distance_km < 10]
    
    return len(long_runs) >= 1 and len(short_runs) >= 2


def get_week_boundaries_for_date(date: datetime) -> tuple:
    """Get Sunday-Saturday week boundaries for a given date"""
    days_since_sunday = (date.weekday() + 1) % 7
    sunday = date - timedelta(days=days_since_sunday)
    sunday = sunday.replace(hour=0, minute=0, second=0, microsecond=0)
    saturday = sunday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return (sunday, saturday)


def calculate_streaks(db: Session) -> tuple:
    """
    🔥 Calculate current and longest weekly streaks
    
    Returns (current_streak, longest_streak)
    """
    from datetime import datetime
    
    # Get all runs from 2026 onwards, ordered by date
    min_date = datetime(2026, 1, 1)
    all_runs = db.query(Run).filter(Run.completed_at >= min_date).order_by(Run.completed_at.desc()).all()
    
    if not all_runs:
        return (0, 0)
    
    # Group runs by week
    weeks_data = {}
    for run in all_runs:
        sunday, saturday = get_week_boundaries_for_date(run.completed_at)
        week_key = sunday.strftime("%Y-%m-%d")
        if week_key not in weeks_data:
            weeks_data[week_key] = {"start": sunday, "runs": []}
        weeks_data[week_key]["runs"].append(run)
    
    # Sort weeks from most recent to oldest
    sorted_weeks = sorted(weeks_data.items(), key=lambda x: x[1]["start"], reverse=True)
    
    # Calculate current streak (consecutive valid weeks from now)
    current_streak = 0
    now = datetime.now()
    current_week_start, _ = get_week_boundaries_for_date(now)
    
    expected_week = current_week_start
    for week_key, week_data in sorted_weeks:
        week_start = week_data["start"]
        
        # Check if this is the expected week (allowing for current incomplete week)
        days_diff = (expected_week - week_start).days
        
        if days_diff == 0 or (days_diff == 7 and current_streak == 0):
            # This week or last week (if current week isn't complete yet)
            if is_valid_streak_week(week_data["runs"]):
                current_streak += 1
                expected_week = week_start - timedelta(days=7)
            elif week_start == current_week_start:
                # Current week not yet valid, check from last week
                expected_week = current_week_start - timedelta(days=7)
            else:
                break
        elif days_diff == 7:
            # Consecutive week
            if is_valid_streak_week(week_data["runs"]):
                current_streak += 1
                expected_week = week_start - timedelta(days=7)
            else:
                break
        else:
            # Gap in weeks
            break
    
    # Calculate longest streak ever
    longest_streak = 0
    temp_streak = 0
    prev_week_start = None
    
    # Go through weeks from oldest to newest for longest streak
    for week_key, week_data in reversed(sorted_weeks):
        week_start = week_data["start"]
        
        if is_valid_streak_week(week_data["runs"]):
            if prev_week_start is None:
                temp_streak = 1
            elif (week_start - prev_week_start).days == 7:
                temp_streak += 1
            else:
                temp_streak = 1
            
            longest_streak = max(longest_streak, temp_streak)
            prev_week_start = week_start
        else:
            temp_streak = 0
            prev_week_start = None
    
    return (current_streak, longest_streak)


def update_stats_after_run(db: Session, distance_km: float) -> UserStats:
    """
    📊 Update stats after completing a run
    
    This is called automatically when you create a run.
    """
    stats = get_or_create_stats(db)
    stats.total_runs += 1
    stats.total_km += distance_km
    db.commit()
    db.refresh(stats)
    return stats


def get_stats_summary(db: Session) -> dict:
    """
    📊 Get comprehensive stats summary
    
    Calculates:
    - Total runs and km
    - This week's runs and km
    - This month's runs and km
    - Average pace
    - Weekly streaks (1 long run 10k+ and 2 short runs)
    """
    stats = get_or_create_stats(db)
    now = datetime.now()
    
    # Only count runs from 2026+
    min_date = datetime(2026, 1, 1)
    
    # This week's stats (Sunday-Saturday weeks)
    days_since_sunday = (now.weekday() + 1) % 7
    week_start = now - timedelta(days=days_since_sunday)
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    week_runs = db.query(Run).filter(
        Run.completed_at >= week_start,
        Run.completed_at >= min_date
    ).all()
    runs_this_week = len(week_runs)
    km_this_week = sum(r.distance_km for r in week_runs)
    
    # This month's stats
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    month_runs = db.query(Run).filter(
        Run.completed_at >= month_start,
        Run.completed_at >= min_date
    ).all()
    runs_this_month = len(month_runs)
    km_this_month = sum(r.distance_km for r in month_runs)
    
    # All runs from 2026+
    all_runs = db.query(Run).filter(Run.completed_at >= min_date).all()
    total_runs = len(all_runs)
    total_km = sum(r.distance_km for r in all_runs)
    
    # Calculate average pace
    if all_runs and total_km > 0:
        total_seconds = sum(r.duration_seconds for r in all_runs)
        avg_seconds_per_km = total_seconds / total_km
        avg_mins = int(avg_seconds_per_km // 60)
        avg_secs = int(avg_seconds_per_km % 60)
        average_pace = f"{avg_mins}:{avg_secs:02d}"
    else:
        average_pace = "0:00"
    
    # Calculate streaks using new logic
    current_streak, longest_streak = calculate_streaks(db)
    
    return {
        "total_runs": total_runs,
        "total_km": round(total_km, 2),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "average_pace": average_pace,
        "runs_this_week": runs_this_week,
        "km_this_week": round(km_this_week, 2),
        "runs_this_month": runs_this_month,
        "km_this_month": round(km_this_month, 2),
    }


def get_weekly_streak_progress(db: Session) -> dict:
    """
    🔥 Get progress toward this week's streak goal
    
    Goal: 1 long run (10k+) + 2 short runs (any)
    """
    now = datetime.now()
    min_date = datetime(2026, 1, 1)
    
    # Get this week's boundaries
    week_start, week_end = get_week_boundaries_for_date(now)
    
    # Get this week's runs
    week_runs = db.query(Run).filter(
        Run.completed_at >= week_start,
        Run.completed_at <= week_end,
        Run.completed_at >= min_date
    ).all()
    
    long_runs = [r for r in week_runs if r.distance_km >= 10]
    short_runs = [r for r in week_runs if r.distance_km < 10]
    
    long_runs_completed = len(long_runs)
    short_runs_completed = len(short_runs)
    
    is_complete = long_runs_completed >= 1 and short_runs_completed >= 2
    
    # Get current and longest streak
    current_streak, longest_streak = calculate_streaks(db)
    
    # Generate message
    if is_complete:
        message = "🎉 Week complete! Streak secured!"
    else:
        needs = []
        if long_runs_completed < 1:
            needs.append("1 long run (10k+)")
        if short_runs_completed < 2:
            remaining = 2 - short_runs_completed
            needs.append(f"{remaining} short run{'s' if remaining > 1 else ''}")
        message = f"Need: {' and '.join(needs)}"
    
    return {
        "long_runs_completed": long_runs_completed,
        "long_runs_needed": 1,
        "short_runs_completed": short_runs_completed,
        "short_runs_needed": 2,
        "is_complete": is_complete,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "message": message,
    }


# ==========================================
# 🎉 MOTIVATIONAL MESSAGES
# ==========================================

MOTIVATIONAL_MESSAGES = [
    {"message": "Every run makes you stronger!", "emoji": "💪"},
    {"message": "You're building something amazing!", "emoji": "🌟"},
    {"message": "One step at a time, one run at a time!", "emoji": "👟"},
    {"message": "Your future self will thank you!", "emoji": "🙏"},
    {"message": "Progress, not perfection!", "emoji": "📈"},
    {"message": "You showed up. That's what matters!", "emoji": "🎯"},
    {"message": "The hardest part is over - you started!", "emoji": "🚀"},
    {"message": "Running is moving meditation!", "emoji": "🧘"},
]

MILESTONE_MESSAGES = {
    1: {"message": "First run complete! The journey begins!", "emoji": "🎉", "achievement": "First Steps"},
    5: {"message": "5 runs done! You're getting hooked!", "emoji": "🔥", "achievement": "Getting Started"},
    10: {"message": "Double digits! You're a runner now!", "emoji": "🏆", "achievement": "Double Digits"},
    25: {"message": "25 runs! Consistency is your superpower!", "emoji": "⭐", "achievement": "Quarter Century"},
    50: {"message": "50 runs! You're unstoppable!", "emoji": "🚀", "achievement": "Half Century"},
    100: {"message": "100 RUNS! You're a legend!", "emoji": "👑", "achievement": "Century Club"},
}

def get_motivational_message(db: Session) -> dict:
    """
    🎉 Get a motivational message based on user's progress
    
    Returns milestone achievements or random encouragement.
    """
    import random
    
    stats = get_or_create_stats(db)
    
    # Check for milestone
    if stats.total_runs in MILESTONE_MESSAGES:
        return MILESTONE_MESSAGES[stats.total_runs]
    
    # Return random motivation
    return random.choice(MOTIVATIONAL_MESSAGES)
