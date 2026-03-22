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

def create_run(db: Session, run: RunCreate, user_id: int = None) -> Run:
    """
    ✨ Create a new run record
    
    Args:
        db: Database session
        run: Run data from the API request
        user_id: ID of the user creating the run
    
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
    
    db_run = Run(
        run_type=run.run_type,
        duration_seconds=run.duration_seconds,
        distance_km=distance,
        notes=run.notes,
        category=run.category or "outdoor",
        mood=run.mood,
        user_id=user_id
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
    run_type: Optional[str] = None,
    user_id: Optional[int] = None,
    category: Optional[str] = None
) -> List[Run]:
    """
    📖 Get a list of runs for a specific user
    
    Args:
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return
        run_type: Optional filter by run type
        user_id: Filter by user ID (only show their runs)
        category: Optional filter by category (outdoor/treadmill)
    """
    query = db.query(Run)
    
    if user_id is not None:
        query = query.filter(Run.user_id == user_id)
    
    if run_type:
        query = query.filter(Run.run_type == run_type)
    
    if category:
        if category == 'outdoor':
            query = query.filter((Run.category == 'outdoor') | (Run.category == None))
        else:
            query = query.filter(Run.category == category)
    
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


def update_run(db: Session, run_id: int, run_type: str = None, duration_seconds: int = None, notes: str = None, category: str = None, mood: str = None) -> Optional[Run]:
    """
    Update an existing run. Only updates fields that are provided (not None).
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
    
    if mood is not None:
        run.mood = mood
    
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
    
    A valid streak week requires at least 2 runs of any distance.
    """
    return len(runs) >= 2


def get_week_boundaries_for_date(date: datetime) -> tuple:
    """Get Sunday-Saturday week boundaries for a given date"""
    days_since_sunday = (date.weekday() + 1) % 7
    sunday = date - timedelta(days=days_since_sunday)
    sunday = sunday.replace(hour=0, minute=0, second=0, microsecond=0)
    saturday = sunday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return (sunday, saturday)


def calculate_streaks(db: Session, user_id: Optional[int] = None) -> tuple:
    """
    🔥 Calculate current and longest weekly streaks for a specific user
    
    Returns (current_streak, longest_streak)
    """
    from datetime import datetime
    
    # Get all runs from 2026 onwards, ordered by date
    min_date = datetime(2026, 1, 1)
    query = db.query(Run).filter(Run.completed_at >= min_date)
    if user_id is not None:
        query = query.filter(Run.user_id == user_id)
    all_runs = query.order_by(Run.completed_at.desc()).all()
    
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


def get_streak_history(db: Session, user_id: Optional[int] = None) -> list:
    """
    Returns a list of all streaks: [{start_week, end_week, length, is_current}]
    """
    min_date = datetime(2026, 1, 1)
    query = db.query(Run).filter(Run.completed_at >= min_date)
    if user_id is not None:
        query = query.filter(Run.user_id == user_id)
    all_runs = query.order_by(Run.completed_at).all()
    
    if not all_runs:
        return []
    
    weeks_data = {}
    for run in all_runs:
        sunday, saturday = get_week_boundaries_for_date(run.completed_at)
        week_key = sunday.strftime("%Y-%m-%d")
        if week_key not in weeks_data:
            weeks_data[week_key] = {"start": sunday, "runs": []}
        weeks_data[week_key]["runs"].append(run)
    
    sorted_weeks = sorted(weeks_data.items(), key=lambda x: x[1]["start"])
    
    streaks = []
    current_streak_start = None
    current_streak_length = 0
    prev_week_start = None
    
    for week_key, week_data in sorted_weeks:
        week_start = week_data["start"]
        valid = is_valid_streak_week(week_data["runs"])
        
        if valid:
            if prev_week_start is None or (week_start - prev_week_start).days != 7:
                if current_streak_length > 0:
                    streaks.append({
                        "start_week": current_streak_start.strftime("%Y-%m-%d"),
                        "end_week": prev_week_start.strftime("%Y-%m-%d"),
                        "length": current_streak_length,
                        "is_current": False,
                    })
                current_streak_start = week_start
                current_streak_length = 1
            else:
                current_streak_length += 1
            prev_week_start = week_start
        else:
            if current_streak_length > 0:
                streaks.append({
                    "start_week": current_streak_start.strftime("%Y-%m-%d"),
                    "end_week": prev_week_start.strftime("%Y-%m-%d"),
                    "length": current_streak_length,
                    "is_current": False,
                })
                current_streak_length = 0
                current_streak_start = None
                prev_week_start = None
    
    if current_streak_length > 0:
        now = datetime.now()
        current_week_start, _ = get_week_boundaries_for_date(now)
        is_current = prev_week_start == current_week_start or (current_week_start - prev_week_start).days == 7
        streaks.append({
            "start_week": current_streak_start.strftime("%Y-%m-%d"),
            "end_week": prev_week_start.strftime("%Y-%m-%d"),
            "length": current_streak_length,
            "is_current": is_current,
        })
    
    return streaks


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


def get_stats_summary(db: Session, user_id: Optional[int] = None) -> dict:
    """
    📊 Get comprehensive stats summary for a specific user
    
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
    
    # Base query - filter by user if logged in
    def base_query():
        q = db.query(Run)
        if user_id is not None:
            q = q.filter(Run.user_id == user_id)
        return q
    
    # This week's stats (Sunday-Saturday weeks)
    days_since_sunday = (now.weekday() + 1) % 7
    week_start = now - timedelta(days=days_since_sunday)
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    week_runs = base_query().filter(
        Run.completed_at >= week_start,
        Run.completed_at >= min_date
    ).all()
    runs_this_week = len(week_runs)
    km_this_week = sum(r.distance_km for r in week_runs)
    
    # This month's stats
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    month_runs = base_query().filter(
        Run.completed_at >= month_start,
        Run.completed_at >= min_date
    ).all()
    runs_this_month = len(month_runs)
    km_this_month = sum(r.distance_km for r in month_runs)
    
    # All runs from 2026+
    all_runs = base_query().filter(Run.completed_at >= min_date).all()
    total_runs = len(all_runs)
    total_km = sum(r.distance_km for r in all_runs)
    
    # Calculate average pace
    total_seconds = sum(r.duration_seconds for r in all_runs) if all_runs else 0
    if all_runs and total_km > 0:
        avg_seconds_per_km = total_seconds / total_km
        avg_mins = int(avg_seconds_per_km // 60)
        avg_secs = int(avg_seconds_per_km % 60)
        average_pace = f"{avg_mins}:{avg_secs:02d}"
    else:
        average_pace = "0:00"
    
    # Calculate streaks using new logic
    current_streak, longest_streak = calculate_streaks(db, user_id=user_id)
    
    outdoor = [r for r in all_runs if (r.category or "outdoor") == "outdoor"]
    treadmill = [r for r in all_runs if r.category == "treadmill"]

    from collections import defaultdict
    monthly_agg = defaultdict(lambda: {"runs": 0, "km": 0.0})
    for r in all_runs:
        key = r.completed_at.strftime("%Y-%m")
        monthly_agg[key]["runs"] += 1
        monthly_agg[key]["km"] += r.distance_km
    monthly_summary = [
        {"month": k, "runs": v["runs"], "km": round(v["km"], 1)}
        for k, v in sorted(monthly_agg.items(), reverse=True)
    ][:6]

    distance_breakdown = {}
    for r in all_runs:
        rt = r.run_type or "other"
        distance_breakdown[rt] = distance_breakdown.get(rt, 0) + 1

    return {
        "total_runs": total_runs,
        "total_km": round(total_km, 2),
        "total_duration_seconds": total_seconds,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "average_pace": average_pace,
        "runs_this_week": runs_this_week,
        "km_this_week": round(km_this_week, 2),
        "runs_this_month": runs_this_month,
        "km_this_month": round(km_this_month, 2),
        "outdoor_runs": len(outdoor),
        "outdoor_km": round(sum(r.distance_km for r in outdoor), 1),
        "treadmill_runs": len(treadmill),
        "treadmill_km": round(sum(r.distance_km for r in treadmill), 1),
        "monthly_summary": monthly_summary,
        "distance_breakdown": distance_breakdown,
    }


def get_weekly_streak_progress(db: Session, user_id: Optional[int] = None) -> dict:
    """
    🔥 Get progress toward this week's streak goal for a specific user
    
    Goal: 2 runs of any distance
    """
    now = datetime.now()
    min_date = datetime(2026, 1, 1)
    
    week_start, week_end = get_week_boundaries_for_date(now)
    
    query = db.query(Run).filter(
        Run.completed_at >= week_start,
        Run.completed_at <= week_end,
        Run.completed_at >= min_date
    )
    if user_id is not None:
        query = query.filter(Run.user_id == user_id)
    week_runs = query.all()
    
    runs_completed = len(week_runs)
    runs_needed = 2
    is_complete = runs_completed >= runs_needed
    
    current_streak, longest_streak = calculate_streaks(db, user_id=user_id)
    
    # Comeback and rest week detection
    is_comeback = False
    weeks_away = 0
    missed_last_week = False
    
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start - timedelta(seconds=1)
    
    prev_query = db.query(Run).filter(
        Run.completed_at >= prev_week_start,
        Run.completed_at <= prev_week_end,
        Run.completed_at >= min_date
    )
    if user_id is not None:
        prev_query = prev_query.filter(Run.user_id == user_id)
    prev_week_runs = prev_query.count()
    
    if prev_week_runs < 2:
        missed_last_week = True
    
    if runs_completed > 0 and current_streak <= 1:
        # Check how many consecutive weeks were missed before this one
        check_start = prev_week_start
        consecutive_missed = 0
        for _ in range(52):
            check_end = check_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
            q = db.query(Run).filter(
                Run.completed_at >= check_start,
                Run.completed_at <= check_end,
                Run.completed_at >= min_date
            )
            if user_id is not None:
                q = q.filter(Run.user_id == user_id)
            if q.count() < 2:
                consecutive_missed += 1
                check_start -= timedelta(days=7)
            else:
                break
        
        if consecutive_missed >= 2:
            is_comeback = True
            weeks_away = consecutive_missed
    
    if is_complete:
        message = "You showed up this week."
    else:
        remaining = runs_needed - runs_completed
        message = f"{remaining} more run{'s' if remaining > 1 else ''} this week"
    
    return {
        "runs_completed": runs_completed,
        "runs_needed": runs_needed,
        "is_complete": is_complete,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "message": message,
        "is_comeback": is_comeback,
        "weeks_away": weeks_away,
        "missed_last_week": missed_last_week,
    }


# ==========================================
# 🎉 MOTIVATIONAL MESSAGES
# ==========================================

MOTIVATIONAL_MESSAGES = [
    {"message": "You showed up. That's the whole game.", "emoji": "🏃"},
    {"message": "Consistency beats intensity. Always.", "emoji": "🔁"},
    {"message": "Run today. Worry about pace never.", "emoji": "🌿"},
    {"message": "The best run is the one you actually do.", "emoji": "✓"},
    {"message": "Progress, not perfection.", "emoji": "📈"},
    {"message": "Your body was built to move.", "emoji": "🫀"},
    {"message": "Every logged run is proof you showed up.", "emoji": "📝"},
    {"message": "Running is moving meditation.", "emoji": "🧘"},
    {"message": "Small runs add up to big journeys.", "emoji": "🗺️"},
    {"message": "Less thinking, more running.", "emoji": "💨"},
]

MILESTONE_MESSAGES = {
    1: {"message": "First run logged. Your rhythm starts now.", "emoji": "🎉", "achievement": "First Steps"},
    5: {"message": "5 runs in. The habit is forming.", "emoji": "🌱", "achievement": "Taking Root"},
    10: {"message": "10 runs. You're a runner now.", "emoji": "🏃", "achievement": "Double Digits"},
    25: {"message": "25 runs. Consistency is your superpower.", "emoji": "⭐", "achievement": "Quarter Century"},
    50: {"message": "50 runs. This is who you are now.", "emoji": "🏔️", "achievement": "Half Century"},
    100: {"message": "100 runs. Respect the journey.", "emoji": "👑", "achievement": "Century Club"},
}

def get_motivational_message(db: Session, user_id: Optional[int] = None) -> dict:
    """
    🎉 Get a motivational message based on user's progress
    
    Returns milestone achievements or random encouragement.
    """
    import random
    
    # Get user-specific stats
    user_stats = get_stats_summary(db, user_id=user_id)
    total_runs = user_stats.get("total_runs", 0)
    
    # Check for milestone
    if total_runs in MILESTONE_MESSAGES:
        return MILESTONE_MESSAGES[total_runs]
    
    # Return random motivation
    return random.choice(MOTIVATIONAL_MESSAGES)


# ==========================================
# 📅 MONTH IN REVIEW
# ==========================================

def get_month_in_review(db: Session, user_id: Optional[int] = None, target_month: Optional[int] = None, target_year: Optional[int] = None) -> dict:
    """
    📅 Get comprehensive month in review data
    
    Shows from last day of month through first 7 days of next month.
    If no target month specified, defaults to previous month if in first 7 days,
    or current month if on last day.
    """
    from models import StepEntry, Weight
    import calendar
    
    now = datetime.now()
    today = now.date()
    
    # Determine which month to review
    if target_month is None or target_year is None:
        # Check if we should show (last day of current month OR first 7 days of month)
        _, last_day = calendar.monthrange(now.year, now.month)
        is_last_day_of_month = today.day == last_day
        is_first_week = today.day <= 7
        
        if is_last_day_of_month:
            # Show current month review
            review_month = now.month
            review_year = now.year
            should_show = True
        elif is_first_week:
            # Show previous month review
            if now.month == 1:
                review_month = 12
                review_year = now.year - 1
            else:
                review_month = now.month - 1
                review_year = now.year
            should_show = True
        else:
            # Don't show - return with should_show = False
            return {
                "should_show": False,
                "month_name": "",
                "year": now.year,
                "month": now.month,
                "total_runs": 0,
                "total_km": 0,
                "total_duration_seconds": 0,
                "avg_pace": "0:00",
                "outdoor_runs": 0,
                "treadmill_runs": 0,
                "runs_by_type": {},
                "total_step_days": 0,
                "total_steps": 0,
                "avg_daily_steps": 0,
                "high_step_days": 0,
                "start_weight": None,
                "end_weight": None,
                "weight_change": None,
                "best_streak_in_month": 0,
                "monthly_km_goal": 0,
                "monthly_km_achieved": 0,
                "goal_percent": 0,
                "goal_met": False,
                "prs_achieved": [],
                "km_vs_last_month": 0,
                "runs_vs_last_month": 0,
            }
    else:
        review_month = target_month
        review_year = target_year
        should_show = True
    
    # Get month boundaries
    month_start = datetime(review_year, review_month, 1)
    _, last_day = calendar.monthrange(review_year, review_month)
    month_end = datetime(review_year, review_month, last_day, 23, 59, 59)
    
    # Month name
    month_name = month_start.strftime("%B %Y")
    
    # Query runs for the month
    runs_query = db.query(Run).filter(
        Run.completed_at >= month_start,
        Run.completed_at <= month_end
    )
    if user_id:
        runs_query = runs_query.filter(Run.user_id == user_id)
    runs = runs_query.all()
    
    # Calculate run stats
    total_runs = len(runs)
    total_km = sum(r.distance_km for r in runs)
    total_duration = sum(r.duration_seconds for r in runs)
    
    # Average pace
    if total_km > 0 and total_duration > 0:
        pace_seconds = total_duration / total_km
        pace_min = int(pace_seconds // 60)
        pace_sec = int(pace_seconds % 60)
        avg_pace = f"{pace_min}:{pace_sec:02d}"
    else:
        avg_pace = "0:00"
    
    # Run breakdown by category
    outdoor_runs = len([r for r in runs if getattr(r, 'category', 'outdoor') == 'outdoor'])
    treadmill_runs = len([r for r in runs if getattr(r, 'category', 'outdoor') == 'treadmill'])
    
    # Runs by type
    runs_by_type = {}
    for r in runs:
        runs_by_type[r.run_type] = runs_by_type.get(r.run_type, 0) + 1
    
    # Query steps for the month
    steps_query = db.query(StepEntry).filter(
        StepEntry.recorded_date >= month_start,
        StepEntry.recorded_date <= month_end
    )
    if user_id:
        steps_query = steps_query.filter(StepEntry.user_id == user_id)
    step_entries = steps_query.all()
    
    total_step_days = len(step_entries)
    total_steps = sum(s.step_count for s in step_entries)
    avg_daily_steps = total_steps // total_step_days if total_step_days > 0 else 0
    high_step_days = len([s for s in step_entries if s.step_count >= 10000])
    days_15k = len([s for s in step_entries if s.step_count >= 15000])
    days_20k = len([s for s in step_entries if s.step_count >= 20000])
    days_25k = len([s for s in step_entries if s.step_count >= 25000])
    
    # Weight progress for the month
    weight_query = db.query(Weight).filter(
        Weight.recorded_at >= month_start,
        Weight.recorded_at <= month_end
    )
    if user_id:
        weight_query = weight_query.filter(Weight.user_id == user_id)
    weights = weight_query.order_by(Weight.recorded_at).all()
    
    start_weight = weights[0].weight_lbs if weights else None
    end_weight = weights[-1].weight_lbs if weights else None
    weight_change = round(end_weight - start_weight, 1) if start_weight and end_weight else None
    
    # Best streak calculation (simplified - count consecutive run days)
    run_dates = sorted(set(r.completed_at.date() for r in runs))
    best_streak = 0
    current_streak = 0
    prev_date = None
    for d in run_dates:
        if prev_date and (d - prev_date).days == 1:
            current_streak += 1
        else:
            current_streak = 1
        best_streak = max(best_streak, current_streak)
        prev_date = d
    
    from models import UserGoals, User as UserModel
    from schemas import LEVEL_GOALS
    goals_query = db.query(UserGoals)
    if user_id:
        goals_query = goals_query.filter(UserGoals.user_id == user_id)
    user_goals = goals_query.first()
    if user_goals:
        monthly_km_goal = user_goals.monthly_km_goal
    else:
        level = 'breath'
        if user_id:
            u = db.query(UserModel).filter(UserModel.id == user_id).first()
            if u:
                level = getattr(u, 'runner_level', 'breath') or 'breath'
        monthly_km_goal = LEVEL_GOALS.get(level, LEVEL_GOALS['breath'])["monthly_km"]
    goal_percent = min((total_km / monthly_km_goal) * 100, 100) if monthly_km_goal > 0 else 0
    goal_met = total_km >= monthly_km_goal
    
    # PRs achieved (simplified - would need to track actual PR dates)
    prs_achieved = []  # TODO: Track actual PRs with dates
    
    # Compare to previous month
    if review_month == 1:
        prev_month = 12
        prev_year = review_year - 1
    else:
        prev_month = review_month - 1
        prev_year = review_year
    
    prev_month_start = datetime(prev_year, prev_month, 1)
    _, prev_last_day = calendar.monthrange(prev_year, prev_month)
    prev_month_end = datetime(prev_year, prev_month, prev_last_day, 23, 59, 59)
    
    prev_runs_query = db.query(Run).filter(
        Run.completed_at >= prev_month_start,
        Run.completed_at <= prev_month_end
    )
    if user_id:
        prev_runs_query = prev_runs_query.filter(Run.user_id == user_id)
    prev_runs = prev_runs_query.all()
    
    prev_total_runs = len(prev_runs)
    prev_total_km = sum(r.distance_km for r in prev_runs)
    
    km_vs_last_month = round(total_km - prev_total_km, 1)
    runs_vs_last_month = total_runs - prev_total_runs
    
    return {
        "should_show": should_show,
        "month_name": month_name,
        "year": review_year,
        "month": review_month,
        "total_runs": total_runs,
        "total_km": round(total_km, 1),
        "total_duration_seconds": total_duration,
        "avg_pace": avg_pace,
        "outdoor_runs": outdoor_runs,
        "treadmill_runs": treadmill_runs,
        "runs_by_type": runs_by_type,
        "total_step_days": total_step_days,
        "total_steps": total_steps,
        "avg_daily_steps": avg_daily_steps,
        "high_step_days": high_step_days,
        "days_15k": days_15k,
        "days_20k": days_20k,
        "days_25k": days_25k,
        "start_weight": start_weight,
        "end_weight": end_weight,
        "weight_change": weight_change,
        "best_streak_in_month": best_streak,
        "monthly_km_goal": monthly_km_goal,
        "monthly_km_achieved": round(total_km, 1),
        "goal_percent": round(goal_percent, 1),
        "goal_met": goal_met,
        "prs_achieved": prs_achieved,
        "km_vs_last_month": km_vs_last_month,
        "runs_vs_last_month": runs_vs_last_month,
    }
