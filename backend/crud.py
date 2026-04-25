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

from models import Run, GymWorkout, Exercise, User, Weight, StepEntry, CircleMembership, Walk, WalkPhoto, PublicWalk
from schemas import RunCreate, RUN_DISTANCES


def get_first_run_date(db: Session, user_id: int) -> Optional[datetime]:
    """Return the completed_at of the user's earliest run, or None."""
    first = db.query(Run.completed_at).filter(
        Run.user_id == user_id
    ).order_by(Run.completed_at.asc()).first()
    return first[0] if first else None


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
# 📊 STATS OPERATIONS
# ==========================================


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


def get_weekly_streak_progress(db: Session, user_id: Optional[int] = None, joined_at=None) -> dict:
    """
    🔥 Get progress toward this week's streak goal for a specific user

    Goal: 2 runs of any distance.
    joined_at caps backward-looking so weeks before the user existed aren't "missed".
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

    is_comeback = False
    weeks_away = 0
    missed_last_week = False

    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start - timedelta(seconds=1)

    # Don't count pre-join weeks as missed
    user_existed_prev_week = True
    if joined_at and prev_week_end < joined_at:
        user_existed_prev_week = False

    if user_existed_prev_week:
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
        check_start = prev_week_start
        consecutive_missed = 0
        for _ in range(52):
            # Stop looking before the user joined
            if joined_at and check_start < joined_at:
                break
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
                "rhythm_weeks_hit": 0,
                "rhythm_weeks_total": 0,
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
    days_30k = len([s for s in step_entries if s.step_count >= 30000])
    
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

    # Rhythm weeks: count Sun-Sat weeks in this month with 2+ runs
    first_sunday = month_start - timedelta(days=(month_start.weekday() + 1) % 7)
    if first_sunday < month_start:
        first_sunday = first_sunday  # keep it, we'll check overlap
    week_start = first_sunday
    rhythm_weeks_hit = 0
    rhythm_weeks_total = 0
    while week_start <= month_end:
        week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        overlap_start = max(week_start, month_start)
        overlap_end = min(week_end, month_end)
        if overlap_start <= overlap_end:
            mid = overlap_start + (overlap_end - overlap_start) / 2
            if mid.month == review_month and mid.year == review_year:
                rhythm_weeks_total += 1
                week_runs = [r for r in runs if week_start <= r.completed_at <= week_end]
                if len(week_runs) >= 2:
                    rhythm_weeks_hit += 1
        week_start = week_start + timedelta(days=7)

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
    goal_percent = (total_km / monthly_km_goal) * 100 if monthly_km_goal > 0 else 0
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
        "days_30k": days_30k,
        "start_weight": start_weight,
        "end_weight": end_weight,
        "weight_change": weight_change,
        "best_streak_in_month": best_streak,
        "rhythm_weeks_hit": rhythm_weeks_hit,
        "rhythm_weeks_total": rhythm_weeks_total,
        "monthly_km_goal": monthly_km_goal,
        "monthly_km_achieved": round(total_km, 1),
        "goal_percent": round(goal_percent, 1),
        "goal_met": goal_met,
        "prs_achieved": prs_achieved,
        "km_vs_last_month": km_vs_last_month,
        "runs_vs_last_month": runs_vs_last_month,
    }


# ==========================================
# 🏋️ GYM WORKOUT OPERATIONS
# ==========================================

GYM_PROGRAM = [
    {"name": "Leg Press", "sets": 3, "reps": 10, "default_weight_kg": 70, "machine": "Technogym Selection Leg Press", "increment_kg": 2.5, "muscle_group": "legs"},
    {"name": "Chest Press", "sets": 3, "reps": 10, "default_weight_kg": 25, "machine": "Technogym Selection Chest Press", "increment_kg": 2.5, "muscle_group": "chest"},
    {"name": "Lat Pulldown", "sets": 3, "reps": 10, "default_weight_kg": 30, "machine": "Technogym Selection Lat Machine", "increment_kg": 2.5, "muscle_group": "back"},
    {"name": "Shoulder Press", "sets": 3, "reps": 10, "default_weight_kg": 15, "machine": "Technogym Selection Shoulder Press", "increment_kg": 2.5, "muscle_group": "shoulders"},
    {"name": "Seated Row", "sets": 3, "reps": 10, "default_weight_kg": 30, "machine": "Technogym Selection Low Row", "increment_kg": 2.5, "muscle_group": "back"},
    {"name": "Leg Curl", "sets": 3, "reps": 10, "default_weight_kg": 25, "machine": "Technogym Selection Prone Leg Curl", "increment_kg": 2.5, "muscle_group": "legs"},
    {"name": "Plank", "sets": 3, "reps": 30, "default_weight_kg": 0, "machine": "Floor", "increment_kg": 0, "is_timed": True, "muscle_group": "core"},
]


# ---- Exercise Catalog ----

def seed_builtin_exercises(db: Session):
    """Upsert built-in exercises from GYM_PROGRAM into the Exercise table."""
    from sqlalchemy import and_
    for ex in GYM_PROGRAM:
        existing = db.query(Exercise).filter(
            and_(Exercise.user_id.is_(None), Exercise.name == ex["name"])
        ).first()
        if existing:
            existing.muscle_group = ex.get("muscle_group", "other")
            existing.equipment = ex.get("machine")
            existing.default_weight_kg = ex["default_weight_kg"]
            existing.increment_kg = ex["increment_kg"]
            existing.default_sets = ex["sets"]
            existing.default_reps = ex["reps"]
            existing.is_timed = ex.get("is_timed", False)
        else:
            db.add(Exercise(
                user_id=None,
                name=ex["name"],
                muscle_group=ex.get("muscle_group", "other"),
                equipment=ex.get("machine"),
                default_weight_kg=ex["default_weight_kg"],
                increment_kg=ex["increment_kg"],
                default_sets=ex["sets"],
                default_reps=ex["reps"],
                is_timed=ex.get("is_timed", False),
            ))
    db.commit()


def get_exercises(db: Session, user_id: int) -> List[Exercise]:
    """Return all exercises visible to this user (built-in + their custom)."""
    from sqlalchemy import or_
    return db.query(Exercise).filter(
        or_(Exercise.user_id.is_(None), Exercise.user_id == user_id)
    ).order_by(Exercise.name).all()


def create_exercise(db: Session, user_id: int, name: str,
                    muscle_group: str = "other", equipment: str = None,
                    default_weight_kg: float = 0, increment_kg: float = 2.5,
                    default_sets: int = 3, default_reps: int = 10,
                    is_timed: bool = False) -> Exercise:
    ex = Exercise(
        user_id=user_id,
        name=name,
        muscle_group=muscle_group,
        equipment=equipment,
        default_weight_kg=default_weight_kg,
        increment_kg=increment_kg,
        default_sets=default_sets,
        default_reps=default_reps,
        is_timed=is_timed,
    )
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex


def delete_exercise(db: Session, exercise_id: int, user_id: int) -> bool:
    """Delete a user-owned exercise. Cannot delete built-in exercises."""
    ex = db.query(Exercise).filter(
        Exercise.id == exercise_id,
        Exercise.user_id == user_id,
    ).first()
    if not ex:
        return False
    db.delete(ex)
    db.commit()
    return True


# ---- Gym Workouts ----

def create_gym_workout(db: Session, user_id: int, exercises: list, notes: str = None, duration_minutes: int = None) -> GymWorkout:
    workout = GymWorkout(
        user_id=user_id,
        exercises=json.dumps(exercises),
        notes=notes,
        duration_minutes=duration_minutes,
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout


def get_gym_workouts(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> List[GymWorkout]:
    return db.query(GymWorkout).filter(
        GymWorkout.user_id == user_id
    ).order_by(GymWorkout.completed_at.desc()).offset(offset).limit(limit).all()


def update_gym_workout(db: Session, workout_id: int, user_id: int, exercises: list = None, notes: str = None, duration_minutes: int = None) -> GymWorkout:
    workout = db.query(GymWorkout).filter(
        GymWorkout.id == workout_id,
        GymWorkout.user_id == user_id
    ).first()
    if not workout:
        return None
    if exercises is not None:
        workout.exercises = json.dumps(exercises)
    if notes is not None:
        workout.notes = notes
    if duration_minutes is not None:
        workout.duration_minutes = duration_minutes
    db.commit()
    db.refresh(workout)
    return workout


def delete_gym_workout(db: Session, workout_id: int, user_id: int) -> bool:
    workout = db.query(GymWorkout).filter(
        GymWorkout.id == workout_id,
        GymWorkout.user_id == user_id
    ).first()
    if not workout:
        return False
    db.delete(workout)
    db.commit()
    return True


def get_gym_working_weights(db: Session, user_id: int) -> dict:
    """Get current working weight per exercise by scanning all workouts for
    the most recent appearance of each exercise."""
    workouts = db.query(GymWorkout).filter(
        GymWorkout.user_id == user_id
    ).order_by(GymWorkout.completed_at.desc()).all()

    weights: dict = {}
    for w in workouts:
        for ex in _parse_exercises(w):
            name = ex.get("name")
            if name and name not in weights:
                weights[name] = ex.get("weight_kg", 0)

    return weights


def get_gym_stats(db: Session, user_id: int) -> dict:
    workouts = db.query(GymWorkout).filter(
        GymWorkout.user_id == user_id
    ).order_by(GymWorkout.completed_at.asc()).all()

    total = len(workouts)

    now = datetime.now()
    days_since_sunday = (now.weekday() + 1) % 7
    week_start = now - timedelta(days=days_since_sunday)
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    this_week = len([w for w in workouts if w.completed_at >= week_start])

    # ---- Aggregates ----
    agg_total_sets = 0
    agg_total_reps = 0
    agg_total_volume = 0.0

    # ---- Per-exercise collection ----
    exercise_first: dict = {}
    exercise_current: dict = {}
    exercise_history: dict = {}     # name -> [{date, weight, volume, best_set_reps}]
    personal_records: dict = {}     # name -> {weight, date}
    timed_exercises = {ex["name"] for ex in GYM_PROGRAM if ex.get("is_timed")}
    exercise_names_seen: set = set()

    for w in workouts:
        w_date = w.completed_at.strftime("%Y-%m-%d") if w.completed_at else None
        for ex in _parse_exercises(w):
            name = ex.get("name")
            if not name:
                continue
            exercise_names_seen.add(name)
            if name in timed_exercises:
                continue
            weight = ex.get("weight_kg", 0)
            sets = ex.get("sets", [])
            completed_sets = [s for s in sets if s.get("completed", True)]
            num_sets = len(completed_sets)
            num_reps = sum(s.get("reps", 0) for s in completed_sets)
            vol = sum(weight * s.get("reps", 0) for s in completed_sets)
            best_reps = max((s.get("reps", 0) for s in completed_sets), default=0)

            agg_total_sets += num_sets
            agg_total_reps += num_reps
            agg_total_volume += vol

            if name not in exercise_first:
                exercise_first[name] = weight
            exercise_current[name] = weight

            if name not in personal_records or weight > personal_records[name]["weight"]:
                personal_records[name] = {"weight": weight, "date": w_date or ""}

            if w_date:
                if name not in exercise_history:
                    exercise_history[name] = []
                exercise_history[name].append({
                    "date": w_date,
                    "weight": weight,
                    "volume": vol,
                    "best_set_reps": best_reps,
                    "sets": num_sets,
                    "reps": num_reps,
                })

    progression = {}
    for name in exercise_first:
        progression[name] = {
            "first": exercise_first[name],
            "current": exercise_current[name],
        }

    # ---- Workout frequency: last 12 weeks ----
    frequency = []
    freq_week = week_start
    for _ in range(12):
        freq_end = freq_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
        count = len([w for w in workouts if freq_week <= w.completed_at <= freq_end])
        frequency.append({
            "week_start": freq_week.strftime("%Y-%m-%d"),
            "count": count,
        })
        freq_week -= timedelta(days=7)
    frequency.reverse()

    # ---- Gym streak (consecutive weeks with at least 1 session) ----
    streak = 0
    check_week = week_start
    for _ in range(52):
        check_end = check_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
        count = len([w for w in workouts if check_week <= w.completed_at <= check_end])
        if count > 0:
            streak += 1
            check_week -= timedelta(days=7)
        else:
            if check_week == week_start:
                check_week -= timedelta(days=7)
                continue
            break

    return {
        "total_workouts": total,
        "this_week": this_week,
        "streak_weeks": streak,
        "total_sets": agg_total_sets,
        "total_reps": agg_total_reps,
        "total_volume": round(agg_total_volume, 1),
        "unique_exercises": len(exercise_names_seen),
        "progression": progression,
        "volume": exercise_history,
        "frequency": frequency,
        "personal_records": personal_records,
        "exercise_history": exercise_history,
    }


def _parse_exercises(workout: GymWorkout) -> list:
    try:
        return json.loads(workout.exercises)
    except (json.JSONDecodeError, TypeError):
        return []


# ==========================================
# 🛡️ ADMIN ANALYTICS
# ==========================================

def get_admin_stats(db: Session) -> dict:
    """Aggregate analytics across all users for the admin dashboard."""
    from collections import defaultdict

    now = datetime.now()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    # --- Users ---
    total_users = db.query(func.count(User.id)).scalar() or 0
    new_this_week = db.query(func.count(User.id)).filter(User.created_at >= seven_days_ago).scalar() or 0
    new_this_month = db.query(func.count(User.id)).filter(User.created_at >= thirty_days_ago).scalar() or 0
    onboarded = db.query(func.count(User.id)).filter(User.onboarding_complete == True).scalar() or 0
    verified = db.query(func.count(User.id)).filter(User.email_verified == True).scalar() or 0

    # --- Totals ---
    total_runs = db.query(func.count(Run.id)).scalar() or 0
    total_km = db.query(func.coalesce(func.sum(Run.distance_km), 0)).scalar()
    total_gym = db.query(func.count(GymWorkout.id)).scalar() or 0
    total_steps = db.query(func.count(StepEntry.id)).scalar() or 0
    total_weights = db.query(func.count(Weight.id)).scalar() or 0

    # --- Active users (last 7 days) ---
    run_users_week = db.query(func.count(func.distinct(Run.user_id))).filter(Run.completed_at >= seven_days_ago).scalar() or 0
    gym_users_week = db.query(func.count(func.distinct(GymWorkout.user_id))).filter(GymWorkout.completed_at >= seven_days_ago).scalar() or 0
    active_user_ids = set()
    for uid in db.query(Run.user_id).filter(Run.completed_at >= seven_days_ago).distinct():
        if uid[0]:
            active_user_ids.add(uid[0])
    for uid in db.query(GymWorkout.user_id).filter(GymWorkout.completed_at >= seven_days_ago).distinct():
        if uid[0]:
            active_user_ids.add(uid[0])
    for uid in db.query(StepEntry.user_id).filter(StepEntry.created_at >= seven_days_ago).distinct():
        if uid[0]:
            active_user_ids.add(uid[0])
    active_this_week = len(active_user_ids)

    # --- Feature adoption ---
    users_with_runs = db.query(func.count(func.distinct(Run.user_id))).scalar() or 0
    users_with_gym = db.query(func.count(func.distinct(GymWorkout.user_id))).scalar() or 0
    users_with_steps = db.query(func.count(func.distinct(StepEntry.user_id))).scalar() or 0
    users_with_weight = db.query(func.count(func.distinct(Weight.user_id))).scalar() or 0
    users_in_circles = db.query(func.count(func.distinct(CircleMembership.user_id))).scalar() or 0

    def pct(n):
        return round((n / total_users) * 100, 1) if total_users > 0 else 0

    # --- Signups over time (last 30 days) ---
    signups_by_day = defaultdict(int)
    users_30d = db.query(User.created_at).filter(User.created_at >= thirty_days_ago).all()
    for (created,) in users_30d:
        if created:
            signups_by_day[created.strftime("%Y-%m-%d")] += 1

    signups_over_time = []
    for i in range(30):
        day = (thirty_days_ago + timedelta(days=i)).strftime("%Y-%m-%d")
        signups_over_time.append({"date": day, "count": signups_by_day.get(day, 0)})

    # --- Activity over time (last 30 days) ---
    runs_by_day = defaultdict(int)
    gym_by_day = defaultdict(int)
    steps_by_day = defaultdict(int)

    for (completed,) in db.query(Run.completed_at).filter(Run.completed_at >= thirty_days_ago).all():
        if completed:
            runs_by_day[completed.strftime("%Y-%m-%d")] += 1
    for (completed,) in db.query(GymWorkout.completed_at).filter(GymWorkout.completed_at >= thirty_days_ago).all():
        if completed:
            gym_by_day[completed.strftime("%Y-%m-%d")] += 1
    for (recorded,) in db.query(StepEntry.recorded_date).filter(StepEntry.recorded_date >= thirty_days_ago).all():
        if recorded:
            steps_by_day[recorded.strftime("%Y-%m-%d")] += 1

    activity_over_time = []
    for i in range(30):
        day = (thirty_days_ago + timedelta(days=i)).strftime("%Y-%m-%d")
        activity_over_time.append({
            "date": day,
            "runs": runs_by_day.get(day, 0),
            "gym": gym_by_day.get(day, 0),
            "steps": steps_by_day.get(day, 0),
        })

    # --- DAU (last 30 days) ---
    dau = []
    for i in range(30):
        day_start = (thirty_days_ago + timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_ids = set()
        for (uid,) in db.query(Run.user_id).filter(Run.completed_at >= day_start, Run.completed_at < day_end).distinct():
            if uid:
                day_ids.add(uid)
        for (uid,) in db.query(GymWorkout.user_id).filter(GymWorkout.completed_at >= day_start, GymWorkout.completed_at < day_end).distinct():
            if uid:
                day_ids.add(uid)
        for (uid,) in db.query(StepEntry.user_id).filter(StepEntry.recorded_date >= day_start, StepEntry.recorded_date < day_end).distinct():
            if uid:
                day_ids.add(uid)
        dau.append({"date": day_start.strftime("%Y-%m-%d"), "count": len(day_ids)})

    # --- WAU (last 12 weeks) ---
    wau = []
    days_since_sunday = (now.weekday() + 1) % 7
    current_week_start = now - timedelta(days=days_since_sunday)
    current_week_start = current_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(12):
        ws = current_week_start - timedelta(weeks=i)
        we = ws + timedelta(days=7)
        week_ids = set()
        for (uid,) in db.query(Run.user_id).filter(Run.completed_at >= ws, Run.completed_at < we).distinct():
            if uid:
                week_ids.add(uid)
        for (uid,) in db.query(GymWorkout.user_id).filter(GymWorkout.completed_at >= ws, GymWorkout.completed_at < we).distinct():
            if uid:
                week_ids.add(uid)
        wau.append({"week_start": ws.strftime("%Y-%m-%d"), "count": len(week_ids)})
    wau.reverse()

    # --- Top users by activity ---
    from sqlalchemy import case
    top_users_q = db.query(
        User.id,
        User.name,
        User.handle,
        User.email,
        User.created_at,
        func.count(func.distinct(Run.id)).label("run_count"),
    ).outerjoin(Run, Run.user_id == User.id).group_by(
        User.id, User.name, User.handle, User.email, User.created_at
    ).order_by(func.count(func.distinct(Run.id)).desc()).limit(15).all()

    top_users = []
    for u in top_users_q:
        gym_count = db.query(func.count(GymWorkout.id)).filter(GymWorkout.user_id == u.id).scalar() or 0
        last_run = db.query(func.max(Run.completed_at)).filter(Run.user_id == u.id).scalar()
        last_gym = db.query(func.max(GymWorkout.completed_at)).filter(GymWorkout.user_id == u.id).scalar()
        last_active = max(filter(None, [last_run, last_gym]), default=None)
        top_users.append({
            "id": u.id,
            "name": u.name or u.email.split("@")[0],
            "handle": u.handle,
            "runs": u.run_count,
            "gym_workouts": gym_count,
            "last_active": last_active.strftime("%Y-%m-%d") if last_active else None,
        })

    return {
        "users": {
            "total": total_users,
            "new_this_week": new_this_week,
            "new_this_month": new_this_month,
            "onboarded": onboarded,
            "onboarding_pct": pct(onboarded),
            "verified": verified,
            "verified_pct": pct(verified),
            "active_this_week": active_this_week,
        },
        "activity": {
            "total_runs": total_runs,
            "total_km": round(total_km, 1),
            "total_gym_workouts": total_gym,
            "total_step_entries": total_steps,
            "total_weight_entries": total_weights,
        },
        "feature_adoption": {
            "runs": {"users": users_with_runs, "pct": pct(users_with_runs)},
            "gym": {"users": users_with_gym, "pct": pct(users_with_gym)},
            "steps": {"users": users_with_steps, "pct": pct(users_with_steps)},
            "weight": {"users": users_with_weight, "pct": pct(users_with_weight)},
            "circles": {"users": users_in_circles, "pct": pct(users_in_circles)},
        },
        "signups_over_time": signups_over_time,
        "activity_over_time": activity_over_time,
        "dau": dau,
        "wau": wau,
        "top_users": top_users,
    }


# ==========================================
# 🚶 WALK OPERATIONS
# ==========================================

def create_walk(
    db: Session,
    user_id: int,
    duration_seconds: int,
    distance_km: float,
    started_at: Optional[datetime] = None,
    ended_at: Optional[datetime] = None,
    route_polyline: Optional[str] = None,
    start_lat: Optional[float] = None,
    start_lng: Optional[float] = None,
    end_lat: Optional[float] = None,
    end_lng: Optional[float] = None,
    elevation_gain_m: Optional[float] = None,
    notes: Optional[str] = None,
    mood: Optional[str] = None,
    category: Optional[str] = "outdoor",
    public_walk_id: Optional[int] = None,
) -> Walk:
    """Create a new walk record from a completed walk session."""
    avg_pace = None
    if distance_km and distance_km > 0:
        avg_pace = duration_seconds / distance_km

    walk = Walk(
        user_id=user_id,
        duration_seconds=duration_seconds,
        distance_km=distance_km,
        ended_at=ended_at or datetime.utcnow(),
        route_polyline=route_polyline,
        start_lat=start_lat,
        start_lng=start_lng,
        end_lat=end_lat,
        end_lng=end_lng,
        elevation_gain_m=elevation_gain_m,
        avg_pace_seconds_per_km=avg_pace,
        notes=notes,
        mood=mood,
        category=category or "outdoor",
        public_walk_id=public_walk_id,
    )
    if started_at:
        walk.started_at = started_at

    db.add(walk)
    db.commit()
    db.refresh(walk)
    return walk


def get_walks(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> List[Walk]:
    """List a user's walks newest first."""
    return (
        db.query(Walk)
        .filter(Walk.user_id == user_id)
        .order_by(Walk.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_walk(db: Session, walk_id: int, user_id: int) -> Optional[Walk]:
    """Fetch a single walk owned by user_id."""
    return (
        db.query(Walk)
        .filter(Walk.id == walk_id, Walk.user_id == user_id)
        .first()
    )


def update_walk(
    db: Session,
    walk_id: int,
    user_id: int,
    notes: Optional[str] = None,
    mood: Optional[str] = None,
    category: Optional[str] = None,
) -> Optional[Walk]:
    """Update editable metadata on a walk."""
    walk = get_walk(db, walk_id, user_id)
    if not walk:
        return None
    if notes is not None:
        walk.notes = notes
    if mood is not None:
        walk.mood = mood
    if category is not None:
        walk.category = category
    db.commit()
    db.refresh(walk)
    return walk


def delete_walk(db: Session, walk_id: int, user_id: int) -> bool:
    """Delete a walk and its photos."""
    walk = get_walk(db, walk_id, user_id)
    if not walk:
        return False
    db.query(WalkPhoto).filter(WalkPhoto.walk_id == walk_id).delete()
    db.delete(walk)
    db.commit()
    return True


def get_walk_stats(db: Session, user_id: int) -> dict:
    """Aggregate walk stats for the user (lifetime + recent)."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    base = db.query(Walk).filter(Walk.user_id == user_id)
    total_walks = base.count()
    total_km = db.query(func.coalesce(func.sum(Walk.distance_km), 0.0)).filter(Walk.user_id == user_id).scalar() or 0.0
    total_seconds = db.query(func.coalesce(func.sum(Walk.duration_seconds), 0)).filter(Walk.user_id == user_id).scalar() or 0

    walks_this_week = base.filter(Walk.started_at >= week_ago).count()
    km_this_week = db.query(func.coalesce(func.sum(Walk.distance_km), 0.0)).filter(
        Walk.user_id == user_id, Walk.started_at >= week_ago
    ).scalar() or 0.0

    walks_this_month = base.filter(Walk.started_at >= month_ago).count()
    km_this_month = db.query(func.coalesce(func.sum(Walk.distance_km), 0.0)).filter(
        Walk.user_id == user_id, Walk.started_at >= month_ago
    ).scalar() or 0.0

    longest_km = db.query(func.coalesce(func.max(Walk.distance_km), 0.0)).filter(Walk.user_id == user_id).scalar() or 0.0
    longest_seconds = db.query(func.coalesce(func.max(Walk.duration_seconds), 0)).filter(Walk.user_id == user_id).scalar() or 0

    avg_pace = None
    if total_km > 0:
        avg_pace = float(total_seconds) / float(total_km)

    return {
        "total_walks": total_walks,
        "total_km": round(float(total_km), 2),
        "total_minutes": round(total_seconds / 60.0, 1),
        "walks_this_week": walks_this_week,
        "km_this_week": round(float(km_this_week), 2),
        "walks_this_month": walks_this_month,
        "km_this_month": round(float(km_this_month), 2),
        "longest_walk_km": round(float(longest_km), 2),
        "longest_walk_minutes": round(longest_seconds / 60.0, 1),
        "avg_pace_seconds_per_km": round(avg_pace, 1) if avg_pace else None,
    }


# ==========================================
# 📸 WALK PHOTO OPERATIONS
# ==========================================

def create_walk_photo(
    db: Session,
    walk_id: int,
    user_id: int,
    photo_data: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    distance_marker_km: Optional[float] = None,
    caption: Optional[str] = None,
) -> WalkPhoto:
    photo = WalkPhoto(
        walk_id=walk_id,
        user_id=user_id,
        photo_data=photo_data,
        lat=lat,
        lng=lng,
        distance_marker_km=distance_marker_km,
        caption=caption,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


def get_walk_photos(db: Session, walk_id: int) -> List[WalkPhoto]:
    return (
        db.query(WalkPhoto)
        .filter(WalkPhoto.walk_id == walk_id)
        .order_by(WalkPhoto.created_at.asc())
        .all()
    )


def delete_walk_photo(db: Session, photo_id: int, walk_id: int, user_id: int) -> bool:
    photo = (
        db.query(WalkPhoto)
        .filter(
            WalkPhoto.id == photo_id,
            WalkPhoto.walk_id == walk_id,
            WalkPhoto.user_id == user_id,
        )
        .first()
    )
    if not photo:
        return False
    db.delete(photo)
    db.commit()
    return True


# ==========================================
# 🌍 PUBLIC WALK OPERATIONS
# ==========================================

def get_public_walks(
    db: Session,
    region: Optional[str] = None,
    country: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = 50,
) -> List[PublicWalk]:
    q = db.query(PublicWalk)
    if region:
        q = q.filter(PublicWalk.region == region)
    if country:
        q = q.filter(PublicWalk.country == country)
    if difficulty:
        q = q.filter(PublicWalk.difficulty == difficulty)
    return q.order_by(PublicWalk.distance_km.asc()).limit(limit).all()


def get_public_walk(db: Session, walk_id: int) -> Optional[PublicWalk]:
    return db.query(PublicWalk).filter(PublicWalk.id == walk_id).first()


def upsert_public_walk(
    db: Session,
    osm_id: Optional[str],
    name: str,
    distance_km: float,
    route_polyline: str,
    start_lat: float,
    start_lng: float,
    description: Optional[str] = None,
    estimated_duration_min: Optional[int] = None,
    difficulty: Optional[str] = None,
    region: Optional[str] = None,
    country: Optional[str] = None,
    tags: Optional[str] = None,
    source: str = "osm",
) -> PublicWalk:
    """Create or update a public walk by osm_id."""
    existing = None
    if osm_id:
        existing = db.query(PublicWalk).filter(PublicWalk.osm_id == osm_id).first()

    if existing:
        existing.name = name
        existing.distance_km = distance_km
        existing.route_polyline = route_polyline
        existing.start_lat = start_lat
        existing.start_lng = start_lng
        existing.description = description
        existing.estimated_duration_min = estimated_duration_min
        existing.difficulty = difficulty
        existing.region = region
        existing.country = country
        existing.tags = tags
        existing.source = source
        existing.cached_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    walk = PublicWalk(
        osm_id=osm_id,
        name=name,
        distance_km=distance_km,
        route_polyline=route_polyline,
        start_lat=start_lat,
        start_lng=start_lng,
        description=description,
        estimated_duration_min=estimated_duration_min,
        difficulty=difficulty,
        region=region,
        country=country,
        tags=tags,
        source=source,
    )
    db.add(walk)
    db.commit()
    db.refresh(walk)
    return walk
