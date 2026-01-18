"""
🏃 RUNTRACKER API - Main Entry Point
=====================================

Welcome! This is where your API starts.

🎓 LEARNING NOTES:
This file does three things:
1. Creates the FastAPI application
2. Defines API endpoints (URLs that do things)
3. Connects everything together

To run this:
    uvicorn main:app --reload

Then visit: http://localhost:8000/docs
You'll see interactive API documentation!
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import json

# 📦 Import our modules
from database import engine, get_db, Base
from models import Run, WeeklyPlan, Weight, User, UserGoals, StepEntry
from auth import (
    UserCreate, UserLogin, UserResponse, Token,
    create_user, authenticate_user, get_user_by_email,
    create_access_token, get_current_user, require_auth
)
from schemas import (
    RunCreate, RunUpdate, RunResponse, 
    WeeklyPlanCreate, WeeklyPlanResponse,
    StatsResponse, MotivationalMessage, WeeklyStreakProgress,
    RUN_DISTANCES
)
import crud

# ==========================================
# 🚀 CREATE THE APP
# ==========================================

app = FastAPI(
    title="🏃 RunTracker API",
    description="Track your runs, crush your goals!",
    version="1.0.0",
)

# 🌐 CORS Middleware
# This allows your React Native app to talk to this API
# Without this, the browser/app blocks the connection for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your app's domain
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# 🏗️ Create database tables
# This runs when the app starts - creates tables if they don't exist
Base.metadata.create_all(bind=engine)


# ==========================================
# 🏠 HOME ENDPOINT
# ==========================================

@app.get("/")
def read_root():
    """
    👋 Welcome endpoint
    
    Just a friendly greeting to confirm the API is running!
    
    🎓 LEARNING:
    - @app.get("/") is a "decorator" - it registers this function as a route
    - The "/" means this handles requests to the root URL
    - Whatever you return gets sent back as JSON automatically!
    """
    return {
        "message": "🏃 Welcome to RunTracker API!",
        "docs": "Visit /docs for interactive documentation",
        "health": "OK"
    }


# ==========================================
# 🔐 AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/auth/signup", response_model=Token)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    📝 Create a new user account
    
    Returns a JWT token on successful registration.
    """
    # Check if user already exists
    existing_user = get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate password
    if len(user_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )
    
    # Create user
    user = create_user(db, user_data)
    
    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }


