"""
🏃 ZENRUN API - Main Entry Point
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
from sqlalchemy import text, func
from typing import List, Optional
import json

# 📦 Import our modules
from database import engine, get_db, Base
from models import Run, WeeklyPlan, Weight, User, UserGoals, StepEntry, PasswordResetToken, CircleCheckin, RunPhoto, WeeklyReflection
from auth import (
    UserCreate, UserLogin, UserResponse, Token,
    create_user, authenticate_user, get_user_by_email,
    create_access_token, get_current_user, require_auth
)
from schemas import (
    RunCreate, RunUpdate, RunResponse, 
    WeeklyPlanCreate, WeeklyPlanResponse,
    StatsResponse, MotivationalMessage, WeeklyStreakProgress,
    RUN_DISTANCES, LEVEL_DISTANCES, LEVEL_MAX, LEVEL_ORDER, LEVEL_INFO, LEVEL_GOALS
)
import crud

# ==========================================
# 🚀 CREATE THE APP
# ==========================================

app = FastAPI(
    title="🏃 ZenRun API",
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

# 🔧 Run migrations - add missing columns and tables
def run_migrations():
    """Add new columns and tables if they don't exist."""
    from database import engine
    
    with engine.connect() as conn:
        try:
            # PostgreSQL syntax
            if 'postgresql' in str(engine.url):
                # Add onboarding_complete column to users table
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false
                """))
                # Add handle column to users table
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS handle VARCHAR UNIQUE
                """))
                # Add category column to runs table
                conn.execute(text("""
                    ALTER TABLE runs ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT 'outdoor'
                """))
                # Add mood column to runs table
                conn.execute(text("""
                    ALTER TABLE runs ADD COLUMN IF NOT EXISTS mood VARCHAR
                """))
                # Add user_id column to runs table
                conn.execute(text("""
                    ALTER TABLE runs ADD COLUMN IF NOT EXISTS user_id INTEGER
                """))
                conn.commit()
                
                # Assign orphaned data to the first user (aseem.munshi@gmail.com)
                # This is a one-time migration for existing data
                result = conn.execute(text("SELECT id FROM users WHERE email = 'aseem.munshi@gmail.com' LIMIT 1"))
                row = result.fetchone()
                if row:
                    main_user_id = row[0]
                    # Update runs with NULL user_id
                    conn.execute(text(f"UPDATE runs SET user_id = {main_user_id} WHERE user_id IS NULL"))
                    # Update weights with NULL user_id
                    conn.execute(text(f"UPDATE weights SET user_id = {main_user_id} WHERE user_id IS NULL"))
                    # Update step_entries with NULL user_id
                    conn.execute(text(f"UPDATE step_entries SET user_id = {main_user_id} WHERE user_id IS NULL"))
                    conn.commit()
                    print(f"Migration: Assigned orphaned data to user {main_user_id}")
                
                print("Migration completed: columns added")
            else:
                # SQLite - check if columns exist first
                result = conn.execute(text("PRAGMA table_info(users)"))
                user_columns = [row[1] for row in result]
                if 'onboarding_complete' not in user_columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN DEFAULT 0"))
                    conn.commit()
                    print("Migration: onboarding_complete added to users")
                if 'handle' not in user_columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN handle VARCHAR"))
                    conn.commit()
                    print("Migration: handle added to users")
                
                result = conn.execute(text("PRAGMA table_info(runs)"))
                run_columns = [row[1] for row in result]
                if 'category' not in run_columns:
                    conn.execute(text("ALTER TABLE runs ADD COLUMN category VARCHAR DEFAULT 'outdoor'"))
                    conn.commit()
                    print("Migration: category added to runs")
                if 'user_id' not in run_columns:
                    conn.execute(text("ALTER TABLE runs ADD COLUMN user_id INTEGER"))
                    conn.commit()
                    print("Migration: user_id added to runs")
        except Exception as e:
            print(f"Migration note: {e}")
    
    # Now ensure all tables exist (including user_goals)
    print("Ensuring all tables exist...")
    Base.metadata.create_all(bind=engine)
    print("All tables created/verified")

run_migrations()


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
        "message": "🏃 Welcome to ZenRun API!",
        "docs": "Visit /docs for interactive documentation",
        "health": "OK"
    }


@app.get("/debug/tables")
def debug_tables(db: Session = Depends(get_db)):
    """
    🔍 Debug endpoint to check database tables
    """
    try:
        # Check what tables exist
        if 'postgresql' in str(engine.url):
            result = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
            tables = [row[0] for row in result]
        else:
            result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = [row[0] for row in result]
        
        # Check user_goals table structure if it exists
        user_goals_columns = []
        if 'user_goals' in tables:
            if 'postgresql' in str(engine.url):
                result = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'user_goals'"))
                user_goals_columns = [row[0] for row in result]
            else:
                result = db.execute(text("PRAGMA table_info(user_goals)"))
                user_goals_columns = [row[1] for row in result]
        
        return {
            "tables": tables,
            "user_goals_exists": "user_goals" in tables,
            "user_goals_columns": user_goals_columns,
        }
    except Exception as e:
        return {"error": str(e)}


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
    
    # Send welcome email (fire-and-forget, don't block signup)
    try:
        from email_service import send_welcome_email
        send_welcome_email(user.email, user.name)
    except Exception as e:
        print(f"⚠️ Welcome email failed (non-blocking): {e}")

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
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@app.post("/auth/forgot-password")
def forgot_password(email: str, db: Session = Depends(get_db)):
    """
    🔐 Request a password reset code

    Generates a 6-digit code that expires in 15 minutes.
    Sends the code via email using Resend.
    """
    import random
    from datetime import datetime, timedelta
    from email_service import send_password_reset

    user = get_user_by_email(db, email)
    if not user:
        return {"message": "If an account exists with this email, a reset code has been sent"}

    reset_code = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    db.query(PasswordResetToken).filter(
        PasswordResetToken.email == email,
        PasswordResetToken.used == False
    ).update({"used": True})

    reset_token = PasswordResetToken(
        user_id=user.id,
        email=email,
        reset_code=reset_code,
        expires_at=expires_at
    )
    db.add(reset_token)
    db.commit()

    send_password_reset(email, reset_code)

    return {"message": "If an account exists with this email, a reset code has been sent"}