@app.post("/auth/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    🔑 Login with email and password
    
    Returns a JWT token on successful authentication.
    """
    user = authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }


@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(require_auth)):
    """
    👤 Get current user info
    
    Requires authentication.
    """
    return UserResponse.model_validate(current_user)


# ==========================================
# 🎯 USER GOALS ENDPOINTS
# ==========================================

@app.get("/user/goals")
def get_user_goals(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """
    🎯 Get current user's goals
    """
    goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
    if not goals:
        # Return defaults
        return {
            "start_weight_lbs": None,
            "goal_weight_lbs": None,
            "weight_goal_date": None,
            "yearly_km_goal": 1000.0,
            "monthly_km_goal": 100.0,
            "onboarding_complete": current_user.onboarding_complete,
        }
    return {
        "start_weight_lbs": goals.start_weight_lbs,
        "goal_weight_lbs": goals.goal_weight_lbs,
        "weight_goal_date": goals.weight_goal_date.isoformat() if goals.weight_goal_date else None,
        "yearly_km_goal": goals.yearly_km_goal,
        "monthly_km_goal": goals.monthly_km_goal,
        "onboarding_complete": current_user.onboarding_complete,
    }


@app.post("/user/goals")
def set_user_goals(goals_data: dict, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """
    🎯 Set or update user's goals
    """
    from datetime import datetime
    
    # Get existing goals or create new
    goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
    if not goals:
        goals = UserGoals(user_id=current_user.id)
        db.add(goals)
    
    # Update fields if provided
    if "start_weight_lbs" in goals_data:
        goals.start_weight_lbs = goals_data["start_weight_lbs"]
    if "goal_weight_lbs" in goals_data:
        goals.goal_weight_lbs = goals_data["goal_weight_lbs"]
    if "weight_goal_date" in goals_data and goals_data["weight_goal_date"]:
        goals.weight_goal_date = datetime.fromisoformat(goals_data["weight_goal_date"].replace("Z", "+00:00"))
    if "yearly_km_goal" in goals_data:
        goals.yearly_km_goal = goals_data["yearly_km_goal"]
    if "monthly_km_goal" in goals_data:
        goals.monthly_km_goal = goals_data["monthly_km_goal"]
    
    db.commit()
    db.refresh(goals)
    
    return {
        "message": "Goals updated",
        "start_weight_lbs": goals.start_weight_lbs,
        "goal_weight_lbs": goals.goal_weight_lbs,
        "weight_goal_date": goals.weight_goal_date.isoformat() if goals.weight_goal_date else None,
        "yearly_km_goal": goals.yearly_km_goal,
        "monthly_km_goal": goals.monthly_km_goal,
    }


@app.post("/user/complete-onboarding")
def complete_onboarding(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """
    ✅ Mark onboarding as complete
    """
    current_user.onboarding_complete = True
    db.commit()
    return {"message": "Onboarding complete", "onboarding_complete": True}


# ==========================================
# 🏃 RUN ENDPOINTS
# ==========================================

@app.post("/runs", response_model=RunResponse)
def create_run(run: RunCreate, db: Session = Depends(get_db)):
    """
    ✨ Create a new run
    
    Call this when you complete a run!
    
    🎓 LEARNING:
    - @app.post means this handles POST requests (creating data)
    - response_model tells FastAPI what shape the response should be
    - Depends(get_db) is "dependency injection" - it gives us a database connection
    - FastAPI automatically validates the request body against RunCreate
    """
    # Validate run type
    if run.run_type not in RUN_DISTANCES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid run type. Must be one of: {list(RUN_DISTANCES.keys())}"
        )
    
    db_run = crud.create_run(db=db, run=run)
    return format_run_response(db_run)


@app.get("/runs", response_model=List[RunResponse])
def get_runs(
    skip: int = 0, 
    limit: int = 100,
    run_type: str = None,
    db: Session = Depends(get_db)
):
    """
    📖 Get all runs
    
    Optional filters:
    - skip: For pagination (skip first N records)
    - limit: Maximum records to return
    - run_type: Filter by type (3k, 5k, etc.)
    """
    runs = crud.get_runs(db, skip=skip, limit=limit, run_type=run_type)
    return [format_run_response(run) for run in runs]


@app.get("/runs/{run_id}", response_model=RunResponse)
def get_run(run_id: int, db: Session = Depends(get_db)):
    """
    🔍 Get a specific run by ID
    
    🎓 LEARNING:
    - {run_id} in the path is a "path parameter"
    - FastAPI automatically converts it to an int
    - If the run doesn't exist, we return a 404 error
    """
    run = crud.get_run(db, run_id=run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return format_run_response(run)


@app.put("/runs/{run_id}", response_model=RunResponse)
def update_run(run_id: int, run_update: RunUpdate, db: Session = Depends(get_db)):
    """
    ✏️ Update an existing run
    
    Allows editing run type, duration, and notes.
    """
    # Validate run type if provided
    if run_update.run_type and run_update.run_type not in RUN_DISTANCES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid run type. Must be one of: {list(RUN_DISTANCES.keys())}"
        )
    
    updated_run = crud.update_run(
        db,
        run_id=run_id,
        run_type=run_update.run_type,
        duration_seconds=run_update.duration_seconds,
        notes=run_update.notes,
        category=run_update.category
    )
    
    if not updated_run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return format_run_response(updated_run)


@app.delete("/runs/{run_id}")
def delete_run(run_id: int, db: Session = Depends(get_db)):
    """🗑️ Delete a run"""
    success = crud.delete_run(db, run_id=run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"message": "Run deleted successfully"}


# ==========================================
# 📅 WEEKLY PLAN ENDPOINTS
# ==========================================

@app.post("/plans", response_model=WeeklyPlanResponse)
def create_weekly_plan(plan: WeeklyPlanCreate, db: Session = Depends(get_db)):
    """📅 Create or update a weekly plan"""
    # Validate all run types
    for run_type in plan.planned_runs:
        if run_type not in RUN_DISTANCES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid run type: {run_type}"
            )
    
    db_plan = crud.create_weekly_plan(db=db, plan=plan)
    return format_plan_response(db_plan)


@app.get("/plans/current", response_model=WeeklyPlanResponse)
def get_current_week_plan(db: Session = Depends(get_db)):
    """📅 Get this week's plan"""
    week_id = crud.get_current_week_id()
    plan = crud.get_weekly_plan(db, week_id=week_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="No plan for this week")
    return format_plan_response(plan)


@app.get("/plans/{week_id}", response_model=WeeklyPlanResponse)
def get_weekly_plan(week_id: str, db: Session = Depends(get_db)):
    """📅 Get a specific week's plan"""
    plan = crud.get_weekly_plan(db, week_id=week_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return format_plan_response(plan)


# ==========================================
# 📊 STATS ENDPOINTS
# ==========================================

@app.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """
    📊 Get your running statistics
    
    Returns totals, weekly stats, monthly stats, and more!
    """
    return crud.get_stats_summary(db)


@app.get("/motivation", response_model=MotivationalMessage)
def get_motivation(db: Session = Depends(get_db)):
    """
    🎉 Get a motivational message
    
    Returns encouragement based on your progress!
    Milestone achievements when you hit certain numbers.
    """
    return crud.get_motivational_message(db)


@app.get("/streak", response_model=WeeklyStreakProgress)
def get_streak_progress(db: Session = Depends(get_db)):
    """
    🔥 Get weekly streak progress
    
    Shows progress toward this week's streak goal:
    - 1 long run (10k+)
    - 2 short runs (any distance)
    """
    return crud.get_weekly_streak_progress(db)


# ==========================================
# 🏆 ACHIEVEMENTS & GOALS ENDPOINTS
# ==========================================

@app.get("/personal-records")
def get_personal_records(db: Session = Depends(get_db)):
    """
    🏆 Get personal records for each distance
    
    Returns fastest time for 3k, 5k, 10k, 15k, 18k, 21k
    """
    from achievements import get_personal_records
    return get_personal_records(db)


@app.get("/goals")
def get_goals(db: Session = Depends(get_db)):
    """
    🎯 Get progress toward yearly and monthly goals
    
    - Yearly goal: 1000km
    - Monthly goal: 100km
    """
    from achievements import get_goals_progress
    return get_goals_progress(db)


@app.get("/achievements")
def get_achievements(db: Session = Depends(get_db)):
    """
    🎖️ Get all achievements and their unlock status
    """
    from achievements import get_achievements
    stats = crud.get_stats_summary(db)
    return get_achievements(db, stats)


# ==========================================
# ⚖️ WEIGHT TRACKING ENDPOINTS
# ==========================================

@app.post("/weights")
def create_weight(weight_data: dict, db: Session = Depends(get_db)):
    """
    ⚖️ Log a new weight entry
    """
    from weight import create_weight_entry
    from datetime import datetime
    
    weight_lbs = weight_data.get("weight_lbs")
    if not weight_lbs or weight_lbs <= 0:
        raise HTTPException(status_code=400, detail="Weight must be a positive number")
    
    recorded_at = None
    if weight_data.get("recorded_at"):
        try:
            recorded_at = datetime.fromisoformat(weight_data["recorded_at"].replace("Z", "+00:00"))
        except:
            recorded_at = None
    
    entry = create_weight_entry(
        db,
        weight_lbs=weight_lbs,
        recorded_at=recorded_at,
        notes=weight_data.get("notes")
    )
    
    return {
        "id": entry.id,
        "weight_lbs": entry.weight_lbs,
        "recorded_at": entry.recorded_at,
        "notes": entry.notes,
    }


@app.get("/weights")
def get_weights(limit: int = 100, db: Session = Depends(get_db)):
    """
    📋 Get all weight entries
    """
    from weight import get_all_weights
    weights = get_all_weights(db, limit=limit)
    return [
        {
            "id": w.id,
            "weight_lbs": w.weight_lbs,
            "recorded_at": w.recorded_at,
            "notes": w.notes,
        }
        for w in weights
    ]


@app.delete("/weights/{weight_id}")
def delete_weight(weight_id: int, db: Session = Depends(get_db)):
    """
    🗑️ Delete a weight entry
    """
    from weight import delete_weight_entry
    success = delete_weight_entry(db, weight_id)
    if not success:
        raise HTTPException(status_code=404, detail="Weight entry not found")
    return {"message": "Weight entry deleted"}


@app.get("/weight-progress")
def get_weight_progress(db: Session = Depends(get_db)):
    """
    📊 Get weight progress toward goal
    
    Goal: 209lb (Jan 7) → 180lb (Dec 31)
    """
    from weight import get_weight_progress
    return get_weight_progress(db)


@app.get("/weight-chart")
def get_weight_chart(db: Session = Depends(get_db)):
    """
    📈 Get weight data for charting
    """
    from weight import get_weight_chart_data
    return get_weight_chart_data(db)


# ==========================================
# 👟 STEPS TRACKING ENDPOINTS
# ==========================================

@app.post("/steps")
def create_step_entry(step_data: dict, db: Session = Depends(get_db)):
    """
    👟 Log a step count for a day
    """
    from datetime import datetime
    
    step_count = step_data.get("step_count")
    if not step_count or step_count <= 0:
        raise HTTPException(status_code=400, detail="Step count must be a positive number")
    
    # Parse date
    recorded_date = None
    if step_data.get("recorded_date"):
        try:
            recorded_date = datetime.fromisoformat(step_data["recorded_date"].replace("Z", "+00:00"))
        except:
            recorded_date = datetime.now()
    else:
        recorded_date = datetime.now()
    
    # Create entry
    entry = StepEntry(
        step_count=step_count,
        recorded_date=recorded_date,
        notes=step_data.get("notes")
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    return {
        "id": entry.id,
        "step_count": entry.step_count,
        "recorded_date": entry.recorded_date.isoformat(),
        "notes": entry.notes,
    }


@app.get("/steps")
def get_step_entries(limit: int = 100, db: Session = Depends(get_db)):
    """
    📋 Get all step entries
    """
    entries = db.query(StepEntry).order_by(StepEntry.recorded_date.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "step_count": e.step_count,
            "recorded_date": e.recorded_date.isoformat(),
            "notes": e.notes,
        }
        for e in entries
    ]


@app.delete("/steps/{entry_id}")
def delete_step_entry(entry_id: int, db: Session = Depends(get_db)):
    """
    🗑️ Delete a step entry
    """
    entry = db.query(StepEntry).filter(StepEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Step entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Step entry deleted"}


@app.get("/steps/summary")
def get_steps_summary(db: Session = Depends(get_db)):
    """
    📊 Get monthly high step day counts
    
    Returns counts of 15k+, 20k+, 25k+ days per month.
    """
    from datetime import datetime
    from sqlalchemy import extract
    
    # Get all step entries from 2026
    entries = db.query(StepEntry).filter(
        StepEntry.recorded_date >= datetime(2026, 1, 1)
    ).all()
    
    # Group by month
    monthly_data = {}
    for entry in entries:
        month_key = entry.recorded_date.strftime("%Y-%m")
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                "month": entry.recorded_date.strftime("%b %Y"),
                "total_entries": 0,
                "days_15k": 0,
                "days_20k": 0,
                "days_25k": 0,
                "highest": 0,
            }
        
        data = monthly_data[month_key]
        data["total_entries"] += 1
        
        if entry.step_count >= 15000:
            data["days_15k"] += 1
        if entry.step_count >= 20000:
            data["days_20k"] += 1
        if entry.step_count >= 25000:
            data["days_25k"] += 1
        if entry.step_count > data["highest"]:
            data["highest"] = entry.step_count
    
    # Calculate current month stats
    now = datetime.now()
    current_month = now.strftime("%Y-%m")
    current_data = monthly_data.get(current_month, {
        "month": now.strftime("%b %Y"),
        "total_entries": 0,
        "days_15k": 0,
        "days_20k": 0,
        "days_25k": 0,
        "highest": 0,
    })
    
    # Calculate all-time totals
    all_15k = sum(m["days_15k"] for m in monthly_data.values())
    all_20k = sum(m["days_20k"] for m in monthly_data.values())
    all_25k = sum(m["days_25k"] for m in monthly_data.values())
    
    return {
        "current_month": current_data,
        "monthly_history": sorted(monthly_data.values(), key=lambda x: x["month"], reverse=True),
        "all_time": {
            "days_15k": all_15k,
            "days_20k": all_20k,
            "days_25k": all_25k,
            "total_entries": len(entries),
        }
    }


# ==========================================
# 🛠️ HELPER FUNCTIONS
# ==========================================

def format_run_response(run: Run) -> dict:
    """
    Format a Run object for the API response.
    
    Adds calculated fields like pace and formatted duration.
    """
    # Calculate pace (time per km)
    if run.distance_km > 0:
        seconds_per_km = run.duration_seconds / run.distance_km
        pace_mins = int(seconds_per_km // 60)
        pace_secs = int(seconds_per_km % 60)
        pace = f"{pace_mins}:{pace_secs:02d}"
    else:
        pace = "0:00"
    
    # Format duration
    mins = run.duration_seconds // 60
    secs = run.duration_seconds % 60
    formatted = f"{mins}:{secs:02d}"
    
    return {
        "id": run.id,
        "run_type": run.run_type,
        "duration_seconds": run.duration_seconds,
        "distance_km": run.distance_km,
        "completed_at": run.completed_at,
        "notes": run.notes,
        "category": getattr(run, 'category', None) or "outdoor",
        "pace_per_km": pace,
        "formatted_duration": formatted,
    }


def format_plan_response(plan: WeeklyPlan) -> dict:
    """Format a WeeklyPlan for API response."""
    return {
        "id": plan.id,
        "week_id": plan.week_id,
        "planned_runs": json.loads(plan.planned_runs),
        "created_at": plan.created_at,
    }


# ==========================================
# 🎓 WHAT'S NEXT?
# ==========================================
"""
Congratulations! You've read through the main API file.

Try these exercises:
1. Add a new endpoint: GET /runs/today (runs completed today)
2. Add a new run type: "25k" 
3. Add a new stat: fastest 5k time

The FastAPI docs at http://localhost:8000/docs let you test all endpoints!
"""