@app.post("/auth/reset-password")
def reset_password(email: str, code: str, new_password: str, db: Session = Depends(get_db)):
    """
    🔐 Reset password using the code from forgot-password
    
    Requires the 6-digit code and new password.
    """
    import bcrypt
    from datetime import datetime
    
    token = db.query(PasswordResetToken).filter(
        PasswordResetToken.email == email,
        PasswordResetToken.reset_code == code,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset code"
        )
    
    user = db.query(User).filter(User.id == token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    user.hashed_password = hashed
    
    token.used = True
    db.commit()
    
    print(f"✅ Password successfully reset for {email}")
    
    return {"message": "Password reset successfully"}


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
    level = getattr(current_user, 'runner_level', 'breath') or 'breath'
    level_defaults = LEVEL_GOALS.get(level, LEVEL_GOALS['breath'])
    
    goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
    if not goals:
        return {
            "start_weight_lbs": None,
            "goal_weight_lbs": None,
            "weight_goal_date": None,
            "yearly_km_goal": level_defaults["yearly_km"],
            "monthly_km_goal": level_defaults["monthly_km"],
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
    
    try:
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
    except Exception as e:
        db.rollback()
        print(f"Error saving goals: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save goals: {str(e)}")


@app.post("/user/complete-onboarding")
def complete_onboarding(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """
    ✅ Mark onboarding as complete
    """
    current_user.onboarding_complete = True
    db.commit()
    return {"message": "Onboarding complete", "onboarding_complete": True}


# ==========================================
# 🏃 RUNNER LEVEL ENDPOINTS
# ==========================================

@app.get("/user/level")
def get_user_level(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Get the user's runner level, available distances, and upgrade eligibility."""
    level = getattr(current_user, 'runner_level', None) or 'breath'
    distances = LEVEL_DISTANCES.get(level, LEVEL_DISTANCES['breath'])
    level_idx = LEVEL_ORDER.index(level) if level in LEVEL_ORDER else 0
    next_level = LEVEL_ORDER[level_idx + 1] if level_idx < len(LEVEL_ORDER) - 1 else None
    
    upgrade_eligible = False
    upgrade_weeks = 0
    if next_level and level in LEVEL_MAX:
        max_distance = LEVEL_MAX[level]
        upgrade_eligible, upgrade_weeks = _check_upgrade_eligibility(db, current_user.id, max_distance)
    
    return {
        "level": level,
        "level_info": LEVEL_INFO.get(level, {}),
        "distances": distances,
        "next_level": next_level,
        "next_level_info": LEVEL_INFO.get(next_level) if next_level else None,
        "upgrade_eligible": upgrade_eligible,
        "upgrade_weeks": upgrade_weeks,
        "all_levels": {k: {**v, "distances": LEVEL_DISTANCES[k]} for k, v in LEVEL_INFO.items() if k != "zen"},
    }


@app.put("/user/level")
def set_user_level(level_data: dict, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Set the user's runner level and update goals to level defaults."""
    new_level = level_data.get("level", "").lower()
    if new_level not in LEVEL_ORDER:
        raise HTTPException(status_code=400, detail=f"Invalid level. Must be one of: {LEVEL_ORDER}")

    current_user.runner_level = new_level
    
    level_goals = LEVEL_GOALS.get(new_level, LEVEL_GOALS['breath'])
    goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
    if not goals:
        goals = UserGoals(user_id=current_user.id)
        db.add(goals)
    goals.yearly_km_goal = level_goals["yearly_km"]
    goals.monthly_km_goal = level_goals["monthly_km"]
    
    db.commit()
    return {
        "message": f"Level updated to {new_level}",
        "level": new_level,
        "yearly_km_goal": level_goals["yearly_km"],
        "monthly_km_goal": level_goals["monthly_km"],
    }


@app.put("/user/privacy")
def set_user_privacy(body: dict, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Set the user's profile privacy level."""
    privacy = body.get("privacy", "").lower()
    if privacy not in ("private", "circles", "public"):
        raise HTTPException(status_code=400, detail="Invalid privacy setting. Must be: private, circles, or public")
    current_user.profile_privacy = privacy
    db.commit()
    return {"privacy": privacy}


def _check_upgrade_eligibility(db: Session, user_id: int, max_distance: str) -> tuple:
    """Check if user has logged at least 1 run at max_distance in each of the last 4 weeks."""
    from datetime import datetime, timedelta
    
    now = datetime.now()
    weeks_hit = 0
    
    for w in range(4):
        week_end = now - timedelta(weeks=w)
        week_start = week_end - timedelta(days=7)
        count = db.query(Run).filter(
            Run.user_id == user_id,
            Run.run_type == max_distance,
            Run.completed_at >= week_start,
            Run.completed_at <= week_end,
        ).count()
        if count > 0:
            weeks_hit += 1
        else:
            break
    
    return (weeks_hit >= 4, weeks_hit)


# ==========================================
# 🏃 RUN ENDPOINTS
# ==========================================

@app.post("/runs", response_model=RunResponse)
def create_run(
    run: RunCreate, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
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
    
    # Get user_id if logged in
    user_id = current_user.id if current_user else None
    
    db_run = crud.create_run(db=db, run=run, user_id=user_id)
    
    # 🎉 Check for all celebrations!
    celebrations = check_all_celebrations(db, db_run, current_user)
    
    # Legacy PR check for backwards compatibility
    is_pr = any(c["type"] == "personal_best" for c in celebrations)
    pr_type = next((c["type"] for c in celebrations if c["type"] == "personal_best"), None)
    
    return format_run_response(db_run, is_personal_best=is_pr, pr_type=pr_type, celebrations=celebrations, db=db)


@app.get("/runs", response_model=List[RunResponse])
def get_runs(
    skip: int = 0, 
    limit: int = 100,
    run_type: str = None,
    category: str = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    📖 Get all runs for the current user
    
    Optional filters:
    - skip: For pagination (skip first N records)
    - limit: Maximum records to return
    - run_type: Filter by type (3k, 5k, etc.)
    - category: Filter by category (outdoor, treadmill)
    """
    user_id = current_user.id if current_user else None
    runs = crud.get_runs(db, skip=skip, limit=limit, run_type=run_type, user_id=user_id, category=category)
    return [format_run_response(run, db=db) for run in runs]


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
    return format_run_response(run, db=db)


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
        category=run_update.category,
        mood=run_update.mood
    )
    
    if not updated_run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return format_run_response(updated_run, db=db)


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
def get_stats(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    📊 Get your running statistics
    
    Returns totals, weekly stats, monthly stats, and more!
    """
    user_id = current_user.id if current_user else None
    return crud.get_stats_summary(db, user_id=user_id)


@app.get("/motivation", response_model=MotivationalMessage)
def get_motivation(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    🎉 Get a motivational message
    
    Returns encouragement based on your progress!
    Milestone achievements when you hit certain numbers.
    """
    user_id = current_user.id if current_user else None
    return crud.get_motivational_message(db, user_id=user_id)


@app.get("/streak", response_model=WeeklyStreakProgress)
def get_streak_progress(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    🔥 Get weekly streak progress for current user
    
    Shows progress toward this week's streak goal:
    - 1 long run (10k+)
    - 2 short runs (any distance)
    """
    user_id = current_user.id if current_user else None
    return crud.get_weekly_streak_progress(db, user_id=user_id)


# ==========================================
# 🏆 ACHIEVEMENTS & GOALS ENDPOINTS
# ==========================================

@app.get("/personal-records")
def get_personal_records(
    category: str = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    🏆 Get personal records for each distance for current user
    
    Returns fastest time for 3k, 5k, 10k, 15k, 18k, 21k
    Optional category filter: outdoor, treadmill
    """
    from achievements import get_personal_records
    user_id = current_user.id if current_user else None
    return get_personal_records(db, user_id=user_id, category=category)


@app.get("/goals")
def get_goals(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    🎯 Get progress toward yearly and monthly goals
    
    Uses user's personal goals if logged in, otherwise defaults.
    """
    from achievements import get_goals_progress
    
    user_id = None
    
    if current_user:
        user_id = current_user.id
        level = getattr(current_user, 'runner_level', 'breath') or 'breath'
        level_defaults = LEVEL_GOALS.get(level, LEVEL_GOALS['breath'])
        yearly_goal = level_defaults["yearly_km"]
        monthly_goal = level_defaults["monthly_km"]
        
        user_goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
        if user_goals:
            yearly_goal = user_goals.yearly_km_goal or yearly_goal
            monthly_goal = user_goals.monthly_km_goal or monthly_goal
    else:
        yearly_goal = LEVEL_GOALS['breath']["yearly_km"]
        monthly_goal = LEVEL_GOALS['breath']["monthly_km"]
    
    return get_goals_progress(db, yearly_goal=yearly_goal, monthly_goal=monthly_goal, user_id=user_id)


@app.get("/achievements")
def get_achievements(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    🎖️ Get all achievements and their unlock status for current user
    """
    from achievements import get_achievements
    user_id = current_user.id if current_user else None
    stats = crud.get_stats_summary(db, user_id=user_id)

    if current_user:
        level = getattr(current_user, 'runner_level', 'breath') or 'breath'
        level_defaults = LEVEL_GOALS.get(level, LEVEL_GOALS['breath'])
        yearly_goal = level_defaults["yearly_km"]
        monthly_goal = level_defaults["monthly_km"]
        user_goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
        if user_goals:
            yearly_goal = user_goals.yearly_km_goal or yearly_goal
            monthly_goal = user_goals.monthly_km_goal or monthly_goal
    else:
        yearly_goal = LEVEL_GOALS['breath']["yearly_km"]
        monthly_goal = LEVEL_GOALS['breath']["monthly_km"]

    return get_achievements(db, stats, user_id=user_id, yearly_goal=yearly_goal, monthly_goal=monthly_goal)


@app.get("/month-review")
def get_month_review(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    📅 Get month in review data
    
    Shows comprehensive monthly stats. Visible from last day of month
    through first 7 days of the next month.
    
    Optional params to view specific month (for testing/history).
    """
    user_id = current_user.id if current_user else None
    return crud.get_month_in_review(db, user_id=user_id, target_month=month, target_year=year)


# ==========================================
# ⚖️ WEIGHT TRACKING ENDPOINTS
# ==========================================

@app.post("/weights")
def create_weight(
    weight_data: dict, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
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
    
    user_id = current_user.id if current_user else None
    entry = create_weight_entry(
        db,
        weight_lbs=weight_lbs,
        recorded_at=recorded_at,
        notes=weight_data.get("notes"),
        user_id=user_id
    )
    
    return {
        "id": entry.id,
        "weight_lbs": entry.weight_lbs,
        "recorded_at": entry.recorded_at,
        "notes": entry.notes,
    }


@app.get("/weights")
def get_weights(
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    📋 Get weight entries for current user
    """
    from weight import get_all_weights
    user_id = current_user.id if current_user else None
    weights = get_all_weights(db, limit=limit, user_id=user_id)
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
def get_weight_progress(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    📊 Get weight progress toward goal for current user
    
    Goal: 209lb (Jan 7) → 180lb (Dec 31)
    """
    from weight import get_weight_progress
    user_id = current_user.id if current_user else None
    return get_weight_progress(db, user_id=user_id)


@app.get("/weight-chart")
def get_weight_chart(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    📈 Get weight data for charting for current user
    """
    from weight import get_weight_chart_data
    user_id = current_user.id if current_user else None
    return get_weight_chart_data(db, user_id=user_id)


# ==========================================
# 👟 STEPS TRACKING ENDPOINTS
# ==========================================

@app.post("/steps")
def create_step_entry(
    step_data: dict, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
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
    
    # Create entry with user_id
    user_id = current_user.id if current_user else None
    entry = StepEntry(
        step_count=step_count,
        recorded_date=recorded_date,
        notes=step_data.get("notes"),
        user_id=user_id
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    # 🎉 Check for high step day celebration
    celebrations = []
    if step_count >= 25000:
        celebrations.append({
            "type": "high_steps",
            "title": "🚀 25K+ Steps!",
            "message": "Incredible! You crushed it today!"
        })
    elif step_count >= 20000:
        celebrations.append({
            "type": "high_steps",
            "title": "🔥 20K+ Steps!",
            "message": "Amazing step count! Keep moving!"
        })
    elif step_count >= 15000:
        celebrations.append({
            "type": "high_steps",
            "title": "👟 15K+ Steps!",
            "message": "Great job staying active today!"
        })
    
    return {
        "id": entry.id,
        "step_count": entry.step_count,
        "recorded_date": entry.recorded_date.isoformat(),
        "notes": entry.notes,
        "celebrations": celebrations,
    }


@app.get("/steps")
def get_step_entries(
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    📋 Get step entries for current user
    """
    query = db.query(StepEntry)
    if current_user:
        query = query.filter(StepEntry.user_id == current_user.id)
    entries = query.order_by(StepEntry.recorded_date.desc()).limit(limit).all()
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
def get_steps_summary(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    📊 Get monthly high step day counts for current user
    
    Returns counts of 15k+, 20k+, 25k+ days per month.
    """
    from datetime import datetime
    from sqlalchemy import extract
    
    # Get all step entries from 2026 for this user
    query = db.query(StepEntry).filter(
        StepEntry.recorded_date >= datetime(2026, 1, 1)
    )
    if current_user:
        query = query.filter(StepEntry.user_id == current_user.id)
    entries = query.all()
    
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

def format_run_response(run: Run, is_personal_best: bool = False, pr_type: str = None, celebrations: list = None, db: Session = None) -> dict:
    """
    Format a Run object for the API response.
    
    Adds calculated fields like pace and formatted duration.
    """
    if run.distance_km > 0:
        seconds_per_km = run.duration_seconds / run.distance_km
        pace_mins = int(seconds_per_km // 60)
        pace_secs = int(seconds_per_km % 60)
        pace = f"{pace_mins}:{pace_secs:02d}"
    else:
        pace = "0:00"
    
    mins = run.duration_seconds // 60
    secs = run.duration_seconds % 60
    formatted = f"{mins}:{secs:02d}"
    
    photo_count = 0
    if db:
        photo_count = db.query(RunPhoto).filter(RunPhoto.run_id == run.id).count()
    
    return {
        "id": run.id,
        "run_type": run.run_type,
        "duration_seconds": run.duration_seconds,
        "distance_km": run.distance_km,
        "completed_at": run.completed_at,
        "notes": run.notes,
        "mood": getattr(run, 'mood', None),
        "category": getattr(run, 'category', None),
        "pace_per_km": pace,
        "formatted_duration": formatted,
        "is_personal_best": is_personal_best,
        "pr_type": pr_type,
        "celebrations": celebrations or [],
        "photo_count": photo_count,
    }


def check_personal_best(db: Session, new_run: Run) -> tuple:
    """
    🏆 Check if a new run is a personal best for the same user and category.
    
    Returns (is_pr, pr_type) tuple.
    PR types: "fastest_3k", "fastest_5k", etc.
    """
    from datetime import datetime
    min_date = datetime(2026, 1, 1)
    
    run_category = getattr(new_run, 'category', 'outdoor') or 'outdoor'
    
    query = db.query(Run).filter(
        Run.run_type == new_run.run_type,
        Run.id != new_run.id,
        Run.completed_at >= min_date,
    )
    if run_category == 'outdoor':
        query = query.filter((Run.category == 'outdoor') | (Run.category == None))
    else:
        query = query.filter(Run.category == run_category)
    if new_run.user_id is not None:
        query = query.filter(Run.user_id == new_run.user_id)
    previous_runs = query.all()
    
    # If no previous runs of this type, it's automatically a PR!
    if not previous_runs:
        return True, f"fastest_{new_run.run_type}"
    
    # Check if this is the fastest time for this distance
    best_previous_time = min(r.duration_seconds for r in previous_runs)
    
    if new_run.duration_seconds < best_previous_time:
        return True, f"fastest_{new_run.run_type}"
    
    return False, None


def check_all_celebrations(db: Session, new_run: Run, current_user) -> list:
    """
    🎉 Check for ALL celebration-worthy achievements after a run.
    
    Returns a list of celebration dicts with type, title, and message.
    """
    from datetime import datetime, timedelta
    from models import UserGoals
    
    celebrations = []
    min_date = datetime(2026, 1, 1)
    
    if not current_user:
        return celebrations
    
    user_id = current_user.id
    
    # 1. 🏆 Personal Best Check
    is_pr, pr_type = check_personal_best(db, new_run)
    if is_pr:
        celebrations.append({
            "type": "personal_best",
            "title": "🏆 Personal Best!",
            "message": f"New fastest {new_run.run_type.upper()} time!"
        })
    
    # 2. 🔥 Streak Maintained Check
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    
    # Check if user had runs on previous days (streak was active before this run)
    runs_before_today = db.query(Run).filter(
        Run.user_id == user_id,
        Run.id != new_run.id,
        Run.completed_at >= min_date
    ).all()
    
    if runs_before_today:
        # Get unique run dates before today
        run_dates = set(r.completed_at.date() for r in runs_before_today if r.completed_at.date() < today)
        
        if yesterday in run_dates:
            # User ran yesterday and today - streak continues!
            # Count the streak length
            streak = 1
            check_date = yesterday
            while check_date in run_dates:
                streak += 1
                check_date = check_date - timedelta(days=1)
            
            # Only celebrate if streak is 3+ days
            if streak >= 3:
                celebrations.append({
                    "type": "streak",
                    "title": "🌳 Rhythm continues!",
                    "message": "Your rhythm is growing!"
                })
    
    # 3. 🎯 Monthly Goal Met Check
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    user_goals = db.query(UserGoals).filter(UserGoals.user_id == user_id).first()
    if user_goals:
        monthly_goal = user_goals.monthly_km_goal
    else:
        user_obj = db.query(User).filter(User.id == user_id).first()
        level = getattr(user_obj, 'runner_level', 'breath') or 'breath' if user_obj else 'breath'
        monthly_goal = LEVEL_GOALS.get(level, LEVEL_GOALS['breath'])["monthly_km"]
    
    # Get all runs this month (including the new one)
    monthly_runs = db.query(Run).filter(
        Run.user_id == user_id,
        Run.completed_at >= month_start,
        Run.completed_at >= min_date
    ).all()
    
    total_monthly_km = sum(r.distance_km for r in monthly_runs)
    km_before_this_run = total_monthly_km - new_run.distance_km
    
    # Check if this run pushed us over the goal
    if km_before_this_run < monthly_goal <= total_monthly_km:
        celebrations.append({
            "type": "monthly_goal",
            "title": "🎯 Monthly Goal Crushed!",
            "message": f"You hit {monthly_goal}km for {now.strftime('%B')}!"
        })
    
    return celebrations


def format_plan_response(plan: WeeklyPlan) -> dict:
    """Format a WeeklyPlan for API response."""
    return {
        "id": plan.id,
        "week_id": plan.week_id,
        "planned_runs": json.loads(plan.planned_runs),
        "created_at": plan.created_at,
    }


# ==========================================
# 👥 CIRCLES (SOCIAL FEATURES)
# ==========================================

from models import Circle, CircleMembership, CircleFeedReaction
import secrets

@app.post("/circles")
def create_circle(
    circle_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    👥 Create a new circle
    
    Creates a circle and automatically adds the creator as a member.
    """
    name = circle_data.get("name")
    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Circle name must be at least 2 characters")
    
    # Generate unique invite code
    invite_code = secrets.token_urlsafe(6).upper()[:8]
    
    # Create circle
    circle = Circle(
        name=name,
        invite_code=invite_code,
        created_by=current_user.id
    )
    db.add(circle)
    db.commit()
    db.refresh(circle)
    
    # Add creator as first member
    membership = CircleMembership(
        circle_id=circle.id,
        user_id=current_user.id
    )
    db.add(membership)
    db.commit()
    
    return {
        "id": circle.id,
        "name": circle.name,
        "invite_code": circle.invite_code,
        "created_by": current_user.id,
        "member_count": 1,
    }


@app.get("/circles")
def get_my_circles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    👥 Get all circles the current user is a member of
    """
    memberships = db.query(CircleMembership).filter(
        CircleMembership.user_id == current_user.id
    ).all()
    
    circles = []
    for membership in memberships:
        circle = db.query(Circle).filter(Circle.id == membership.circle_id).first()
        if circle:
            member_count = db.query(CircleMembership).filter(
                CircleMembership.circle_id == circle.id
            ).count()
            circles.append({
                "id": circle.id,
                "name": circle.name,
                "invite_code": circle.invite_code,
                "member_count": member_count,
                "is_creator": circle.created_by == current_user.id,
                "joined_at": membership.joined_at.isoformat(),
            })
    
    return circles


@app.post("/circles/join")
def join_circle(
    join_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    🤝 Join a circle using invite code
    """
    invite_code = join_data.get("invite_code", "").upper().strip()
    if not invite_code:
        raise HTTPException(status_code=400, detail="Invite code is required")
    
    # Find circle
    circle = db.query(Circle).filter(Circle.invite_code == invite_code).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found. Check your invite code.")
    
    # Check if already a member
    existing = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle.id,
        CircleMembership.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You're already a member of this circle")
    
    # Check member limit (max 10)
    member_count = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle.id
    ).count()
    if member_count >= 10:
        raise HTTPException(status_code=400, detail="This circle is full (max 10 members)")
    
    # Add member
    membership = CircleMembership(
        circle_id=circle.id,
        user_id=current_user.id
    )
    db.add(membership)
    db.commit()
    
    return {
        "message": f"Welcome to {circle.name}!",
        "circle_id": circle.id,
        "circle_name": circle.name,
    }


@app.delete("/circles/{circle_id}/leave")
def leave_circle(
    circle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    👋 Leave a circle
    """
    membership = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id,
        CircleMembership.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="You're not a member of this circle")
    
    db.delete(membership)
    db.commit()
    
    return {"message": "You've left the circle"}


@app.get("/circles/{circle_id}")
def get_circle_details(
    circle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    👥 Get circle details including members and leaderboard
    """
    # Verify membership
    membership = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id,
        CircleMembership.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="You're not a member of this circle")
    
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    
    # Get all members with their stats
    memberships = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id
    ).all()
    
    from datetime import datetime
    min_date = datetime(2026, 1, 1)
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    members = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            # Get user's stats
            user_runs = db.query(Run).filter(
                Run.user_id == user.id,
                Run.completed_at >= min_date
            ).all()
            
            monthly_runs = [r for r in user_runs if r.completed_at >= month_start]
            
            total_km = sum(r.distance_km for r in user_runs)
            monthly_km = sum(r.distance_km for r in monthly_runs)
            
            members.append({
                "user_id": user.id,
                "name": user.name or "Runner",
                "handle": user.handle,
                "total_runs": len(user_runs),
                "total_km": round(total_km, 1),
                "monthly_km": round(monthly_km, 1),
                "monthly_runs": len(monthly_runs),
                "is_you": user.id == current_user.id,
            })
    
    # Sort by monthly km (leaderboard)
    members.sort(key=lambda x: x["monthly_km"], reverse=True)
    
    # Add rank
    for i, member in enumerate(members):
        member["rank"] = i + 1
    
    # Circle milestones
    milestones = []
    total_circle_km = sum(m["monthly_km"] for m in members)
    milestones.append({
        "type": "combined_km",
        "message": f"Your circle ran {round(total_circle_km)} km together this month",
    })
    
    active_members = sum(1 for m in members if m["monthly_runs"] > 0)
    if active_members == len(members) and len(members) > 1:
        milestones.append({
            "type": "all_active",
            "message": "Everyone showed up this month",
        })
    
    all_streaking = True
    for m in memberships:
        _, streak_longest = crud.calculate_streaks(db, user_id=m.user_id)
        current, _ = crud.calculate_streaks(db, user_id=m.user_id)
        if current < 1:
            all_streaking = False
            break
    
    if all_streaking and len(members) > 1:
        milestones.append({
            "type": "all_streaking",
            "message": "Everyone's rhythm is alive this week",
        })
    
    # This week's check-ins
    week_start, _ = crud.get_week_boundaries_for_date(now)
    checkins_raw = db.query(CircleCheckin).filter(
        CircleCheckin.circle_id == circle_id,
        CircleCheckin.week_start == week_start
    ).all()
    
    checkins = []
    my_checkin = None
    for c in checkins_raw:
        user = db.query(User).filter(User.id == c.user_id).first()
        entry = {
            "user_id": c.user_id,
            "name": user.name if user else "Runner",
            "handle": user.handle if user else None,
            "emoji": c.emoji,
            "message": c.message,
            "is_you": c.user_id == current_user.id,
        }
        checkins.append(entry)
        if c.user_id == current_user.id:
            my_checkin = entry
    
    return {
        "id": circle.id,
        "name": circle.name,
        "invite_code": circle.invite_code,
        "member_count": len(members),
        "members": members,
        "milestones": milestones,
        "checkins": checkins,
        "my_checkin": my_checkin,
        "created_by": circle.created_by,
    }


@app.get("/user/me")
def get_current_user_info(
    current_user: User = Depends(require_auth)
):
    """
    👤 Get current user's info including handle
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "handle": current_user.handle,
        "onboarding_complete": current_user.onboarding_complete,
        "profile_privacy": getattr(current_user, 'profile_privacy', 'private') or 'private',
    }


@app.post("/user/handle")
def set_user_handle(
    handle_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    🏷️ Set or update user's handle
    """
    handle = handle_data.get("handle", "").strip().lower()
    
    # Validate handle
    if not handle or len(handle) < 3:
        raise HTTPException(status_code=400, detail="Handle must be at least 3 characters")
    if len(handle) > 20:
        raise HTTPException(status_code=400, detail="Handle must be 20 characters or less")
    if not handle.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Handle can only contain letters, numbers, and underscores")
    
    # Check if handle is taken
    existing = db.query(User).filter(User.handle == handle, User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="This handle is already taken")
    
    # Update handle
    current_user.handle = handle
    db.commit()
    
    return {"handle": handle, "message": "Handle updated!"}


@app.get("/user/handle/{handle}")
def check_handle_available(
    handle: str,
    db: Session = Depends(get_db)
):
    """
    🔍 Check if a handle is available
    """
    handle = handle.strip().lower()
    existing = db.query(User).filter(User.handle == handle).first()
    return {"handle": handle, "available": existing is None}


# ==========================================
# 🌐 PUBLIC PROFILE
# ==========================================

@app.get("/profile/{handle}")
def get_public_profile(
    handle: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Public profile endpoint. Respects privacy settings. Own profile always visible."""
    from models import CircleMembership, RunPhoto
    from achievements import get_achievements
    from collections import defaultdict

    handle = handle.strip().lower()
    profile_user = db.query(User).filter(User.handle == handle).first()
    if not profile_user:
        raise HTTPException(status_code=404, detail="Runner not found")

    privacy = getattr(profile_user, 'profile_privacy', 'private') or 'private'
    is_own_profile = current_user is not None and current_user.id == profile_user.id

    if not is_own_profile:
        if privacy == "private":
            raise HTTPException(status_code=404, detail="Runner not found")

        if privacy == "circles":
            if not current_user:
                return {"privacy": "circles", "handle": handle, "visible": False, "is_own_profile": False}
            viewer_circles = {m.circle_id for m in db.query(CircleMembership).filter(
                CircleMembership.user_id == current_user.id
            ).all()}
            profile_circles = {m.circle_id for m in db.query(CircleMembership).filter(
                CircleMembership.user_id == profile_user.id
            ).all()}
            shared = viewer_circles & profile_circles
            if not shared:
                return {"privacy": "circles", "handle": handle, "visible": False, "is_own_profile": False}

    stats = crud.get_stats_summary(db, user_id=profile_user.id)
    streak = crud.get_weekly_streak_progress(db, user_id=profile_user.id)

    level = getattr(profile_user, 'runner_level', 'breath') or 'breath'
    from schemas import LEVEL_GOALS
    level_goals = LEVEL_GOALS.get(level, LEVEL_GOALS['breath'])
    achievements_data = get_achievements(
        db, stats, user_id=profile_user.id,
        yearly_goal=level_goals["yearly_km"],
        monthly_goal=level_goals["monthly_km"],
    )

    total_seconds = stats.get("total_duration_seconds", 0)
    total_hours = round(total_seconds / 3600, 1) if total_seconds else 0

    min_date = datetime(2026, 1, 1)
    all_runs = db.query(Run).filter(
        Run.user_id == profile_user.id,
        Run.completed_at >= min_date
    ).order_by(Run.completed_at.desc()).all()

    outdoor_runs = [r for r in all_runs if (r.category or "outdoor") == "outdoor"]
    treadmill_runs = [r for r in all_runs if r.category == "treadmill"]

    outdoor_km = round(sum(r.distance_km for r in outdoor_runs), 1)
    treadmill_km = round(sum(r.distance_km for r in treadmill_runs), 1)

    monthly_summary = defaultdict(lambda: {"runs": 0, "km": 0.0})
    for r in all_runs:
        key = r.completed_at.strftime("%Y-%m")
        monthly_summary[key]["runs"] += 1
        monthly_summary[key]["km"] += r.distance_km
    monthly_list = [
        {"month": k, "runs": v["runs"], "km": round(v["km"], 1)}
        for k, v in sorted(monthly_summary.items(), reverse=True)
    ][:6]

    scenic_count = db.query(RunPhoto).filter(RunPhoto.user_id == profile_user.id).count()
    scenic_runs_count = db.query(func.count(func.distinct(RunPhoto.run_id))).filter(
        RunPhoto.user_id == profile_user.id
    ).scalar() or 0

    distance_breakdown = {}
    for r in all_runs:
        rt = r.run_type or "other"
        distance_breakdown[rt] = distance_breakdown.get(rt, 0) + 1

    from achievements import get_personal_records as _get_prs
    personal_records = _get_prs(db, user_id=profile_user.id)

    scenic_gallery = []
    if scenic_runs_count > 0:
        photo_runs = db.query(RunPhoto.run_id, func.count(RunPhoto.id).label("cnt")).filter(
            RunPhoto.user_id == profile_user.id
        ).group_by(RunPhoto.run_id).all()
        run_ids = [pr.run_id for pr in photo_runs]
        photo_count_map = {pr.run_id: pr.cnt for pr in photo_runs}
        scenic_run_objs = db.query(Run).filter(Run.id.in_(run_ids)).order_by(Run.completed_at.desc()).limit(6).all()
        for sr in scenic_run_objs:
            cover = db.query(RunPhoto).filter(RunPhoto.run_id == sr.id).order_by(RunPhoto.distance_marker_km.asc()).first()
            scenic_gallery.append({
                "run_id": sr.id,
                "run_type": sr.run_type,
                "distance_km": sr.distance_km,
                "completed_at": sr.completed_at.isoformat() if sr.completed_at else None,
                "photo_count": photo_count_map.get(sr.id, 0),
                "cover_photo": cover.photo_data if cover else None,
                "caption": cover.caption if cover else None,
            })

    return {
        "privacy": privacy,
        "visible": True,
        "is_own_profile": is_own_profile,
        "handle": profile_user.handle,
        "name": profile_user.name,
        "runner_level": level,
        "member_since": profile_user.created_at.isoformat() if profile_user.created_at else None,
        "total_runs": stats.get("total_runs", 0),
        "total_km": round(stats.get("total_km", 0), 1),
        "total_hours": total_hours,
        "current_streak": streak.get("current_streak", 0),
        "longest_streak": streak.get("longest_streak", 0),
        "outdoor_runs": len(outdoor_runs),
        "outdoor_km": outdoor_km,
        "treadmill_runs": len(treadmill_runs),
        "treadmill_km": treadmill_km,
        "monthly_summary": monthly_list,
        "scenic_photos": scenic_count,
        "scenic_runs": scenic_runs_count,
        "distance_breakdown": distance_breakdown,
        "personal_records": personal_records,
        "scenic_gallery": scenic_gallery,
        "achievements": [
            {"emoji": a["emoji"], "name": a["name"], "category": a["category"]}
            for a in achievements_data.get("unlocked", [])
        ],
        "achievements_count": achievements_data.get("unlocked_count", 0),
        "achievements_total": achievements_data.get("total", 0),
    }


# ==========================================
# 🌿 DAILY WISDOM
# ==========================================

DAILY_QUOTES = [
    {"text": "Sometimes we complicate things with gadgets and gear, when what we really need is to trust our bodies and keep things simple.", "author": "Christopher McDougall"},
    {"text": "All I do is keep on running in my own cozy, homemade void, my own nostalgic silence. And this is a pretty wonderful thing.", "author": "Haruki Murakami"},
    {"text": "The only opponent you have to beat is yourself, the way you used to be.", "author": "Haruki Murakami"},
    {"text": "The runner need not break four minutes in the mile or four hours in the marathon. It is only necessary that he runs.", "author": "George Sheehan"},
    {"text": "If you run, you are a runner. It doesn't matter how fast or how far.", "author": "John Bingham"},
    {"text": "Running is nothing more than a series of arguments between the part of your brain that wants to stop and the part that wants to keep going.", "author": "Unknown"},
    {"text": "The real purpose of running isn't to win a race. It's to test the limits of the human heart.", "author": "Bill Bowerman"},
    {"text": "I run because long after my footprints fade far away, my running will leave imprints in my mind forever.", "author": "Budd Coates"},
    {"text": "There is magic in misery. Just ask any runner.", "author": "Dean Karnazes"},
    {"text": "We run, not because we think it is doing us good, but because we enjoy it and cannot help ourselves.", "author": "Roger Bannister"},
    {"text": "Believe that you can run farther or faster. Believe that you are young enough, old enough, strong enough.", "author": "Percy Cerutty"},
    {"text": "The obsession with running is really an obsession with the potential for more and more life.", "author": "George Sheehan"},
    {"text": "Out on the roads there is fitness and self-discovery and the persons we were destined to be.", "author": "George Sheehan"},
    {"text": "Running allows me to set my mind free. Nothing seems impossible.", "author": "Kara Goucher"},
    {"text": "Pain is inevitable. Suffering is optional.", "author": "Haruki Murakami"},
    {"text": "Every morning in Africa, a gazelle wakes up knowing it must outrun the fastest lion or it will be killed. Every morning a lion wakes up knowing it must run faster than the slowest gazelle or it will starve. It doesn't matter whether you're a lion or a gazelle — when the sun comes up, you'd better be running.", "author": "Christopher McDougall"},
    {"text": "The body does not want you to do this. As you run, it tells you to stop but the mind casts it aside and says keep going.", "author": "Jacki Hanson"},
    {"text": "Ask nothing from your running, and you'll get more than you ever imagined.", "author": "Christopher McDougall"},
    {"text": "I always loved running — it was something you could do by yourself and under your own power.", "author": "Jesse Owens"},
    {"text": "Go fast enough to get there, but slow enough to see.", "author": "Jimmy Buffett"},
    {"text": "Run often. Run long. But never outrun your joy of running.", "author": "Julie Isphording"},
    {"text": "I don't run to add days to my life, I run to add life to my days.", "author": "Ronald Rook"},
    {"text": "The miracle isn't that I finished. The miracle is that I had the courage to start.", "author": "John Bingham"},
    {"text": "Your body will argue that there is no justifiable reason to continue. Your only recourse is to call on your spirit, which fortunately functions independently of logic.", "author": "Tim Noakes"},
    {"text": "Consistency is the true foundation of trust. Either keep your promises or do not make them.", "author": "Roy T. Bennett"},
    {"text": "It does not matter how slowly you go as long as you do not stop.", "author": "Confucius"},
    {"text": "Success isn't always about greatness. It's about consistency. Consistent hard work leads to success.", "author": "Dwayne Johnson"},
    {"text": "Life is a marathon, not a sprint. Pace yourself accordingly.", "author": "Amby Burfoot"},
    {"text": "Running is the greatest metaphor for life, because you get out of it what you put into it.", "author": "Oprah Winfrey"},
    {"text": "There are clubs you can't belong to, neighborhoods you can't live in, schools you can't get into, but the roads are always open.", "author": "Nike"},
]

@app.get("/daily-wisdom")
def get_daily_wisdom():
    """Return a deterministic daily quote based on day of year."""
    from datetime import datetime
    day_of_year = datetime.now().timetuple().tm_yday
    quote = DAILY_QUOTES[day_of_year % len(DAILY_QUOTES)]
    return {"text": quote["text"], "author": quote["author"]}


# ==========================================
# 🎭 MOOD INSIGHTS
# ==========================================

@app.get("/mood-insights")
def get_mood_insights(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Mood distribution and day-of-week patterns."""
    from datetime import datetime
    from collections import Counter
    
    min_date = datetime(2026, 1, 1)
    query = db.query(Run).filter(Run.completed_at >= min_date)
    if current_user:
        query = query.filter(Run.user_id == current_user.id)
    runs = query.all()
    
    mood_runs = [r for r in runs if getattr(r, 'mood', None)]
    total_with_mood = len(mood_runs)
    
    distribution = Counter(r.mood for r in mood_runs)
    
    day_moods = {}
    for r in mood_runs:
        day_name = r.completed_at.strftime("%A")
        if day_name not in day_moods:
            day_moods[day_name] = []
        day_moods[day_name].append(r.mood)
    
    best_day = None
    if day_moods:
        day_scores = {}
        mood_values = {"great": 4, "good": 3, "easy": 2, "tough": 1}
        for day, moods in day_moods.items():
            day_scores[day] = sum(mood_values.get(m, 0) for m in moods) / len(moods)
        best_day = max(day_scores, key=day_scores.get)
    
    return {
        "total_with_mood": total_with_mood,
        "distribution": dict(distribution),
        "best_day": best_day,
    }


# ==========================================
# 📜 STREAK HISTORY
# ==========================================

@app.get("/streak-history")
def get_streak_history(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Return list of all streak periods."""
    user_id = current_user.id if current_user else None
    return crud.get_streak_history(db, user_id=user_id)


# ==========================================
# 🌸 SEASONAL MARKERS
# ==========================================

def get_season(month: int) -> str:
    if month in (3, 4, 5):
        return "spring"
    elif month in (6, 7, 8):
        return "summer"
    elif month in (9, 10, 11):
        return "fall"
    else:
        return "winter"

SEASON_EMOJI = {"spring": "🌸", "summer": "☀️", "fall": "🍂", "winter": "❄️"}
SEASON_MONTHS = {
    "spring": [3, 4, 5],
    "summer": [6, 7, 8],
    "fall": [9, 10, 11],
    "winter": [12, 1, 2],
}

@app.get("/seasonal-markers")
def get_seasonal_markers(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Detect seasonal running milestones."""
    from datetime import datetime
    
    if not current_user:
        return {"markers": []}
    
    min_date = datetime(2026, 1, 1)
    runs = db.query(Run).filter(
        Run.user_id == current_user.id,
        Run.completed_at >= min_date
    ).order_by(Run.completed_at).all()
    
    if not runs:
        return {"markers": []}
    
    markers = []
    now = datetime.now()
    current_season = get_season(now.month)
    
    seasons_with_runs = {}
    for run in runs:
        s = get_season(run.completed_at.month)
        if s not in seasons_with_runs:
            seasons_with_runs[s] = {"first_run": run.completed_at, "count": 0, "months": set()}
        seasons_with_runs[s]["count"] += 1
        seasons_with_runs[s]["months"].add(run.completed_at.month)
    
    if current_season in seasons_with_runs:
        data = seasons_with_runs[current_season]
        if data["count"] == 1 or (data["count"] > 0 and data["first_run"].date() == now.date()):
            markers.append({
                "type": "first_in_season",
                "message": f"Your first {current_season} run",
                "season": current_season,
                "emoji": SEASON_EMOJI[current_season],
            })
        
        season_months = SEASON_MONTHS[current_season]
        if len(data["months"]) == len(season_months):
            markers.append({
                "type": "survived_season",
                "message": f"You ran through all of {current_season}",
                "season": current_season,
                "emoji": SEASON_EMOJI[current_season],
            })
        
        if data["count"] >= 50:
            markers.append({
                "type": "milestone",
                "message": f"{data['count']} runs this {current_season}",
                "season": current_season,
                "emoji": SEASON_EMOJI[current_season],
            })
        elif data["count"] >= 25:
            markers.append({
                "type": "milestone",
                "message": f"{data['count']} runs this {current_season}",
                "season": current_season,
                "emoji": SEASON_EMOJI[current_season],
            })
    
    return {"markers": markers}


# ==========================================
# 👥 CIRCLE CHECK-INS
# ==========================================

@app.post("/circles/{circle_id}/checkin")
def create_circle_checkin(
    circle_id: int,
    checkin_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Submit a weekly check-in for a circle."""
    membership = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id,
        CircleMembership.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this circle")
    
    from datetime import datetime
    now = datetime.now()
    week_start, _ = crud.get_week_boundaries_for_date(now)
    
    existing = db.query(CircleCheckin).filter(
        CircleCheckin.circle_id == circle_id,
        CircleCheckin.user_id == current_user.id,
        CircleCheckin.week_start == week_start
    ).first()
    
    emoji = checkin_data.get("emoji", "👋")
    message = checkin_data.get("message", "")
    if len(message) > 100:
        message = message[:100]
    
    if existing:
        existing.emoji = emoji
        existing.message = message
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "emoji": existing.emoji, "message": existing.message, "updated": True}
    
    checkin = CircleCheckin(
        circle_id=circle_id,
        user_id=current_user.id,
        emoji=emoji,
        message=message,
        week_start=week_start
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    
    return {"id": checkin.id, "emoji": checkin.emoji, "message": checkin.message, "updated": False}


@app.get("/circles/{circle_id}/checkins")
def get_circle_checkins(
    circle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get this week's check-ins for a circle."""
    membership = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id,
        CircleMembership.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this circle")
    
    from datetime import datetime
    now = datetime.now()
    week_start, _ = crud.get_week_boundaries_for_date(now)
    
    checkins = db.query(CircleCheckin).filter(
        CircleCheckin.circle_id == circle_id,
        CircleCheckin.week_start == week_start
    ).all()
    
    result = []
    for c in checkins:
        user = db.query(User).filter(User.id == c.user_id).first()
        result.append({
            "user_id": c.user_id,
            "name": user.name if user else "Runner",
            "handle": user.handle if user else None,
            "emoji": c.emoji,
            "message": c.message,
            "is_you": c.user_id == current_user.id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    
    return result


# ==========================================
# WEEKLY REFLECTIONS
# ==========================================

@app.post("/reflections")
def save_reflection(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Save an end-of-week reflection."""
    from datetime import datetime
    now = datetime.now()
    week_start, _ = crud.get_week_boundaries_for_date(now)

    existing = db.query(WeeklyReflection).filter(
        WeeklyReflection.user_id == current_user.id,
        WeeklyReflection.week_start == week_start,
    ).first()

    reflection_text = (body.get("reflection") or "")[:200]
    mood = body.get("mood") or ""

    if existing:
        existing.reflection = reflection_text
        existing.mood = mood
        db.commit()
        return {"status": "updated"}
    else:
        r = WeeklyReflection(
            user_id=current_user.id,
            week_start=week_start,
            reflection=reflection_text,
            mood=mood,
        )
        db.add(r)
        db.commit()
        return {"status": "created"}


@app.get("/reflections/current")
def get_current_reflection(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get this week's reflection if one exists."""
    from datetime import datetime
    now = datetime.now()
    week_start, _ = crud.get_week_boundaries_for_date(now)

    existing = db.query(WeeklyReflection).filter(
        WeeklyReflection.user_id == current_user.id,
        WeeklyReflection.week_start == week_start,
    ).first()

    if existing:
        return {
            "has_reflection": True,
            "reflection": existing.reflection,
            "mood": existing.mood,
            "created_at": existing.created_at.isoformat() if existing.created_at else None,
        }
    return {"has_reflection": False}


@app.get("/reflections")
def get_all_reflections(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all reflections for the current user."""
    reflections = db.query(WeeklyReflection).filter(
        WeeklyReflection.user_id == current_user.id,
    ).order_by(WeeklyReflection.week_start.desc()).all()

    return [{
        "week_start": r.week_start.isoformat() if r.week_start else None,
        "reflection": r.reflection,
        "mood": r.mood,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in reflections]


# ==========================================
# CIRCLE FEED, PHOTOS & REACTIONS
# ==========================================

ALLOWED_REACTION_EMOJIS = ["🌿", "👋", "🌊", "☀️", "🏔️"]


def _verify_circle_membership(db: Session, circle_id: int, user_id: int):
    membership = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id,
        CircleMembership.user_id == user_id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this circle")
    return membership


def _get_reactions_for_items(db: Session, circle_id: int, target_type: str, target_ids: list, current_user_id: int):
    """Build a dict of target_id -> [{ emoji, count, reacted }]"""
    if not target_ids:
        return {}
    reactions = db.query(CircleFeedReaction).filter(
        CircleFeedReaction.circle_id == circle_id,
        CircleFeedReaction.target_type == target_type,
        CircleFeedReaction.target_id.in_(target_ids),
    ).all()
    from collections import defaultdict
    grouped = defaultdict(lambda: defaultdict(lambda: {"count": 0, "reacted": False}))
    for r in reactions:
        grouped[r.target_id][r.emoji]["count"] += 1
        if r.user_id == current_user_id:
            grouped[r.target_id][r.emoji]["reacted"] = True
    result = {}
    for tid, emojis in grouped.items():
        result[tid] = [{"emoji": e, "count": d["count"], "reacted": d["reacted"]} for e, d in emojis.items()]
    return result


@app.get("/circles/{circle_id}/feed")
def get_circle_feed(
    circle_id: int,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Activity feed for a circle: runs and check-ins merged chronologically."""
    _verify_circle_membership(db, circle_id, current_user.id)

    member_ids = [m.user_id for m in db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id
    ).all()]

    from datetime import datetime
    min_date = datetime(2026, 1, 1)

    runs = db.query(Run).filter(
        Run.user_id.in_(member_ids),
        Run.completed_at >= min_date
    ).order_by(Run.completed_at.desc()).limit(limit).all()

    checkins = db.query(CircleCheckin).filter(
        CircleCheckin.circle_id == circle_id,
    ).order_by(CircleCheckin.created_at.desc()).limit(limit).all()

    run_reactions = _get_reactions_for_items(db, circle_id, "run", [r.id for r in runs], current_user.id)
    checkin_reactions = _get_reactions_for_items(db, circle_id, "checkin", [c.id for c in checkins], current_user.id)

    user_cache = {}
    def get_user(uid):
        if uid not in user_cache:
            u = db.query(User).filter(User.id == uid).first()
            user_cache[uid] = u
        return user_cache[uid]

    feed_items = []

    for r in runs:
        u = get_user(r.user_id)
        photos = db.query(RunPhoto).filter(RunPhoto.run_id == r.id).all()
        photo_list = [{"id": p.id, "photo_data": p.photo_data[:100] + "..." if len(p.photo_data) > 100 else p.photo_data, "caption": p.caption, "distance_marker_km": p.distance_marker_km} for p in photos]
        has_photos = len(photos) > 0
        pace_sec = r.duration_seconds / r.distance_km if r.distance_km > 0 else 0
        pace_str = f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}"
        feed_items.append({
            "type": "run",
            "id": r.id,
            "user_name": u.name if u else "Runner",
            "user_handle": u.handle if u else None,
            "is_you": r.user_id == current_user.id,
            "data": {
                "distance": r.run_type.upper() if r.run_type else "",
                "distance_km": r.distance_km,
                "duration_seconds": r.duration_seconds,
                "formatted_duration": f"{r.duration_seconds // 60}:{r.duration_seconds % 60:02d}",
                "pace": pace_str,
                "category": r.category or "outdoor",
                "mood": r.mood,
                "has_photos": has_photos,
                "photo_count": len(photos),
            },
            "reactions": run_reactions.get(r.id, []),
            "created_at": r.completed_at.isoformat() if r.completed_at else None,
        })

    for c in checkins:
        u = get_user(c.user_id)
        feed_items.append({
            "type": "checkin",
            "id": c.id,
            "user_name": u.name if u else "Runner",
            "user_handle": u.handle if u else None,
            "is_you": c.user_id == current_user.id,
            "data": {
                "emoji": c.emoji,
                "message": c.message,
            },
            "reactions": checkin_reactions.get(c.id, []),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    feed_items.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return feed_items[:limit]


@app.get("/circles/{circle_id}/photos")
def get_circle_photos(
    circle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """All scenic photos from circle members' runs."""
    _verify_circle_membership(db, circle_id, current_user.id)

    member_ids = [m.user_id for m in db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id
    ).all()]

    from datetime import datetime
    min_date = datetime(2026, 1, 1)

    photos = db.query(RunPhoto).filter(
        RunPhoto.user_id.in_(member_ids),
        RunPhoto.created_at >= min_date,
    ).order_by(RunPhoto.created_at.desc()).all()

    user_cache = {}
    def get_user(uid):
        if uid not in user_cache:
            u = db.query(User).filter(User.id == uid).first()
            user_cache[uid] = u
        return user_cache[uid]

    run_cache = {}
    def get_run(rid):
        if rid not in run_cache:
            r = db.query(Run).filter(Run.id == rid).first()
            run_cache[rid] = r
        return run_cache[rid]

    result = []
    for p in photos:
        u = get_user(p.user_id)
        r = get_run(p.run_id)
        result.append({
            "id": p.id,
            "photo_data": p.photo_data,
            "caption": p.caption,
            "distance_marker_km": p.distance_marker_km,
            "user_name": u.name if u else "Runner",
            "run_distance": r.run_type.upper() if r else "",
            "run_date": r.completed_at.isoformat() if r and r.completed_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return result


@app.post("/circles/{circle_id}/feed/{item_type}/{item_id}/react")
def toggle_reaction(
    circle_id: int,
    item_type: str,
    item_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Toggle a reaction on a feed item."""
    _verify_circle_membership(db, circle_id, current_user.id)

    if item_type not in ("run", "checkin"):
        raise HTTPException(status_code=400, detail="Invalid item type")

    emoji = body.get("emoji", "")
    if emoji not in ALLOWED_REACTION_EMOJIS:
        raise HTTPException(status_code=400, detail=f"Emoji not allowed. Use one of: {ALLOWED_REACTION_EMOJIS}")

    existing = db.query(CircleFeedReaction).filter(
        CircleFeedReaction.circle_id == circle_id,
        CircleFeedReaction.user_id == current_user.id,
        CircleFeedReaction.target_type == item_type,
        CircleFeedReaction.target_id == item_id,
        CircleFeedReaction.emoji == emoji,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"status": "removed"}
    else:
        reaction = CircleFeedReaction(
            circle_id=circle_id,
            user_id=current_user.id,
            target_type=item_type,
            target_id=item_id,
            emoji=emoji,
        )
        db.add(reaction)
        db.commit()
        return {"status": "added"}


# ==========================================
# 📸 SCENIC RUNS (Photo Endpoints)
# ==========================================

@app.post("/runs/{run_id}/photos")
def upload_run_photo(
    run_id: int,
    photo_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Upload a photo tagged to a distance marker for a run."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your run")
    
    category = getattr(run, 'category', 'outdoor') or 'outdoor'
    if category != 'outdoor':
        raise HTTPException(status_code=400, detail="Scenic photos are only for outdoor runs")
    
    base64_data = photo_data.get("photo_data")
    distance_marker = photo_data.get("distance_marker_km")
    caption = photo_data.get("caption")
    
    if not base64_data:
        raise HTTPException(status_code=400, detail="photo_data is required")
    if distance_marker is None or distance_marker <= 0:
        raise HTTPException(status_code=400, detail="distance_marker_km must be positive")
    if distance_marker > run.distance_km:
        raise HTTPException(status_code=400, detail=f"Marker {distance_marker}km exceeds run distance {run.distance_km}km")
    
    photo = RunPhoto(
        run_id=run_id,
        user_id=current_user.id,
        photo_data=base64_data,
        distance_marker_km=distance_marker,
        caption=caption
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    
    return {
        "id": photo.id,
        "run_id": photo.run_id,
        "distance_marker_km": photo.distance_marker_km,
        "caption": photo.caption,
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
    }


@app.get("/runs/{run_id}/photos")
def get_run_photos(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all photos for a run, ordered by distance marker."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your run")
    
    photos = db.query(RunPhoto).filter(
        RunPhoto.run_id == run_id
    ).order_by(RunPhoto.distance_marker_km.asc()).all()
    
    return [
        {
            "id": p.id,
            "run_id": p.run_id,
            "photo_data": p.photo_data,
            "distance_marker_km": p.distance_marker_km,
            "caption": p.caption,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in photos
    ]


@app.delete("/runs/{run_id}/photos/{photo_id}")
def delete_run_photo(
    run_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a specific photo from a run."""
    photo = db.query(RunPhoto).filter(
        RunPhoto.id == photo_id,
        RunPhoto.run_id == run_id,
        RunPhoto.user_id == current_user.id
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    db.delete(photo)
    db.commit()
    return {"message": "Photo deleted"}


@app.get("/scenic-runs")
def get_scenic_runs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all outdoor runs that have photos, for the scenic gallery."""
    from sqlalchemy import func as sqlfunc
    
    photo_counts = db.query(
        RunPhoto.run_id,
        sqlfunc.count(RunPhoto.id).label("count")
    ).filter(
        RunPhoto.user_id == current_user.id
    ).group_by(RunPhoto.run_id).all()
    
    if not photo_counts:
        return []
    
    run_photo_map = {row.run_id: row.count for row in photo_counts}
    run_ids = list(run_photo_map.keys())
    
    runs = db.query(Run).filter(
        Run.id.in_(run_ids),
        Run.user_id == current_user.id
    ).order_by(Run.completed_at.desc()).all()
    
    result = []
    for run in runs:
        first_photo = db.query(RunPhoto).filter(
            RunPhoto.run_id == run.id
        ).order_by(RunPhoto.distance_marker_km.asc()).first()
        
        if run.distance_km > 0:
            spk = run.duration_seconds / run.distance_km
            pace = f"{int(spk // 60)}:{int(spk % 60):02d}"
        else:
            pace = "0:00"
        
        result.append({
            "id": run.id,
            "run_type": run.run_type,
            "distance_km": run.distance_km,
            "duration_seconds": run.duration_seconds,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "pace": pace,
            "mood": getattr(run, 'mood', None),
            "photo_count": run_photo_map.get(run.id, 0),
            "cover_photo": first_photo.photo_data if first_photo else None,
        })
    
    return result
