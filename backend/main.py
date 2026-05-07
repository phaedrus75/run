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

import os
import logging
from datetime import datetime, timedelta
from schemas import _utc_iso as _iso_utc  # tz-aware UTC ISO; see schemas.py
from fastapi import FastAPI, Depends, HTTPException, status, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import List, Optional
from pydantic import BaseModel
import json

logger = logging.getLogger(__name__)

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

def _get_real_client_ip(request: Request) -> str:
    """Extract real client IP behind Railway's reverse proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)

# 📦 Import our modules
from database import engine, get_db, Base
from models import (
    Run,
    Weight,
    User,
    UserGoals,
    StepEntry,
    PasswordResetToken,
    CircleCheckin,
    RunPhoto,
    WeeklyReflection,
    GymWorkout,
    Exercise,
    Walk,
    WalkPhoto,
    PublicWalk,
    GeocodeCache,
    NeighbourhoodSave,
    NeighbourhoodIRanThis,
    NeighbourhoodBlockedHandle,
    NeighbourhoodReport,
    RunReaction,
    CoachMessage,
    CoachRunScript,
    CoachTodayCard,
    Journey,
    JourneyDayBrief,
)
from auth import (
    UserCreate, UserLogin, UserResponse, Token,
    create_user, authenticate_user, get_user_by_email, get_user_by_id,
    create_access_token, get_current_user, require_auth
)
from schemas import (
    RunCreate,
    RunUpdate,
    RunResponse,
    StatsResponse,
    MotivationalMessage,
    WeeklyStreakProgress,
    RUN_DISTANCES,
    LEVEL_DISTANCES,
    LEVEL_MAX,
    LEVEL_ORDER,
    LEVEL_INFO,
    LEVEL_GOALS,
    CoachSettings,
    CoachOptInRequest,
    CoachNote,
    CoachTodayCardResponse,
    CoachChatTurn,
    CoachChatRequest,
    CoachChatResponse,
    CoachRunScriptLine,
    CoachRunScriptRequest,
    CoachRunScriptResponse,
    JourneyCreateRequest,
    JourneyUpdateRequest,
    JourneyResponse,
    JourneyTemplate,
    JourneyDayBriefResponse,
    JourneyPreviewRequest,
    JourneyPreviewResponse,
    JourneyScheduleRequest,
    JOURNEY_TIERS,
    JOURNEY_TIER_MAX_DAYS,
    JOURNEY_STATUSES,
)
import crud
import coach
import llm

limiter = Limiter(key_func=_get_real_client_ip)


def require_admin(user: User = Depends(require_auth)):
    if not getattr(user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==========================================
# 🚀 CREATE THE APP
# ==========================================

_is_production = os.getenv("RAILWAY_ENVIRONMENT") == "production"

app = FastAPI(
    title="🏃 ZenRun API",
    description="Track your runs, crush your goals!",
    version="1.0.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )

if _is_production:
    from fastapi.exceptions import RequestValidationError

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": "Invalid request data"},
        )

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://zenrun.co,https://www.zenrun.co,http://localhost:3000,http://localhost:8081"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

import re

def _validate_password(password: str):
    """Enforce password complexity: min 8 chars, at least one uppercase, one lowercase, one digit."""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r'[A-Z]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not re.search(r'[0-9]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")

def _sanitize_text(value: str, max_length: int = 500) -> str:
    """Strip HTML tags and enforce length limit on free-text input."""
    cleaned = re.sub(r'<[^>]+>', '', value)
    return cleaned[:max_length]


# ----- Photo thumbnail helper -------------------------------------------------
# We store full-resolution JPEGs as base64 in `photo_data`. The Album / feed
# views only need a small preview, so we generate a ~360px thumbnail at upload
# time and store it in `thumb_data`. Old rows are backfilled lazily.
_THUMB_MAX_EDGE = 360
_THUMB_QUALITY = 70

try:  # Pillow is required in production; treat missing as soft-fail in dev
    from PIL import Image as _PILImage  # type: ignore
    _PIL_AVAILABLE = True
except Exception:  # pragma: no cover - graceful fallback
    _PILImage = None  # type: ignore
    _PIL_AVAILABLE = False


def _make_thumbnail_b64(b64_full: Optional[str]) -> Optional[str]:
    """Return a small JPEG base64 thumbnail for the given full-size base64
    image, or None if Pillow is unavailable or decoding fails. Strips a leading
    ``data:image/...;base64,`` prefix if present.
    """
    if not b64_full or not _PIL_AVAILABLE:
        return None
    try:
        import base64 as _b64
        from io import BytesIO as _BytesIO
        clean = b64_full.split(",", 1)[-1] if b64_full.startswith("data:") else b64_full
        raw = _b64.b64decode(clean, validate=False)
        with _PILImage.open(_BytesIO(raw)) as im:
            im = im.convert("RGB")
            im.thumbnail((_THUMB_MAX_EDGE, _THUMB_MAX_EDGE), _PILImage.LANCZOS)
            out = _BytesIO()
            im.save(out, format="JPEG", quality=_THUMB_QUALITY, optimize=True)
            return _b64.b64encode(out.getvalue()).decode("ascii")
    except Exception as e:  # pragma: no cover
        print(f"thumbnail error: {e}")
        return None


MAX_BODY_BYTES = 12 * 1024 * 1024  # 12 MB

# Hard limit on photos per run / walk. Mirrored on the client in
# `frontend/constants/photos.ts`. Protects detail-screen response size and
# DB row scan from runaway growth. 100 is well above realistic single-walk
# usage; the median scenic walk has 3–5 photos.
MAX_PHOTOS_PER_ACTIVITY = 100

# Photo uploads send a base64-encoded JPEG inside a JSON body. A 1200px JPEG
# at quality 0.85 lands at ~530–930 KB base64; the route handler caps the
# actual `photo_data` field at 10 MB. The middleware ceiling sits just above
# that so legitimate uploads are never silently rejected at the edge.
@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"detail": "Request body too large"})
    return await call_next(request)


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
                # GPS tracking columns for outdoor runs
                for col in [
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS route_polyline TEXT",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS start_lat FLOAT",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS start_lng FLOAT",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS end_lat FLOAT",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS end_lng FLOAT",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS elevation_gain_m FLOAT",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP",
                ]:
                    conn.execute(text(col))
                # Beta feature opt-in columns
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_steps_enabled BOOLEAN DEFAULT false
                """))
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_weight_enabled BOOLEAN DEFAULT false
                """))
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false
                """))
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_hash VARCHAR
                """))
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP
                """))
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0
                """))
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_gym_enabled BOOLEAN DEFAULT false
                """))
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false
                """))

                # Walk feature tables
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS walks (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER,
                        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        ended_at TIMESTAMP,
                        duration_seconds INTEGER NOT NULL,
                        distance_km FLOAT NOT NULL,
                        route_polyline TEXT,
                        start_lat FLOAT,
                        start_lng FLOAT,
                        end_lat FLOAT,
                        end_lng FLOAT,
                        elevation_gain_m FLOAT,
                        avg_pace_seconds_per_km FLOAT,
                        notes VARCHAR,
                        mood VARCHAR,
                        category VARCHAR DEFAULT 'outdoor',
                        public_walk_id INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_walks_user_started ON walks(user_id, started_at DESC)
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS walk_photos (
                        id SERIAL PRIMARY KEY,
                        walk_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        photo_data TEXT NOT NULL,
                        lat FLOAT,
                        lng FLOAT,
                        distance_marker_km FLOAT,
                        caption VARCHAR,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_walk_photos_walk ON walk_photos(walk_id)
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS public_walks (
                        id SERIAL PRIMARY KEY,
                        osm_id VARCHAR,
                        name VARCHAR NOT NULL,
                        description TEXT,
                        distance_km FLOAT NOT NULL,
                        estimated_duration_min INTEGER,
                        difficulty VARCHAR,
                        route_polyline TEXT NOT NULL,
                        start_lat FLOAT NOT NULL,
                        start_lng FLOAT NOT NULL,
                        region VARCHAR,
                        country VARCHAR,
                        tags VARCHAR,
                        source VARCHAR,
                        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_public_walks_osm ON public_walks(osm_id)
                """))

                # Neighbourhood (users + runs + social tables)
                for stmt in [
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS neighbourhood_opt_in BOOLEAN DEFAULT false",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS home_city VARCHAR",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS home_country VARCHAR",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS home_lng DOUBLE PRECISION",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS neighbourhood_widen_radius_km INTEGER DEFAULT 0",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS zen_unlocked_at TIMESTAMP",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS zen_below_since TIMESTAMP",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS zen_celebrated_at TIMESTAMP",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS zen_demoted_at TIMESTAMP",
                ]:
                    conn.execute(text(stmt))
                for stmt in [
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS neighbourhood_visibility VARCHAR DEFAULT 'off'",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS neighbourhood_published_at TIMESTAMP",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS neighbourhood_centroid_lat DOUBLE PRECISION",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS neighbourhood_centroid_lng DOUBLE PRECISION",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS neighbourhood_city VARCHAR",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS circles_share BOOLEAN DEFAULT TRUE",
                ]:
                    conn.execute(text(stmt))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS geocode_cache (
                        id SERIAL PRIMARY KEY,
                        lat_key DOUBLE PRECISION NOT NULL,
                        lng_key DOUBLE PRECISION NOT NULL,
                        city VARCHAR NOT NULL,
                        country VARCHAR,
                        centroid_lat DOUBLE PRECISION,
                        centroid_lng DOUBLE PRECISION,
                        raw_json TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(lat_key, lng_key)
                    )
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS neighbourhood_saves (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        run_id INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, run_id)
                    )
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_neighbourhood_saves_run ON neighbourhood_saves(run_id)
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS neighbourhood_iran_this (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        run_id INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, run_id)
                    )
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_neighbourhood_iran_run ON neighbourhood_iran_this(run_id)
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS neighbourhood_blocked_handles (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        blocked_handle VARCHAR NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, blocked_handle)
                    )
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS neighbourhood_reports (
                        id SERIAL PRIMARY KEY,
                        reporter_id INTEGER NOT NULL,
                        run_id INTEGER NOT NULL,
                        reason VARCHAR,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))

                # Photo thumbnails (small base64) so the album feed doesn't have
                # to ship full-resolution JPEGs per item.
                conn.execute(text("ALTER TABLE run_photos ADD COLUMN IF NOT EXISTS thumb_data TEXT"))
                conn.execute(text("ALTER TABLE walk_photos ADD COLUMN IF NOT EXISTS thumb_data TEXT"))

                # Coach (AI companion) — opt-in flags + per-activity notes
                for stmt in [
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_enabled BOOLEAN DEFAULT false",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_consent_at TIMESTAMP",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_notes_auto BOOLEAN DEFAULT true",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_today_card BOOLEAN DEFAULT true",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_voice_during_runs VARCHAR DEFAULT 'coach_runs'",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS coach_note TEXT",
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS coach_note_generated_at TIMESTAMP",
                    "ALTER TABLE walks ADD COLUMN IF NOT EXISTS coach_note TEXT",
                    "ALTER TABLE walks ADD COLUMN IF NOT EXISTS coach_note_generated_at TIMESTAMP",
                ]:
                    conn.execute(text(stmt))

                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS coach_messages (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        role VARCHAR NOT NULL,
                        content TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_coach_messages_user_time
                        ON coach_messages(user_id, created_at DESC)
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS coach_run_scripts (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        activity VARCHAR NOT NULL,
                        target_distance_km FLOAT NOT NULL,
                        plan_summary TEXT,
                        lines_json TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_coach_run_scripts_user
                        ON coach_run_scripts(user_id, created_at DESC)
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS coach_today_cards (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        day_iso VARCHAR NOT NULL,
                        text TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, day_iso)
                    )
                """))

                # Journeys (Phase 5) — the slow ultra. 20k/30k are one-go,
                # 50k/60k/75k/100k spread across up to max_days calendar days.
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS journeys (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        name VARCHAR NOT NULL,
                        tier VARCHAR NOT NULL,
                        target_distance_km FLOAT NOT NULL,
                        max_days INTEGER NOT NULL DEFAULT 1,
                        status VARCHAR NOT NULL DEFAULT 'active',
                        plan_summary TEXT,
                        notes TEXT,
                        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        completed_at TIMESTAMP
                    )
                """))
                # If the journeys table existed before max_days was added,
                # backfill from the tier name.
                conn.execute(text(
                    "ALTER TABLE journeys ADD COLUMN IF NOT EXISTS max_days INTEGER NOT NULL DEFAULT 1"
                ))
                conn.execute(text("""
                    UPDATE journeys
                       SET max_days = CASE
                           WHEN tier IN ('50k','60k','75k','100k') THEN 3
                           ELSE 1
                       END
                     WHERE max_days IS NULL OR max_days = 0
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_journeys_user_status
                        ON journeys(user_id, status)
                """))
                # Guide reflections (Phase G): completion note + future
                # day-briefs. completion_note is single-shot; day briefs
                # land in their own table below.
                conn.execute(text(
                    "ALTER TABLE journeys ADD COLUMN IF NOT EXISTS completion_note TEXT"
                ))
                # Plan-then-start lifecycle (Phase H): planned status,
                # readiness assessment, discrete prep checklist, optional
                # scheduled date, and the activation timestamp.
                conn.execute(text(
                    "ALTER TABLE journeys ADD COLUMN IF NOT EXISTS readiness_note TEXT"
                ))
                conn.execute(text(
                    "ALTER TABLE journeys ADD COLUMN IF NOT EXISTS prep_checklist_json TEXT"
                ))
                conn.execute(text(
                    "ALTER TABLE journeys ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP"
                ))
                conn.execute(text(
                    "ALTER TABLE journeys ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP"
                ))
                conn.execute(text(
                    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS journey_id INTEGER"
                ))
                conn.execute(text(
                    "ALTER TABLE walks ADD COLUMN IF NOT EXISTS journey_id INTEGER"
                ))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_runs_journey
                        ON runs(journey_id)
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_walks_journey
                        ON walks(journey_id)
                """))

                # Per-day Guide briefs (Phase G).
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS journey_day_briefs (
                        id SERIAL PRIMARY KEY,
                        journey_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        day_index INTEGER NOT NULL,
                        text TEXT NOT NULL,
                        is_stub BOOLEAN DEFAULT FALSE,
                        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("""
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_journey_day_briefs
                        ON journey_day_briefs(journey_id, day_index)
                """))

                conn.commit()
                
                migration_email = os.getenv("MIGRATION_USER_EMAIL")
                if migration_email:
                    result = conn.execute(text("SELECT id FROM users WHERE email = :email LIMIT 1"), {"email": migration_email})
                    row = result.fetchone()
                    if row:
                        main_user_id = row[0]
                        conn.execute(text("UPDATE runs SET user_id = :uid WHERE user_id IS NULL"), {"uid": main_user_id})
                        conn.execute(text("UPDATE weights SET user_id = :uid WHERE user_id IS NULL"), {"uid": main_user_id})
                        conn.execute(text("UPDATE step_entries SET user_id = :uid WHERE user_id IS NULL"), {"uid": main_user_id})
                        conn.commit()
                
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

                def _sqlite_col(table: str, col: str, ddl: str):
                    r = conn.execute(text(f"PRAGMA table_info({table})"))
                    cols = [row[1] for row in r]
                    if col not in cols:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
                        conn.commit()
                        print(f"Migration: {col} added to {table}")

                _sqlite_col("users", "neighbourhood_opt_in", "neighbourhood_opt_in BOOLEAN DEFAULT 0")
                _sqlite_col("users", "home_city", "home_city VARCHAR")
                _sqlite_col("users", "home_country", "home_country VARCHAR")
                _sqlite_col("users", "home_lat", "home_lat FLOAT")
                _sqlite_col("users", "home_lng", "home_lng FLOAT")
                _sqlite_col("users", "neighbourhood_widen_radius_km", "neighbourhood_widen_radius_km INTEGER DEFAULT 0")
                _sqlite_col("users", "zen_unlocked_at", "zen_unlocked_at TIMESTAMP")
                _sqlite_col("users", "zen_below_since", "zen_below_since TIMESTAMP")
                _sqlite_col("users", "zen_celebrated_at", "zen_celebrated_at TIMESTAMP")
                _sqlite_col("users", "zen_demoted_at", "zen_demoted_at TIMESTAMP")
                _sqlite_col("runs", "neighbourhood_visibility", "neighbourhood_visibility VARCHAR DEFAULT 'off'")
                _sqlite_col("runs", "neighbourhood_published_at", "neighbourhood_published_at TIMESTAMP")
                _sqlite_col("runs", "neighbourhood_centroid_lat", "neighbourhood_centroid_lat FLOAT")
                _sqlite_col("runs", "neighbourhood_centroid_lng", "neighbourhood_centroid_lng FLOAT")
                _sqlite_col("runs", "neighbourhood_city", "neighbourhood_city VARCHAR")
                _sqlite_col("runs", "circles_share", "circles_share BOOLEAN DEFAULT 1")
                _sqlite_col("run_photos", "thumb_data", "thumb_data TEXT")
                _sqlite_col("walk_photos", "thumb_data", "thumb_data TEXT")

                # Coach (AI companion) — opt-in flags + per-activity notes
                _sqlite_col("users", "coach_enabled", "coach_enabled BOOLEAN DEFAULT 0")
                _sqlite_col("users", "coach_consent_at", "coach_consent_at TIMESTAMP")
                _sqlite_col("users", "coach_notes_auto", "coach_notes_auto BOOLEAN DEFAULT 1")
                _sqlite_col("users", "coach_today_card", "coach_today_card BOOLEAN DEFAULT 1")
                _sqlite_col("users", "coach_voice_during_runs", "coach_voice_during_runs VARCHAR DEFAULT 'coach_runs'")
                _sqlite_col("runs", "coach_note", "coach_note TEXT")
                _sqlite_col("runs", "coach_note_generated_at", "coach_note_generated_at TIMESTAMP")
                _sqlite_col("walks", "coach_note", "coach_note TEXT")
                _sqlite_col("walks", "coach_note_generated_at", "coach_note_generated_at TIMESTAMP")

                # Journey attribution columns (Phase 5)
                _sqlite_col("runs", "journey_id", "journey_id INTEGER")
                _sqlite_col("walks", "journey_id", "journey_id INTEGER")
                _sqlite_col("journeys", "max_days", "max_days INTEGER NOT NULL DEFAULT 1")
                _sqlite_col("journeys", "completion_note", "completion_note TEXT")
                # Plan-then-start lifecycle (Phase H)
                _sqlite_col("journeys", "readiness_note", "readiness_note TEXT")
                _sqlite_col("journeys", "prep_checklist_json", "prep_checklist_json TEXT")
                _sqlite_col("journeys", "scheduled_for", "scheduled_for TIMESTAMP")
                _sqlite_col("journeys", "activated_at", "activated_at TIMESTAMP")

                # SQLAlchemy create_all() at the end of run_migrations() will
                # create the coach_messages / coach_run_scripts /
                # coach_today_cards / journeys tables in SQLite via the model
                # definitions.
        except Exception as e:
            print(f"Migration note: {e}")
    
    # Now ensure all tables exist (including user_goals)
    print("Ensuring all tables exist...")
    Base.metadata.create_all(bind=engine)
    print("All tables created/verified")

run_migrations()

# Seed built-in exercises into the catalog
_seed_db = next(get_db())
try:
    crud.seed_builtin_exercises(_seed_db)
finally:
    _seed_db.close()


# ==========================================
# 🏠 HOME ENDPOINT
# ==========================================

@app.get("/")
def read_root():
    """Health check endpoint."""
    return {
        "message": "🏃 Welcome to ZenRun API!",
        "health": "OK"
    }


# ==========================================
# 🔐 AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/auth/signup", response_model=Token)
@limiter.limit("5/minute")
def signup(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """
    📝 Create a new user account
    
    Returns a JWT token on successful registration.
    """
    existing_user = get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create account with this email"
        )
    
    _validate_password(user_data.password)
    
    if user_data.name:
        user_data.name = _sanitize_text(user_data.name, max_length=100)
    
    user = create_user(db, user_data)
    
    # Send verification code (fire-and-forget, don't block signup)
    try:
        import random
        from datetime import datetime, timedelta
        from auth import get_password_hash
        from email_service import send_verification_email
        
        code = str(random.randint(100000, 999999))
        user.verification_code_hash = get_password_hash(code)
        user.verification_code_expires = datetime.utcnow() + timedelta(minutes=10)
        db.commit()
        send_verification_email(user.email, code)
    except Exception:
        pass

    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }


@app.post("/auth/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, credentials: UserLogin, db: Session = Depends(get_db)):
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
        
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.model_validate(user)
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Login failed. Please try again.")


class ForgotPasswordRequest(BaseModel):
    email: str

@app.post("/auth/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    🔐 Request a password reset code

    Generates a 6-digit code that expires in 15 minutes.
    Sends the code via email using Resend.
    """
    email = body.email
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

    from auth import get_password_hash
    reset_token = PasswordResetToken(
        user_id=user.id,
        email=email,
        reset_code=get_password_hash(reset_code),
        expires_at=expires_at
    )
    db.add(reset_token)
    db.commit()

    send_password_reset(email, reset_code)

    return {"message": "If an account exists with this email, a reset code has been sent"}


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

@app.post("/auth/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    🔐 Reset password using the code from forgot-password
    
    Requires the 6-digit code and new password.
    """
    email = body.email
    code = body.code
    new_password = body.new_password
    from datetime import datetime
    from auth import verify_password
    
    candidates = db.query(PasswordResetToken).filter(
        PasswordResetToken.email == email,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).all()
    
    token = None
    for candidate in candidates:
        if verify_password(code, candidate.reset_code):
            token = candidate
            break
    
    if not token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset code"
        )
    
    user = db.query(User).filter(User.id == token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    _validate_password(new_password)
    
    from auth import get_password_hash
    user.hashed_password = get_password_hash(new_password)
    
    token.used = True
    db.commit()
    
    return {"message": "Password reset successfully"}



@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(require_auth)):
    """
    👤 Get current user info
    
    Requires authentication.
    """
    return UserResponse.model_validate(current_user)


@app.post("/auth/send-verification")
@limiter.limit("3/minute")
def send_verification(request: Request, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Send (or resend) an email verification code to the current user."""
    import random
    from datetime import datetime, timedelta
    from auth import get_password_hash
    from email_service import send_verification_email

    if getattr(current_user, 'email_verified', False):
        return {"message": "Email already verified"}

    code = str(random.randint(100000, 999999))
    current_user.verification_code_hash = get_password_hash(code)
    current_user.verification_code_expires = datetime.utcnow() + timedelta(minutes=10)
    current_user.verification_attempts = 0
    db.commit()

    send_verification_email(current_user.email, code)
    return {"message": "Verification code sent"}


class VerifyEmailRequest(BaseModel):
    code: str

@app.post("/auth/verify-email")
@limiter.limit("5/minute")
def verify_email(request: Request, body: VerifyEmailRequest, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Verify the current user's email with a 6-digit code."""
    from datetime import datetime
    from auth import verify_password

    if getattr(current_user, 'email_verified', False):
        return {"message": "Email already verified", "verified": True}

    code_hash = getattr(current_user, 'verification_code_hash', None)
    code_expires = getattr(current_user, 'verification_code_expires', None)

    if not code_hash or not code_expires:
        raise HTTPException(status_code=400, detail="No verification code found. Request a new one.")

    if datetime.utcnow() > code_expires:
        raise HTTPException(status_code=400, detail="Verification code has expired. Request a new one.")

    attempts = getattr(current_user, 'verification_attempts', 0) or 0
    if attempts >= 5:
        current_user.verification_code_hash = None
        current_user.verification_code_expires = None
        current_user.verification_attempts = 0
        db.commit()
        raise HTTPException(status_code=400, detail="Too many attempts. Request a new verification code.")

    if not verify_password(body.code, code_hash):
        current_user.verification_attempts = attempts + 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code")

    current_user.email_verified = True
    current_user.verification_code_hash = None
    current_user.verification_code_expires = None
    current_user.verification_attempts = 0
    db.commit()

    return {"message": "Email verified successfully", "verified": True}


@app.delete("/auth/delete-account")
@limiter.limit("3/minute")
def delete_account(request: Request, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """
    Permanently delete the current user's account and all associated data.
    This action is irreversible.
    """
    from models import (
        Circle, CircleMembership, CircleFeedReaction,
    )

    user_id = current_user.id

    try:
        db.query(RunPhoto).filter(RunPhoto.user_id == user_id).delete()
        db.query(CircleFeedReaction).filter(CircleFeedReaction.user_id == user_id).delete()
        db.query(CircleCheckin).filter(CircleCheckin.user_id == user_id).delete()
        db.query(CircleMembership).filter(CircleMembership.user_id == user_id).delete()
        db.query(WeeklyReflection).filter(WeeklyReflection.user_id == user_id).delete()
        db.query(Run).filter(Run.user_id == user_id).delete()
        db.query(Weight).filter(Weight.user_id == user_id).delete()
        db.query(StepEntry).filter(StepEntry.user_id == user_id).delete()
        db.query(UserGoals).filter(UserGoals.user_id == user_id).delete()
        db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete()
        db.query(GymWorkout).filter(GymWorkout.user_id == user_id).delete()

        owned_circles = db.query(Circle).filter(Circle.created_by == user_id).all()
        for circle in owned_circles:
            remaining = db.query(CircleMembership).filter(
                CircleMembership.circle_id == circle.id
            ).count()
            if remaining == 0:
                db.delete(circle)
            else:
                new_owner = db.query(CircleMembership).filter(
                    CircleMembership.circle_id == circle.id
                ).first()
                circle.created_by = new_owner.user_id if new_owner else None

        db.delete(current_user)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"DELETE ACCOUNT ERROR for user {user_id}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")

    return {"message": "Account and all associated data have been permanently deleted"}


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
        raise HTTPException(status_code=500, detail="Failed to save goals. Please try again.")


@app.post("/user/complete-onboarding")
def complete_onboarding(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """
    ✅ Mark onboarding as complete
    """
    current_user.onboarding_complete = True
    db.commit()
    return {"message": "Onboarding complete", "onboarding_complete": True}


# ==========================================
# 🧪 BETA PREFERENCES ENDPOINTS
# ==========================================

@app.get("/user/beta-preferences")
def get_beta_preferences(current_user: User = Depends(require_auth)):
    return {
        "steps_enabled": getattr(current_user, 'beta_steps_enabled', False) or False,
        "weight_enabled": getattr(current_user, 'beta_weight_enabled', False) or False,
        "gym_enabled": getattr(current_user, 'beta_gym_enabled', False) or False,
    }

@app.post("/user/beta-preferences")
def set_beta_preferences(data: dict, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    if "steps_enabled" in data:
        current_user.beta_steps_enabled = bool(data["steps_enabled"])
    if "weight_enabled" in data:
        current_user.beta_weight_enabled = bool(data["weight_enabled"])
    if "gym_enabled" in data:
        current_user.beta_gym_enabled = bool(data["gym_enabled"])
    db.commit()
    return {
        "steps_enabled": current_user.beta_steps_enabled or False,
        "weight_enabled": current_user.beta_weight_enabled or False,
        "gym_enabled": getattr(current_user, 'beta_gym_enabled', False) or False,
    }


# ==========================================
# 🏃 RUNNER LEVEL ENDPOINTS
# ==========================================

@app.get("/user/level")
def get_user_level(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Get the user's runner level, available distances, and upgrade eligibility."""
    level = getattr(current_user, 'runner_level', None) or 'breath'
    if not current_user.runner_level:
        current_user.runner_level = level
        db.commit()
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

    # Zen is gated: must have been auto-unlocked by hitting 1000km in a
    # calendar year. Manual selection is otherwise blocked.
    if new_level == 'zen' and current_user.zen_unlocked_at is None:
        raise HTTPException(
            status_code=403,
            detail="Zen tier is locked. Reach 1000 km in a calendar year to unlock it.",
        )

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


# ---------------------------------------------------------------------------
# Zen tier (auto-promoted, rolling-maintained)
# ---------------------------------------------------------------------------

ZEN_THRESHOLD_KM = 1000.0
ZEN_GRACE_DAYS = 30


def _compute_zen_status(db: Session, current_user: User) -> dict:
    """Compute and persist the user's Zen-tier status.

    First-time unlock requires hitting 1000 km within the current calendar
    year (Jan 1 -> now). Once unlocked, maintenance is judged on a rolling
    365-day window. Falling under 1000 km starts a 30-day grace period;
    after that the user is auto-demoted to Flow.
    """
    from datetime import datetime, timedelta
    now = datetime.now()
    year_start = datetime(now.year, 1, 1)
    rolling_start = now - timedelta(days=365)
    min_date = datetime(2026, 1, 1)

    year_floor = max(year_start, min_date)
    rolling_floor = max(rolling_start, min_date)

    year_km = db.query(func.coalesce(func.sum(Run.distance_km), 0.0)).filter(
        Run.user_id == current_user.id,
        Run.completed_at >= year_floor,
    ).scalar() or 0.0

    rolling_km = db.query(func.coalesce(func.sum(Run.distance_km), 0.0)).filter(
        Run.user_id == current_user.id,
        Run.completed_at >= rolling_floor,
    ).scalar() or 0.0

    year_km = float(year_km)
    rolling_km = float(rolling_km)

    just_unlocked = False
    state_changed = False

    # Backfill: existing accounts that were already on Zen prior to this
    # tracking landing. Treat them as "earned + already celebrated" so we
    # don't pop a celebration on first refresh.
    if current_user.zen_unlocked_at is None and current_user.runner_level == 'zen':
        current_user.zen_unlocked_at = now
        current_user.zen_celebrated_at = now
        state_changed = True

    if current_user.zen_unlocked_at is None:
        # First-time unlock: calendar-year threshold.
        if year_km >= ZEN_THRESHOLD_KM:
            current_user.zen_unlocked_at = now
            current_user.runner_level = 'zen'
            current_user.zen_below_since = None
            level_goals = LEVEL_GOALS.get('zen', LEVEL_GOALS['flow'])
            goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
            if not goals:
                goals = UserGoals(user_id=current_user.id)
                db.add(goals)
            goals.yearly_km_goal = level_goals['yearly_km']
            goals.monthly_km_goal = level_goals['monthly_km']
            just_unlocked = True
            state_changed = True
    else:
        # Already unlocked once -> evaluate maintenance on rolling 365d.
        if rolling_km >= ZEN_THRESHOLD_KM:
            if current_user.zen_below_since is not None:
                current_user.zen_below_since = None
                state_changed = True
        else:
            if current_user.zen_below_since is None:
                current_user.zen_below_since = now
                state_changed = True
            days_below = (now - current_user.zen_below_since).days
            if days_below >= ZEN_GRACE_DAYS and current_user.runner_level == 'zen':
                current_user.runner_level = 'flow'
                current_user.zen_demoted_at = now
                current_user.zen_below_since = None
                level_goals = LEVEL_GOALS.get('flow', LEVEL_GOALS['flow'])
                goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
                if goals:
                    goals.yearly_km_goal = level_goals['yearly_km']
                    goals.monthly_km_goal = level_goals['monthly_km']
                state_changed = True

    if state_changed:
        db.commit()
        db.refresh(current_user)

    unlocked = current_user.zen_unlocked_at is not None
    if not unlocked:
        status = 'locked'
        grace_days_remaining = None
    elif rolling_km >= ZEN_THRESHOLD_KM:
        status = 'active'
        grace_days_remaining = None
    else:
        if current_user.zen_below_since is not None:
            elapsed = (now - current_user.zen_below_since).days
            grace_days_remaining = max(0, ZEN_GRACE_DAYS - elapsed)
        else:
            grace_days_remaining = ZEN_GRACE_DAYS
        status = 'grace' if current_user.runner_level == 'zen' else 'expired'

    return {
        'unlocked': unlocked,
        'just_unlocked': just_unlocked,
        'celebrated': current_user.zen_celebrated_at is not None,
        'status': status,
        'level': current_user.runner_level,
        'year_km': round(year_km, 1),
        'year_threshold_km': ZEN_THRESHOLD_KM,
        'rolling_km': round(rolling_km, 1),
        'rolling_threshold_km': ZEN_THRESHOLD_KM,
        'grace_days_remaining': grace_days_remaining,
        'unlocked_at': current_user.zen_unlocked_at.isoformat() if current_user.zen_unlocked_at else None,
    }


@app.get("/user/zen-status")
def get_zen_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return the user's current Zen-tier status, running unlock/maintain checks."""
    return _compute_zen_status(db, current_user)


@app.post("/user/zen/celebrated")
def mark_zen_celebrated(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Mark the one-time Zen unlock celebration as seen."""
    from datetime import datetime
    if current_user.zen_unlocked_at is None:
        raise HTTPException(status_code=400, detail="Zen not unlocked yet")
    if current_user.zen_celebrated_at is None:
        current_user.zen_celebrated_at = datetime.now()
        db.commit()
    return {"celebrated": True}


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
    current_user: User = Depends(require_auth)
):
    """
    ✨ Create a new run (requires authentication)
    """
    if run.run_type not in RUN_DISTANCES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid run type. Must be one of: {list(RUN_DISTANCES.keys())}"
        )
    
    if run.notes:
        run.notes = _sanitize_text(run.notes, max_length=500)
    if hasattr(run, 'mood') and run.mood:
        run.mood = _sanitize_text(run.mood, max_length=50)
    if hasattr(run, 'category') and run.category:
        run.category = _sanitize_text(run.category, max_length=50)
    
    db_run = crud.create_run(db=db, run=run, user_id=current_user.id)

    # 🌅 Journey auto-attribution: if the user has an active Journey AND
    # we're still inside its max_days window, count this run toward it.
    # Auto-completes the journey if the running total crosses the target.
    _attach_to_active_journey(db, current_user.id, db_run)

    # 🎉 Check for all celebrations!
    celebrations = check_all_celebrations(db, db_run, current_user)
    
    # Legacy PR check for backwards compatibility
    is_pr = any(c["type"] == "personal_best" for c in celebrations)
    pr_type = next((c["type"] for c in celebrations if c["type"] == "personal_best"), None)
    
    milestones = _milestone_unlocks_after_activity(db, current_user)
    return format_run_response(
        db_run,
        is_personal_best=is_pr,
        pr_type=pr_type,
        celebrations=celebrations,
        db=db,
        milestone_unlocks=milestones,
    )


@app.get("/runs", response_model=List[RunResponse])
def get_runs(
    skip: int = 0,
    limit: int = 100,
    run_type: str = None,
    category: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """📖 Get all runs for the current authenticated user."""
    runs = crud.get_runs(db, skip=skip, limit=limit, run_type=run_type, user_id=current_user.id, category=category)
    if not runs:
        return []
    # Batch photo counts in a single query instead of N+1
    run_ids = [r.id for r in runs]
    photo_counts = dict(
        db.query(RunPhoto.run_id, func.count(RunPhoto.id))
        .filter(RunPhoto.run_id.in_(run_ids))
        .group_by(RunPhoto.run_id)
        .all()
    )
    return [format_run_response(run, photo_count_override=photo_counts.get(run.id, 0)) for run in runs]


@app.get("/runs/{run_id}", response_model=RunResponse)
def get_run(run_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_auth)):
    """🔍 Get a specific run by ID (must belong to current user)."""
    run = crud.get_run(db, run_id=run_id)
    if run is None or run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    return format_run_response(run, db=db)


@app.put("/runs/{run_id}", response_model=RunResponse)
def update_run(run_id: int, run_update: RunUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_auth)):
    """✏️ Update an existing run (must belong to current user)."""
    existing = crud.get_run(db, run_id=run_id)
    if not existing or existing.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if run_update.run_type and run_update.run_type not in RUN_DISTANCES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid run type. Must be one of: {list(RUN_DISTANCES.keys())}"
        )
    
    if run_update.notes:
        run_update.notes = _sanitize_text(run_update.notes, max_length=500)
    if run_update.mood:
        run_update.mood = _sanitize_text(run_update.mood, max_length=50)
    if run_update.category:
        run_update.category = _sanitize_text(run_update.category, max_length=50)
    
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
def delete_run(run_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_auth)):
    """🗑️ Delete a run (must belong to current user)."""
    existing = crud.get_run(db, run_id=run_id)
    if not existing or existing.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    success = crud.delete_run(db, run_id=run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"message": "Run deleted successfully"}


# ==========================================
# 📊 STATS ENDPOINTS
# ==========================================

@app.get("/stats", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """📊 Get your running statistics (requires auth)."""
    return crud.get_stats_summary(db, user_id=current_user.id)


@app.get("/motivation", response_model=MotivationalMessage)
def get_motivation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """🎉 Get a motivational message (requires auth)."""
    return crud.get_motivational_message(db, user_id=current_user.id)


@app.get("/streak", response_model=WeeklyStreakProgress)
def get_streak_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """🔥 Get weekly streak progress (requires auth)."""
    first_run = crud.get_first_run_date(db, current_user.id)
    return crud.get_weekly_streak_progress(db, user_id=current_user.id, joined_at=first_run or current_user.created_at)


# ==========================================
# 🏆 ACHIEVEMENTS & GOALS ENDPOINTS
# ==========================================

@app.get("/personal-records")
def get_personal_records(
    category: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """🏆 Get personal records (requires auth)."""
    from achievements import get_personal_records
    return get_personal_records(db, user_id=current_user.id, category=category)


@app.get("/goals")
def get_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """🎯 Get progress toward yearly and monthly goals (requires auth)."""
    from achievements import get_goals_progress
    
    user_id = current_user.id
    level = getattr(current_user, 'runner_level', 'breath') or 'breath'
    level_defaults = LEVEL_GOALS.get(level, LEVEL_GOALS['breath'])
    yearly_goal = level_defaults["yearly_km"]
    monthly_goal = level_defaults["monthly_km"]
    
    user_goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
    if user_goals:
        yearly_goal = user_goals.yearly_km_goal or yearly_goal
        monthly_goal = user_goals.monthly_km_goal or monthly_goal
    
    first_run = crud.get_first_run_date(db, user_id)
    return get_goals_progress(db, yearly_goal=yearly_goal, monthly_goal=monthly_goal, user_id=user_id, joined_at=first_run or current_user.created_at)


@app.get("/achievements")
def get_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """🎖️ Get all achievements (requires auth)."""
    from achievements import get_achievements
    stats = crud.get_stats_summary(db, user_id=current_user.id)

    level = getattr(current_user, 'runner_level', 'breath') or 'breath'
    level_defaults = LEVEL_GOALS.get(level, LEVEL_GOALS['breath'])
    yearly_goal = level_defaults["yearly_km"]
    monthly_goal = level_defaults["monthly_km"]
    user_goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
    if user_goals:
        yearly_goal = user_goals.yearly_km_goal or yearly_goal
        monthly_goal = user_goals.monthly_km_goal or monthly_goal

    return get_achievements(db, stats, user_id=current_user.id, yearly_goal=yearly_goal, monthly_goal=monthly_goal)


@app.get("/month-review")
def get_month_review(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """📅 Get month in review data (requires auth)."""
    return crud.get_month_in_review(db, user_id=current_user.id, target_month=month, target_year=year)


# ==========================================
# ⚖️ WEIGHT TRACKING ENDPOINTS
# ==========================================

@app.post("/weights")
def create_weight(
    weight_data: dict, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """⚖️ Log a new weight entry (requires auth)."""
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
    
    notes = weight_data.get("notes")
    if notes:
        notes = _sanitize_text(notes, max_length=200)
    
    entry = create_weight_entry(
        db,
        weight_lbs=weight_lbs,
        recorded_at=recorded_at,
        notes=notes,
        user_id=current_user.id
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
    current_user: User = Depends(require_auth)
):
    """📋 Get weight entries for current user (requires auth)."""
    from weight import get_all_weights
    weights = get_all_weights(db, limit=limit, user_id=current_user.id)
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
def delete_weight(weight_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_auth)):
    """🗑️ Delete a weight entry (must belong to current user)."""
    entry = db.query(Weight).filter(Weight.id == weight_id).first()
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Weight entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Weight entry deleted"}


@app.get("/weight-progress")
def get_weight_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """📊 Get weight progress toward goal (requires auth)."""
    from weight import get_weight_progress
    return get_weight_progress(db, user_id=current_user.id)


@app.get("/weight-chart")
def get_weight_chart(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """📈 Get weight data for charting (requires auth)."""
    from weight import get_weight_chart_data
    return get_weight_chart_data(db, user_id=current_user.id)


# ==========================================
# 🏋️ GYM / STRENGTH TRAINING ENDPOINTS
# ==========================================

@app.post("/gym/workouts")
def log_gym_workout(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    exercises = data.get("exercises", [])
    if not exercises:
        raise HTTPException(status_code=400, detail="exercises list is required")
    notes = data.get("notes")
    duration_minutes = data.get("duration_minutes")
    workout = crud.create_gym_workout(db, user_id=current_user.id, exercises=exercises, notes=notes, duration_minutes=duration_minutes)
    return {
        "id": workout.id,
        "completed_at": _iso_utc(workout.completed_at),
        "exercises": json.loads(workout.exercises),
        "notes": workout.notes,
        "duration_minutes": workout.duration_minutes,
    }


@app.get("/gym/workouts")
def list_gym_workouts(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    workouts = crud.get_gym_workouts(db, user_id=current_user.id, limit=limit, offset=offset)
    return [
        {
            "id": w.id,
            "completed_at": _iso_utc(w.completed_at),
            "exercises": json.loads(w.exercises) if w.exercises else [],
            "notes": w.notes,
            "duration_minutes": w.duration_minutes,
        }
        for w in workouts
    ]


@app.put("/gym/workouts/{workout_id}")
def update_gym_workout(
    workout_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    workout = crud.update_gym_workout(
        db,
        workout_id=workout_id,
        user_id=current_user.id,
        exercises=data.get("exercises"),
        notes=data.get("notes"),
        duration_minutes=data.get("duration_minutes"),
    )
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {
        "id": workout.id,
        "completed_at": _iso_utc(workout.completed_at),
        "exercises": json.loads(workout.exercises),
        "notes": workout.notes,
        "duration_minutes": workout.duration_minutes,
    }


@app.delete("/gym/workouts/{workout_id}")
def delete_gym_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    deleted = crud.delete_gym_workout(db, workout_id=workout_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"detail": "Workout deleted"}


@app.get("/gym/program")
def get_gym_program(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    working_weights = crud.get_gym_working_weights(db, user_id=current_user.id)
    program = []
    for ex in crud.GYM_PROGRAM:
        program.append({
            "name": ex["name"],
            "sets": ex["sets"],
            "reps": ex["reps"],
            "weight_kg": working_weights.get(ex["name"], ex["default_weight_kg"]),
            "machine": ex["machine"],
            "increment_kg": ex["increment_kg"],
            "is_timed": ex.get("is_timed", False),
        })
    return {"exercises": program}


@app.get("/gym/exercises")
def list_exercises(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    exercises = crud.get_exercises(db, user_id=current_user.id)
    working_weights = crud.get_gym_working_weights(db, user_id=current_user.id)
    return [
        {
            "id": ex.id,
            "name": ex.name,
            "muscle_group": ex.muscle_group,
            "equipment": ex.equipment,
            "default_weight_kg": ex.default_weight_kg,
            "weight_kg": working_weights.get(ex.name, ex.default_weight_kg),
            "increment_kg": ex.increment_kg,
            "default_sets": ex.default_sets,
            "default_reps": ex.default_reps,
            "is_timed": ex.is_timed,
            "is_custom": ex.user_id is not None,
        }
        for ex in exercises
    ]


@app.post("/gym/exercises")
def create_exercise(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    try:
        ex = crud.create_exercise(
            db,
            user_id=current_user.id,
            name=name,
            muscle_group=data.get("muscle_group", "other"),
            equipment=data.get("equipment"),
            default_weight_kg=data.get("default_weight_kg", 0),
            increment_kg=data.get("increment_kg", 2.5),
            default_sets=data.get("default_sets", 3),
            default_reps=data.get("default_reps", 10),
            is_timed=data.get("is_timed", False),
        )
    except Exception:
        raise HTTPException(status_code=409, detail="Exercise with this name already exists")
    return {
        "id": ex.id,
        "name": ex.name,
        "muscle_group": ex.muscle_group,
        "equipment": ex.equipment,
        "default_weight_kg": ex.default_weight_kg,
        "weight_kg": ex.default_weight_kg,
        "increment_kg": ex.increment_kg,
        "default_sets": ex.default_sets,
        "default_reps": ex.default_reps,
        "is_timed": ex.is_timed,
        "is_custom": True,
    }


@app.delete("/gym/exercises/{exercise_id}")
def delete_exercise_endpoint(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    deleted = crud.delete_exercise(db, exercise_id=exercise_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Exercise not found or cannot be deleted")
    return {"detail": "Exercise deleted"}


@app.get("/gym/stats")
def get_gym_stats_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    return crud.get_gym_stats(db, user_id=current_user.id)


# ==========================================
# 👟 STEPS TRACKING ENDPOINTS
# ==========================================

@app.post("/steps")
def create_step_entry(
    step_data: dict, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """👟 Log a step count for a day (requires auth)."""
    from datetime import datetime
    
    step_count = step_data.get("step_count")
    if not step_count or step_count <= 0:
        raise HTTPException(status_code=400, detail="Step count must be a positive number")
    
    recorded_date = None
    if step_data.get("recorded_date"):
        try:
            recorded_date = datetime.fromisoformat(step_data["recorded_date"].replace("Z", "+00:00"))
        except:
            recorded_date = datetime.now()
    else:
        recorded_date = datetime.now()
    
    step_notes = step_data.get("notes")
    if step_notes:
        step_notes = _sanitize_text(step_notes, max_length=200)
    
    entry = StepEntry(
        step_count=step_count,
        recorded_date=recorded_date,
        notes=step_notes,
        user_id=current_user.id
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    # 🎉 Check for high step day celebration
    celebrations = []
    if step_count >= 30000:
        celebrations.append({
            "type": "high_steps",
            "title": "🏔️ 30K+ Steps!",
            "message": "Legendary day! Absolutely incredible!"
        })
    elif step_count >= 25000:
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
    current_user: User = Depends(require_auth)
):
    """📋 Get step entries for current user (requires auth)."""
    entries = db.query(StepEntry).filter(
        StepEntry.user_id == current_user.id
    ).order_by(StepEntry.recorded_date.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "step_count": e.step_count,
            "recorded_date": e.recorded_date.isoformat(),
            "notes": e.notes,
        }
        for e in entries
    ]


@app.put("/steps/{entry_id}")
def update_step_entry(entry_id: int, step_data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_auth)):
    """✏️ Update a step entry (must belong to current user)."""
    from datetime import datetime

    entry = db.query(StepEntry).filter(StepEntry.id == entry_id).first()
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Step entry not found")

    if "step_count" in step_data:
        sc = step_data["step_count"]
        if not sc or sc <= 0:
            raise HTTPException(status_code=400, detail="Step count must be a positive number")
        entry.step_count = sc

    if "recorded_date" in step_data and step_data["recorded_date"]:
        try:
            entry.recorded_date = datetime.fromisoformat(step_data["recorded_date"].replace("Z", "+00:00"))
        except:
            pass

    if "notes" in step_data:
        entry.notes = _sanitize_text(step_data["notes"], max_length=200) if step_data["notes"] else None

    db.commit()
    db.refresh(entry)
    return {
        "id": entry.id,
        "step_count": entry.step_count,
        "recorded_date": entry.recorded_date.isoformat(),
        "notes": entry.notes,
    }


@app.delete("/steps/{entry_id}")
def delete_step_entry(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_auth)):
    """🗑️ Delete a step entry (must belong to current user)."""
    entry = db.query(StepEntry).filter(StepEntry.id == entry_id).first()
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Step entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Step entry deleted"}


@app.get("/steps/summary")
def get_steps_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """📊 Get monthly high step day counts (requires auth)."""
    from datetime import datetime
    from sqlalchemy import extract
    
    query = db.query(StepEntry).filter(
        StepEntry.recorded_date >= datetime(2026, 1, 1),
        StepEntry.user_id == current_user.id
    )
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
                "days_30k": 0,
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
        if entry.step_count >= 30000:
            data["days_30k"] += 1
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
        "days_30k": 0,
        "highest": 0,
    })
    
    # Calculate all-time totals
    all_15k = sum(m["days_15k"] for m in monthly_data.values())
    all_20k = sum(m["days_20k"] for m in monthly_data.values())
    all_25k = sum(m["days_25k"] for m in monthly_data.values())
    all_30k = sum(m["days_30k"] for m in monthly_data.values())
    
    return {
        "current_month": current_data,
        "monthly_history": [monthly_data[k] for k in sorted(monthly_data.keys())],
        "all_time": {
            "days_15k": all_15k,
            "days_20k": all_20k,
            "days_25k": all_25k,
            "days_30k": all_30k,
            "total_entries": len(entries),
        }
    }


# ==========================================
# 🛠️ HELPER FUNCTIONS
# ==========================================

def _milestone_unlocks_after_activity(db: Session, current_user: User) -> list:
    """Recompute achievements after a run/walk write; return badges that just unlocked."""
    from achievements import get_achievements

    stats = crud.get_stats_summary(db, user_id=current_user.id)
    level = getattr(current_user, "runner_level", "breath") or "breath"
    level_defaults = LEVEL_GOALS.get(level, LEVEL_GOALS["breath"])
    yearly_goal = level_defaults["yearly_km"]
    monthly_goal = level_defaults["monthly_km"]
    user_goals = db.query(UserGoals).filter(UserGoals.user_id == current_user.id).first()
    if user_goals:
        yearly_goal = user_goals.yearly_km_goal or yearly_goal
        monthly_goal = user_goals.monthly_km_goal or monthly_goal
    data = get_achievements(
        db,
        stats,
        user_id=current_user.id,
        yearly_goal=yearly_goal,
        monthly_goal=monthly_goal,
        return_new_unlocks=True,
    )
    return list(data.get("new_unlocks") or [])


def format_run_response(
    run: Run,
    is_personal_best: bool = False,
    pr_type: str = None,
    celebrations: list = None,
    db: Session = None,
    photo_count_override: int = None,
    milestone_unlocks: list = None,
) -> dict:
    """
    Format a Run object for the API response.

    Adds calculated fields like pace and formatted duration.
    Pass photo_count_override to avoid an extra DB query when you already have the count.
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
    
    if photo_count_override is not None:
        photo_count = photo_count_override
    elif db:
        photo_count = db.query(RunPhoto).filter(RunPhoto.run_id == run.id).count()
    else:
        photo_count = 0
    
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
        "milestone_unlocks": milestone_unlocks or [],
        "photo_count": photo_count,
        "route_polyline": getattr(run, "route_polyline", None),
        "start_lat": getattr(run, "start_lat", None),
        "start_lng": getattr(run, "start_lng", None),
        "end_lat": getattr(run, "end_lat", None),
        "end_lng": getattr(run, "end_lng", None),
        "elevation_gain_m": getattr(run, "elevation_gain_m", None),
        "started_at": getattr(run, "started_at", None),
        "neighbourhood_visibility": getattr(run, "neighbourhood_visibility", None) or "off",
        "neighbourhood_published_at": getattr(run, "neighbourhood_published_at", None),
        # Default True for legacy rows where the column hasn't been touched.
        "circles_share": True if getattr(run, "circles_share", None) is None else bool(run.circles_share),
    }


def _run_centroid_lat_lng(run: Run):
    """Approximate route centre for neighbourhood distance / widen filter."""
    from services.overpass import decode_polyline

    poly = getattr(run, "route_polyline", None) or None
    if poly:
        pts = decode_polyline(poly)
        if pts:
            return (
                sum(p[0] for p in pts) / len(pts),
                sum(p[1] for p in pts) / len(pts),
            )
    slat, slng = getattr(run, "start_lat", None), getattr(run, "start_lng", None)
    if slat is not None and slng is not None:
        return float(slat), float(slng)
    elat, elng = getattr(run, "end_lat", None), getattr(run, "end_lng", None)
    if elat is not None and elng is not None:
        return float(elat), float(elng)
    return None, None


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
    name = _sanitize_text(name, max_length=50)
    
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
    week_start, _ = crud.get_week_boundaries_for_date(now)

    members = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            user_runs = db.query(Run).filter(
                Run.user_id == user.id,
                Run.completed_at >= min_date
            ).all()

            monthly_runs = [r for r in user_runs if r.completed_at >= month_start]
            weekly_runs = [r for r in user_runs if r.completed_at >= week_start]

            total_km = sum(r.distance_km for r in user_runs)
            monthly_km = sum(r.distance_km for r in monthly_runs)
            weekly_km = sum(r.distance_km for r in weekly_runs)

            members.append({
                "user_id": user.id,
                "name": user.name or "Runner",
                "handle": user.handle,
                "total_runs": len(user_runs),
                "total_km": round(total_km, 1),
                "monthly_km": round(monthly_km, 1),
                "monthly_runs": len(monthly_runs),
                "weekly_km": round(weekly_km, 1),
                "weekly_runs": len(weekly_runs),
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
        "runner_level": getattr(current_user, 'runner_level', 'breath') or 'breath',
        "profile_privacy": getattr(current_user, 'profile_privacy', 'private') or 'private',
        "beta_steps_enabled": getattr(current_user, 'beta_steps_enabled', False) or False,
        "beta_weight_enabled": getattr(current_user, 'beta_weight_enabled', False) or False,
        "is_admin": getattr(current_user, 'is_admin', False) or False,
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
# 🌳 NEIGHBOURHOOD
# ==========================================

ALLOWED_WIDEN_KM = (0, 25, 50, 100)


@app.get("/me/neighbourhood")
@app.get("/me/neighborhood", include_in_schema=False)
def get_me_neighbourhood(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Neighbourhood settings + latest GPS hint for city picker."""
    latest = (
        db.query(Run)
        .filter(
            Run.user_id == current_user.id,
            (Run.route_polyline.isnot(None)) | (Run.start_lat.isnot(None)),
        )
        .order_by(Run.completed_at.desc())
        .first()
    )
    lat_hint = lng_hint = None
    if latest:
        la, ln = _run_centroid_lat_lng(latest)
        if la is not None and ln is not None:
            lat_hint, lng_hint = la, ln
    return {
        "opted_in": bool(getattr(current_user, "neighbourhood_opt_in", False)),
        "handle": current_user.handle,
        "home_city": getattr(current_user, "home_city", None),
        "home_country": getattr(current_user, "home_country", None),
        "home_lat": getattr(current_user, "home_lat", None),
        "home_lng": getattr(current_user, "home_lng", None),
        "widen_radius_km": int(getattr(current_user, "neighbourhood_widen_radius_km", 0) or 0),
        "latest_run_centroid_lat": lat_hint,
        "latest_run_centroid_lng": lng_hint,
    }


@app.patch("/me/neighbourhood")
@app.patch("/me/neighborhood", include_in_schema=False)
def patch_me_neighbourhood(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    opted_in = body.get("opted_in")
    if opted_in is not None:
        current_user.neighbourhood_opt_in = bool(opted_in)
    if "home_city" in body:
        v = body.get("home_city")
        current_user.home_city = (v or "").strip()[:120] or None
    if "home_country" in body:
        v = body.get("home_country")
        current_user.home_country = (v or "").strip().upper()[:2] or None
    if "home_lat" in body:
        current_user.home_lat = body.get("home_lat")
    if "home_lng" in body:
        current_user.home_lng = body.get("home_lng")
    if "widen_radius_km" in body:
        w = int(body.get("widen_radius_km") or 0)
        if w not in ALLOWED_WIDEN_KM:
            raise HTTPException(status_code=400, detail="widen_radius_km must be 0, 25, 50, or 100")
        current_user.neighbourhood_widen_radius_km = w

    if current_user.neighbourhood_opt_in:
        if not current_user.handle:
            raise HTTPException(
                status_code=400,
                detail="HANDLE_REQUIRED",
            )
        if not (current_user.home_city or "").strip():
            raise HTTPException(status_code=400, detail="home_city is required when opted in")
        if current_user.home_lat is None or current_user.home_lng is None:
            raise HTTPException(status_code=400, detail="home_lat and home_lng are required when opted in")

    db.commit()
    db.refresh(current_user)
    return get_me_neighbourhood(db=db, current_user=current_user)


@app.post("/me/neighbourhood/suggest")
@app.post("/me/neighborhood/suggest", include_in_schema=False)
@limiter.limit("30/minute")
def post_me_neighbourhood_suggest(
    request: Request,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Reverse-geocode a lat/lng into city + centroid; cached."""
    from services.geocode import round_key, reverse_geocode

    try:
        lat = float(body.get("lat"))
        lng = float(body.get("lng"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="lat and lng required")

    lat_k, lng_k = round_key(lat, lng)
    cached = (
        db.query(GeocodeCache)
        .filter(GeocodeCache.lat_key == lat_k, GeocodeCache.lng_key == lng_k)
        .first()
    )
    if cached:
        return {
            "city": cached.city,
            "country": cached.country,
            "lat": cached.centroid_lat or lat_k,
            "lng": cached.centroid_lng or lng_k,
            "cached": True,
        }

    res = reverse_geocode(lat, lng)
    if not res:
        raise HTTPException(status_code=502, detail="Geocoding unavailable; try manual city entry.")

    row = GeocodeCache(
        lat_key=lat_k,
        lng_key=lng_k,
        city=res["city"],
        country=res.get("country"),
        centroid_lat=res.get("centroid_lat"),
        centroid_lng=res.get("centroid_lng"),
        raw_json=res.get("raw"),
    )
    db.add(row)
    db.commit()
    return {
        "city": res["city"],
        "country": res.get("country"),
        "lat": res.get("centroid_lat") or lat_k,
        "lng": res.get("centroid_lng") or lng_k,
        "cached": False,
    }


# Standardised public reaction emojis on a Neighbourhood run. Love is
# kept as the existing NeighbourhoodIRanThis "I want to run this" signal;
# Like and Zen go through the generic RunReaction table.
NBH_LIKE_EMOJI = "👏"
NBH_LOVE_EMOJI = "💚"
NBH_ZEN_EMOJI = "🌿"


def _run_reaction_state(db: Session, run_id: int, viewer_id: int) -> dict:
    """Return per-emoji {count, viewer_reacted} for the standardised set."""
    iran_count = db.query(func.count(NeighbourhoodIRanThis.id)).filter(
        NeighbourhoodIRanThis.run_id == run_id
    ).scalar() or 0
    viewer_loved = db.query(NeighbourhoodIRanThis).filter(
        NeighbourhoodIRanThis.run_id == run_id,
        NeighbourhoodIRanThis.user_id == viewer_id,
    ).first()

    rr_rows = db.query(RunReaction).filter(RunReaction.run_id == run_id).all()
    counts: dict[str, int] = {}
    viewer_set: set[str] = set()
    for r in rr_rows:
        counts[r.emoji] = counts.get(r.emoji, 0) + 1
        if r.user_id == viewer_id:
            viewer_set.add(r.emoji)

    return {
        "like_count": int(counts.get(NBH_LIKE_EMOJI, 0)),
        "love_count": int(iran_count),
        "zen_count": int(counts.get(NBH_ZEN_EMOJI, 0)),
        "viewer_has_liked": NBH_LIKE_EMOJI in viewer_set,
        "viewer_has_loved": viewer_loved is not None,
        "viewer_has_zenned": NBH_ZEN_EMOJI in viewer_set,
    }


def _neighbourhood_feed_item(
    db: Session,
    run: Run,
    author_handle: str,
    viewer_id: int,
    thumb_b64: Optional[str],
):
    saves = db.query(func.count(NeighbourhoodSave.id)).filter(NeighbourhoodSave.run_id == run.id).scalar() or 0
    vs = db.query(NeighbourhoodSave).filter(
        NeighbourhoodSave.run_id == run.id, NeighbourhoodSave.user_id == viewer_id
    ).first()
    rx = _run_reaction_state(db, run.id, viewer_id)
    return {
        "run_id": run.id,
        "handle": author_handle,
        "city": run.neighbourhood_city,
        "distance_km": run.distance_km,
        "duration_seconds": run.duration_seconds,
        "completed_at": _iso_utc(run.completed_at),
        "photo_thumb_data": thumb_b64,
        "saves_count": int(saves),
        # Legacy field name preserved for any older client; new clients
        # read love_count from the reaction state below.
        "i_ran_this_count": rx["love_count"],
        "viewer_has_saved": vs is not None,
        "viewer_has_run_this": rx["viewer_has_loved"],
        **rx,
    }


def _viewer_neighbourhood_ready(u: User) -> bool:
    return bool(
        getattr(u, "neighbourhood_opt_in", False)
        and (u.home_city or "").strip()
        and u.handle
        and u.home_lat is not None
        and u.home_lng is not None
    )


def _neighbourhood_run_visible(db: Session, run: Run, author: User, viewer: User) -> bool:
    from services.overpass import haversine_km

    if not author or not author.handle:
        return False
    blocked = (
        db.query(NeighbourhoodBlockedHandle)
        .filter(
            NeighbourhoodBlockedHandle.user_id == viewer.id,
            NeighbourhoodBlockedHandle.blocked_handle == author.handle.lower(),
        )
        .first()
    )
    if blocked:
        return False
    home_city_l = (viewer.home_city or "").strip().lower()
    city_ok = (run.neighbourhood_city or "").strip().lower() == home_city_l
    widen_ok = False
    if (getattr(viewer, "neighbourhood_widen_radius_km", 0) or 0) > 0 and viewer.home_lat is not None:
        cla, cln = run.neighbourhood_centroid_lat, run.neighbourhood_centroid_lng
        if cla is not None and cln is not None:
            widen_ok = (
                haversine_km(
                    (float(viewer.home_lat), float(viewer.home_lng)),
                    (float(cla), float(cln)),
                )
                <= int(viewer.neighbourhood_widen_radius_km or 0)
            )
    return city_ok or widen_ok


def _get_neighbourhood_run_or_404(db: Session, run_id: int, viewer: User):
    if not _viewer_neighbourhood_ready(viewer):
        raise HTTPException(status_code=403, detail="Complete neighbourhood setup first.")
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.neighbourhood_visibility != "neighbourhood":
        raise HTTPException(status_code=404, detail="Not found")
    author = db.query(User).filter(User.id == run.user_id).first()
    if not author or not author.handle:
        raise HTTPException(status_code=404, detail="Not found")
    if not _neighbourhood_run_visible(db, run, author, viewer):
        raise HTTPException(status_code=404, detail="Not found")
    return run, author


@app.get("/me/neighbourhood/search")
@app.get("/me/neighborhood/search", include_in_schema=False)
@limiter.limit("30/minute")
def get_me_neighbourhood_search(
    request: Request,
    q: str = Query(..., min_length=2, max_length=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    from services.geocode import search_places

    return {"results": search_places(q, limit=8)}


@app.get("/neighbourhood/feed")
@app.get("/neighborhood/feed", include_in_schema=False)
def neighbourhood_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
    limit: int = Query(20, ge=1, le=50),
    include_widen: bool = Query(False),
    published_before: Optional[str] = None,
    before_run_id: Optional[int] = None,
):
    from services.overpass import haversine_km

    if not _viewer_neighbourhood_ready(current_user):
        raise HTTPException(status_code=403, detail="Complete neighbourhood setup (handle, city, opt-in) first.")

    blocked_rows = db.query(NeighbourhoodBlockedHandle.blocked_handle).filter(
        NeighbourhoodBlockedHandle.user_id == current_user.id
    ).all()
    blocked = {r[0].lower() for r in blocked_rows if r[0]}

    home_city_l = (current_user.home_city or "").strip().lower()
    widen_km = int(getattr(current_user, "neighbourhood_widen_radius_km", 0) or 0)
    vlat, vlng = current_user.home_lat, current_user.home_lng

    # NB: we deliberately include the current user's own shared runs in the
    # feed. The neighbourhood is "your city's runners" — the viewer is one of
    # those runners. Hiding their own posts made the feed feel empty for new
    # users who'd just shared their first run.
    base = (
        db.query(Run, User)
        .join(User, User.id == Run.user_id)
        .filter(
            Run.neighbourhood_visibility == "neighbourhood",
            Run.neighbourhood_published_at.isnot(None),
            User.handle.isnot(None),
            User.handle != "",
        )
    )
    if blocked:
        base = base.filter(func.lower(User.handle).notin_(list(blocked)))

    rows = base.order_by(Run.neighbourhood_published_at.desc(), Run.id.desc()).limit(400).all()

    def city_match(r: Run) -> bool:
        return (r.neighbourhood_city or "").strip().lower() == home_city_l

    def within_widen(r: Run) -> bool:
        if not include_widen or widen_km <= 0 or vlat is None or vlng is None:
            return False
        if r.neighbourhood_centroid_lat is not None and r.neighbourhood_centroid_lng is not None:
            cla, cln = float(r.neighbourhood_centroid_lat), float(r.neighbourhood_centroid_lng)
        else:
            cla, cln = _run_centroid_lat_lng(r)
        if cla is None or cln is None:
            return False
        return haversine_km((vlat, vlng), (cla, cln)) <= widen_km

    filtered: List = []
    for run, author in rows:
        if city_match(run) or within_widen(run):
            filtered.append((run, author))

    # cursor: skip until older than (published_before, before_run_id)
    if published_before and before_run_id is not None:
        from datetime import datetime as dtmod

        try:
            pb = dtmod.fromisoformat(published_before.replace("Z", "+00:00"))
        except ValueError:
            pb = None
        if pb is not None:
            new_f = []
            for run, author in filtered:
                rp = run.neighbourhood_published_at
                if rp is None:
                    continue
                if rp < pb or (rp == pb and run.id < before_run_id):
                    new_f.append((run, author))
            filtered = new_f

    page = filtered[:limit]
    next_cursor = None
    if len(filtered) > limit:
        last_run, _ = filtered[limit - 1]
        next_cursor = {
            "published_before": last_run.neighbourhood_published_at.isoformat()
            if last_run.neighbourhood_published_at
            else None,
            "before_run_id": last_run.id,
        }

    run_ids = [r.id for r, _ in page]
    thumbs = {}
    if run_ids:
        photos = (
            db.query(RunPhoto)
            .filter(RunPhoto.run_id.in_(run_ids))
            .order_by(RunPhoto.run_id, RunPhoto.distance_marker_km)
            .all()
        )
        seen = set()
        for p in photos:
            if p.run_id in seen:
                continue
            seen.add(p.run_id)
            # Prefer the small thumbnail (~360px) so feed payloads stay light.
            # Lazy-backfill if the row pre-dates the thumbnail migration.
            thumb = getattr(p, "thumb_data", None)
            if not thumb and p.photo_data:
                thumb = _make_thumbnail_b64(p.photo_data)
                if thumb:
                    p.thumb_data = thumb
            thumbs[p.run_id] = thumb or None
        try:
            db.commit()
        except Exception:
            db.rollback()

    items = [
        _neighbourhood_feed_item(db, run, author.handle, current_user.id, thumbs.get(run.id))
        for run, author in page
    ]
    return {"items": items, "next_cursor": next_cursor}


@app.get("/neighbourhood/saved")
@app.get("/neighborhood/saved", include_in_schema=False)
def neighbourhood_saved_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
    limit: int = Query(30, ge=1, le=100),
):
    if not _viewer_neighbourhood_ready(current_user):
        raise HTTPException(status_code=403, detail="Complete neighbourhood setup first.")

    saves = (
        db.query(NeighbourhoodSave, Run, User)
        .join(Run, Run.id == NeighbourhoodSave.run_id)
        .join(User, User.id == Run.user_id)
        .filter(NeighbourhoodSave.user_id == current_user.id, Run.neighbourhood_visibility == "neighbourhood")
        .order_by(NeighbourhoodSave.created_at.desc())
        .limit(limit)
        .all()
    )
    run_ids = [r.id for _, r, _ in saves]
    thumbs = {}
    if run_ids:
        for p in (
            db.query(RunPhoto)
            .filter(RunPhoto.run_id.in_(run_ids))
            .order_by(RunPhoto.run_id, RunPhoto.distance_marker_km)
            .all()
        ):
            if p.run_id not in thumbs:
                data = p.photo_data or ""
                thumbs[p.run_id] = data[:12000] if len(data) > 12000 else data
    items = [
        _neighbourhood_feed_item(db, run, author.handle, current_user.id, thumbs.get(run.id))
        for _, run, author in saves
    ]
    return {"items": items}


@app.get("/neighbourhood/runs/{run_id}")
@app.get("/neighborhood/runs/{run_id}", include_in_schema=False)
def neighbourhood_run_detail(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    run, author = _get_neighbourhood_run_or_404(db, run_id, current_user)

    photos = db.query(RunPhoto).filter(RunPhoto.run_id == run.id).order_by(RunPhoto.distance_marker_km).all()
    photo_payload = [
        {
            "id": p.id,
            "distance_marker_km": p.distance_marker_km,
            "caption": p.caption,
            "photo_data": p.photo_data,
        }
        for p in photos
    ]
    saves = db.query(func.count(NeighbourhoodSave.id)).filter(NeighbourhoodSave.run_id == run.id).scalar() or 0
    vs = db.query(NeighbourhoodSave).filter(
        NeighbourhoodSave.run_id == run.id, NeighbourhoodSave.user_id == current_user.id
    ).first()
    rx = _run_reaction_state(db, run.id, current_user.id)

    return {
        "run_id": run.id,
        "handle": author.handle,
        "city": run.neighbourhood_city,
        "distance_km": run.distance_km,
        "duration_seconds": run.duration_seconds,
        "completed_at": _iso_utc(run.completed_at),
        "route_polyline": run.route_polyline,
        "notes": run.notes,
        "photos": photo_payload,
        "saves_count": int(saves),
        "i_ran_this_count": rx["love_count"],
        "viewer_has_saved": vs is not None,
        "viewer_has_run_this": rx["viewer_has_loved"],
        **rx,
    }


@app.post("/runs/{run_id}/share-neighbourhood")
@app.post("/runs/{run_id}/share-neighborhood", include_in_schema=False)
def share_run_neighbourhood(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    if not _viewer_neighbourhood_ready(current_user):
        raise HTTPException(status_code=403, detail="Opt in to neighbourhood and set your home city first.")

    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")

    cla, cln = _run_centroid_lat_lng(run)
    if cla is None:
        raise HTTPException(status_code=400, detail="Run has no route or start location to share.")

    run.neighbourhood_visibility = "neighbourhood"
    from datetime import datetime as dtmod

    run.neighbourhood_published_at = dtmod.utcnow()
    run.neighbourhood_centroid_lat = cla
    run.neighbourhood_centroid_lng = cln
    run.neighbourhood_city = (current_user.home_city or "").strip()[:120]
    db.commit()
    db.refresh(run)
    return format_run_response(run, db=db)


@app.delete("/runs/{run_id}/share-neighbourhood")
@app.delete("/runs/{run_id}/share-neighborhood", include_in_schema=False)
def unshare_run_neighbourhood(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    run.neighbourhood_visibility = "off"
    run.neighbourhood_published_at = None
    run.neighbourhood_centroid_lat = None
    run.neighbourhood_centroid_lng = None
    run.neighbourhood_city = None
    db.commit()
    db.refresh(run)
    return format_run_response(run, db=db)


@app.post("/runs/{run_id}/share-circles")
def share_run_circles(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Re-enable visibility of this run inside the user's circles. This is
    the default state; the endpoint exists so users who previously opted
    out can flip it back on. No payload — the run is set circles_share=True."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    run.circles_share = True
    db.commit()
    db.refresh(run)
    return format_run_response(run, db=db)


@app.delete("/runs/{run_id}/share-circles")
def unshare_run_circles(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Hide this run from every circle the owner belongs to. The owner
    still sees their own run in the feed (so they don't lose track of it),
    but other members no longer do."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    run.circles_share = False
    db.commit()
    db.refresh(run)
    return format_run_response(run, db=db)


@app.post("/neighbourhood/runs/{run_id}/save")
@app.post("/neighborhood/runs/{run_id}/save", include_in_schema=False)
def neighbourhood_save_add(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    _get_neighbourhood_run_or_404(db, run_id, current_user)

    existing = (
        db.query(NeighbourhoodSave)
        .filter(NeighbourhoodSave.run_id == run_id, NeighbourhoodSave.user_id == current_user.id)
        .first()
    )
    if not existing:
        db.add(NeighbourhoodSave(run_id=run_id, user_id=current_user.id))
        db.commit()
    return {"status": "saved"}


@app.delete("/neighbourhood/runs/{run_id}/save")
@app.delete("/neighborhood/runs/{run_id}/save", include_in_schema=False)
def neighbourhood_save_remove(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    db.query(NeighbourhoodSave).filter(
        NeighbourhoodSave.run_id == run_id, NeighbourhoodSave.user_id == current_user.id
    ).delete()
    db.commit()
    return {"status": "removed"}


@app.post("/neighbourhood/runs/{run_id}/i-ran-this")
@app.post("/neighborhood/runs/{run_id}/i-ran-this", include_in_schema=False)
def neighbourhood_iran_add(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    _get_neighbourhood_run_or_404(db, run_id, current_user)

    existing = (
        db.query(NeighbourhoodIRanThis)
        .filter(NeighbourhoodIRanThis.run_id == run_id, NeighbourhoodIRanThis.user_id == current_user.id)
        .first()
    )
    if not existing:
        db.add(NeighbourhoodIRanThis(run_id=run_id, user_id=current_user.id))
        db.commit()
    return {"status": "marked"}


@app.delete("/neighbourhood/runs/{run_id}/i-ran-this")
@app.delete("/neighborhood/runs/{run_id}/i-ran-this", include_in_schema=False)
def neighbourhood_iran_remove(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    db.query(NeighbourhoodIRanThis).filter(
        NeighbourhoodIRanThis.run_id == run_id, NeighbourhoodIRanThis.user_id == current_user.id
    ).delete()
    db.commit()
    return {"status": "removed"}


@app.post("/neighbourhood/runs/{run_id}/react")
@app.post("/neighborhood/runs/{run_id}/react", include_in_schema=False)
def neighbourhood_toggle_reaction(
    run_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Toggle one of the standardised public reactions on a Neighbourhood run.

    Love (💚) is dispatched to NeighbourhoodIRanThis (which doubles as the
    "I want to run this" signal). Like (👏) and Zen (🌿) go to the
    generic RunReaction table. Returns the post-toggle reaction state so
    the client can update without a refetch."""
    _get_neighbourhood_run_or_404(db, run_id, current_user)

    emoji = body.get("emoji", "")
    if emoji not in ALLOWED_REACTION_EMOJIS:
        raise HTTPException(
            status_code=400,
            detail=f"Emoji not allowed. Use one of: {ALLOWED_REACTION_EMOJIS}",
        )

    if emoji == NBH_LOVE_EMOJI:
        existing = (
            db.query(NeighbourhoodIRanThis)
            .filter(
                NeighbourhoodIRanThis.run_id == run_id,
                NeighbourhoodIRanThis.user_id == current_user.id,
            )
            .first()
        )
        if existing:
            db.delete(existing)
        else:
            db.add(NeighbourhoodIRanThis(run_id=run_id, user_id=current_user.id))
        db.commit()
    else:
        existing_rx = (
            db.query(RunReaction)
            .filter(
                RunReaction.run_id == run_id,
                RunReaction.user_id == current_user.id,
                RunReaction.emoji == emoji,
            )
            .first()
        )
        if existing_rx:
            db.delete(existing_rx)
        else:
            db.add(RunReaction(run_id=run_id, user_id=current_user.id, emoji=emoji))
        db.commit()

    return _run_reaction_state(db, run_id, current_user.id)


@app.post("/neighbourhood/runs/{run_id}/report")
@app.post("/neighborhood/runs/{run_id}/report", include_in_schema=False)
def neighbourhood_report_run(
    run_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Report a shared run; hides that author from the reporter's feed."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.neighbourhood_visibility != "neighbourhood":
        raise HTTPException(status_code=404, detail="Not found")
    author = db.query(User).filter(User.id == run.user_id).first()
    if not author or not author.handle:
        raise HTTPException(status_code=404, detail="Not found")

    reason = body.get("reason")
    if reason:
        reason = _sanitize_text(str(reason), max_length=500)

    db.add(
        NeighbourhoodReport(
            reporter_id=current_user.id,
            run_id=run_id,
            reason=reason,
        )
    )
    bh = (
        db.query(NeighbourhoodBlockedHandle)
        .filter(
            NeighbourhoodBlockedHandle.user_id == current_user.id,
            NeighbourhoodBlockedHandle.blocked_handle == author.handle.lower(),
        )
        .first()
    )
    if not bh:
        db.add(
            NeighbourhoodBlockedHandle(
                user_id=current_user.id,
                blocked_handle=author.handle.lower(),
            )
        )
    db.commit()
    return {"status": "reported"}


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
    import traceback
    try:
        return _build_public_profile(handle, db, current_user)
    except HTTPException:
        raise
    except Exception as e:
        print(f"PROFILE ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Something went wrong loading this profile")

def _build_public_profile(handle: str, db: Session, current_user):
    from datetime import datetime
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
                "completed_at": _iso_utc(sr.completed_at),
                "photo_count": photo_count_map.get(sr.id, 0),
                "cover_photo": cover.photo_data if cover else None,
                "caption": cover.caption if cover else None,
            })

    user_goals = db.query(UserGoals).filter(UserGoals.user_id == profile_user.id).first()
    yearly_km_goal = user_goals.yearly_km_goal if user_goals else level_goals["yearly_km"]
    yearly_km_done = round(sum(r.distance_km for r in all_runs), 1)
    yearly_percent = round((yearly_km_done / yearly_km_goal) * 100, 1) if yearly_km_goal > 0 else 0

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
        "yearly_km_goal": yearly_km_goal,
        "yearly_km_done": yearly_km_done,
        "yearly_percent": yearly_percent,
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
    {"text": "A lot of people run a race to see who is fastest. I run to see who has the most guts.", "author": "Steve Prefontaine"},
    {"text": "If you want to win something, run 100 metres. If you want to experience something, run a marathon.", "author": "Emil Zátopek"},
    {"text": "No human is limited.", "author": "Eliud Kipchoge"},
    {"text": "Only the disciplined ones are free in life.", "author": "Eliud Kipchoge"},
    {"text": "The marathon is a charismatic event. It has everything. It has drama. It has competition. It has camaraderie.", "author": "Fred Lebow"},
    {"text": "The marathon can humble you.", "author": "Bill Rodgers"},
    {"text": "You have to forget your last marathon before you try another. Your mind can't know what's coming.", "author": "Frank Shorter"},
    {"text": "The will to win means nothing without the will to prepare.", "author": "Juma Ikangaa"},
    {"text": "Don't dream of winning. Train for it.", "author": "Mo Farah"},
    {"text": "Every marathon is a new beginning.", "author": "Grete Waitz"},
    {"text": "Stadiums are for spectators. Runners have the roads, trails, and tracks.", "author": "Amby Burfoot"},
    {"text": "Run when you can, walk if you have to, crawl if you must — just never give up.", "author": "Dean Karnazes"},
    {"text": "Sometimes you just do things.", "author": "Scott Jurek"},
    {"text": "I don't think limits.", "author": "Usain Bolt"},
    {"text": "I am building a fire, and every day I train, I add more fuel. At just the right moment, I light the match.", "author": "Mia Hamm"},
    {"text": "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", "author": "Aristotle"},
    {"text": "He who is not courageous enough to take risks will accomplish nothing in life.", "author": "Muhammad Ali"},
    {"text": "Energy and persistence conquer all things.", "author": "Benjamin Franklin"},
    {"text": "Well done is better than well said.", "author": "Benjamin Franklin"},
    {"text": "The secret of getting ahead is getting started.", "author": "Mark Twain"},
    {"text": "You do not rise to the level of your goals. You fall to the level of your systems.", "author": "James Clear"},
    {"text": "Small disciplines repeated with consistency lead to great achievements gained slowly over time.", "author": "John C. Maxwell"},
    {"text": "The impediment to action advances action. What stands in the way becomes the way.", "author": "Marcus Aurelius"},
    {"text": "Begin at once to live, and count each separate day as a separate life.", "author": "Seneca"},
    {"text": "How long are you going to wait before you demand the best for yourself?", "author": "Epictetus"},
    {"text": "The harder the conflict, the more glorious the triumph.", "author": "Thomas Paine"},
    {"text": "What lies behind us and what lies before us are tiny matters compared to what lies within us.", "author": "Ralph Waldo Emerson"},
    {"text": "The future belongs to those who believe in the beauty of their dreams.", "author": "Eleanor Roosevelt"},
    {"text": "You are never too old to set another goal or to dream a new dream.", "author": "C.S. Lewis"},
    {"text": "The only way to prove that you're a good sport is to lose.", "author": "Ernie Banks"},
    {"text": "Winning doesn't always mean being first. Winning means you're doing better than you've ever done before.", "author": "Bonnie Blair"},
    {"text": "You miss 100% of the shots you don't take.", "author": "Wayne Gretzky"},
    {"text": "It always seems impossible until it's done.", "author": "Nelson Mandela"},
    {"text": "The man who moves a mountain begins by carrying away small stones.", "author": "Confucius"},
]

@app.get("/daily-wisdom")
def get_daily_wisdom(current_user: User = Depends(require_auth)):
    """Return a deterministic daily quote based on day of year."""
    from datetime import datetime
    day_of_year = datetime.now().timetuple().tm_yday
    quote = DAILY_QUOTES[day_of_year % len(DAILY_QUOTES)]
    return {"text": quote["text"], "author": quote["author"]}



# ==========================================
# 📜 STREAK HISTORY
# ==========================================

@app.get("/streak-history")
def get_streak_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Return list of all streak periods (requires auth)."""
    return crud.get_streak_history(db, user_id=current_user.id)


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
    current_user: User = Depends(require_auth)
):
    """Detect seasonal running milestones (requires auth)."""
    from datetime import datetime
    
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
    message = _sanitize_text(checkin_data.get("message", ""), max_length=100)
    
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

    reflection_text = _sanitize_text(body.get("reflection") or "", max_length=200)
    mood = _sanitize_text(body.get("mood") or "", max_length=50)

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

# Standardised reaction set used across Circle and Neighbourhood feeds.
# Public reactions only (Like / Love / Zen). The Save bookmark is a
# separate personal action stored in NeighbourhoodSave (now used for
# both surfaces). Frontend mirrors this list in
# `frontend/constants/reactions.ts`. If you change one, change the other.
ALLOWED_REACTION_EMOJIS = ["👏", "💚", "🌿"]


def _verify_circle_membership(db: Session, circle_id: int, user_id: int):
    membership = db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id,
        CircleMembership.user_id == user_id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this circle")
    return membership


def _get_reactions_for_items(db: Session, circle_id: int, target_type: str, target_ids: list, current_user_id: int):
    """Build a dict of target_id -> [{ emoji, count, reacted }] for the
    standardised reaction set. Legacy emojis (the old 🌊 ☀️ 🏔️ 👋 set)
    still exist in the table but are filtered out so they never reach the
    UI; the new bar only ever shows Like / Love / Zen."""
    if not target_ids:
        return {}
    reactions = db.query(CircleFeedReaction).filter(
        CircleFeedReaction.circle_id == circle_id,
        CircleFeedReaction.target_type == target_type,
        CircleFeedReaction.target_id.in_(target_ids),
        CircleFeedReaction.emoji.in_(ALLOWED_REACTION_EMOJIS),
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

    # Owners always see their own runs in the feed, even if they've opted
    # them out of circles. Other members only see runs where the owner
    # left circles_share at the default-true (or hasn't opted out yet —
    # legacy rows are treated as visible).
    from sqlalchemy import or_
    runs = (
        db.query(Run)
        .filter(
            Run.user_id.in_(member_ids),
            Run.completed_at >= min_date,
            or_(
                Run.user_id == current_user.id,
                Run.circles_share.is_(None),
                Run.circles_share.is_(True),
            ),
        )
        .order_by(Run.completed_at.desc())
        .limit(limit)
        .all()
    )

    checkins = db.query(CircleCheckin).filter(
        CircleCheckin.circle_id == circle_id,
    ).order_by(CircleCheckin.created_at.desc()).limit(limit).all()

    run_reactions = _get_reactions_for_items(db, circle_id, "run", [r.id for r in runs], current_user.id)
    checkin_reactions = _get_reactions_for_items(db, circle_id, "checkin", [c.id for c in checkins], current_user.id)

    # Saves are stored in NeighbourhoodSave (one table for "saved runs"
    # regardless of where the user found them — Circle or Neighbourhood).
    run_ids = [r.id for r in runs]
    saved_run_ids: set[int] = set()
    if run_ids:
        saved_run_ids = {
            row.run_id
            for row in db.query(NeighbourhoodSave)
            .filter(
                NeighbourhoodSave.user_id == current_user.id,
                NeighbourhoodSave.run_id.in_(run_ids),
            )
            .all()
        }

    user_cache = {}
    def get_user(uid):
        if uid not in user_cache:
            u = db.query(User).filter(User.id == uid).first()
            user_cache[uid] = u
        return user_cache[uid]

    feed_items = []

    # Cap thumbnails per feed item; the user can tap into the run for the
    # full set. 4 keeps the payload light while showing enough to entice.
    THUMBS_PER_RUN = 4

    dirty_thumbs = False
    for r in runs:
        u = get_user(r.user_id)
        photos = (
            db.query(RunPhoto)
            .filter(RunPhoto.run_id == r.id)
            .order_by(RunPhoto.distance_marker_km.asc())
            .all()
        )
        photo_thumbs: list[dict] = []
        for p in photos[:THUMBS_PER_RUN]:
            thumb = getattr(p, "thumb_data", None)
            if thumb is None and p.photo_data:
                thumb = _make_thumbnail_b64(p.photo_data)
                if thumb:
                    p.thumb_data = thumb
                    dirty_thumbs = True
            if thumb:
                photo_thumbs.append({
                    "id": p.id,
                    "thumb_data": thumb,
                    "caption": p.caption,
                    "distance_marker_km": p.distance_marker_km,
                })
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
                "photos": photo_thumbs,
            },
            "reactions": run_reactions.get(r.id, []),
            "viewer_has_saved": r.id in saved_run_ids,
            "created_at": _iso_utc(r.completed_at),
        })

    if dirty_thumbs:
        try:
            db.commit()
        except Exception:
            db.rollback()

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
    full: bool = False,
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """All scenic photos from circle members' runs.

    Response shape mirrors run/walk photo endpoints:
      - default: each item has ``thumb_data`` (~5–15 KB base64). Lazy
        backfills missing thumbs in-place. Capped to ``limit`` most-recent.
      - ``?full=true``: returns full ``photo_data`` (slow, legacy).
    """
    _verify_circle_membership(db, circle_id, current_user.id)

    member_ids = [m.user_id for m in db.query(CircleMembership).filter(
        CircleMembership.circle_id == circle_id
    ).all()]
    if not member_ids:
        return []

    from datetime import datetime
    min_date = datetime(2026, 1, 1)

    rows = (
        db.query(RunPhoto, Run, User)
        .join(Run, Run.id == RunPhoto.run_id)
        .join(User, User.id == RunPhoto.user_id)
        .filter(
            RunPhoto.user_id.in_(member_ids),
            RunPhoto.created_at >= min_date,
        )
        .order_by(RunPhoto.created_at.desc())
        .limit(limit)
        .all()
    )

    dirty = False
    result: list[dict] = []
    for p, r, u in rows:
        item: dict = {
            "id": p.id,
            "caption": p.caption,
            "distance_marker_km": p.distance_marker_km,
            "user_name": u.name if u else "Runner",
            "run_id": r.id if r else None,
            "run_distance": r.run_type.upper() if r else "",
            "run_date": _iso_utc(r.completed_at) if r else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        if full:
            item["photo_data"] = p.photo_data
        else:
            thumb = getattr(p, "thumb_data", None)
            if thumb is None and p.photo_data:
                thumb = _make_thumbnail_b64(p.photo_data)
                if thumb:
                    p.thumb_data = thumb
                    dirty = True
            item["thumb_data"] = thumb
            item["is_thumb"] = True
        result.append(item)

    if dirty:
        try:
            db.commit()
        except Exception:
            db.rollback()
    return result


@app.get("/circles/{circle_id}/photos/{photo_id}/full")
def get_circle_photo_full(
    circle_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return one circle photo's full-resolution base64 on demand. Only
    members of the circle can fetch, and the photo's owner must still be
    a member."""
    _verify_circle_membership(db, circle_id, current_user.id)
    member_ids = {
        m.user_id
        for m in db.query(CircleMembership).filter(CircleMembership.circle_id == circle_id).all()
    }
    p = db.query(RunPhoto).filter(RunPhoto.id == photo_id).first()
    if not p or p.user_id not in member_ids:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {
        "id": p.id,
        "run_id": p.run_id,
        "photo_data": p.photo_data,
        "distance_marker_km": p.distance_marker_km,
        "caption": p.caption,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@app.post("/circles/{circle_id}/runs/{run_id}/save")
def circle_save_add(
    circle_id: int,
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Bookmark a run seen in the circle feed. Stored in the same table as
    Neighbourhood saves so a single 'saved runs' surface can list either."""
    _verify_circle_membership(db, circle_id, current_user.id)
    # Only allow saving runs by circle members (anti-leak guard).
    member_ids = {
        m.user_id
        for m in db.query(CircleMembership).filter(CircleMembership.circle_id == circle_id).all()
    }
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.user_id not in member_ids:
        raise HTTPException(status_code=404, detail="Run not found")

    existing = (
        db.query(NeighbourhoodSave)
        .filter(NeighbourhoodSave.run_id == run_id, NeighbourhoodSave.user_id == current_user.id)
        .first()
    )
    if not existing:
        db.add(NeighbourhoodSave(run_id=run_id, user_id=current_user.id))
        db.commit()
    return {"status": "saved"}


@app.delete("/circles/{circle_id}/runs/{run_id}/save")
def circle_save_remove(
    circle_id: int,
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    _verify_circle_membership(db, circle_id, current_user.id)
    db.query(NeighbourhoodSave).filter(
        NeighbourhoodSave.run_id == run_id, NeighbourhoodSave.user_id == current_user.id
    ).delete()
    db.commit()
    return {"status": "removed"}


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

    existing_count = db.query(RunPhoto).filter(RunPhoto.run_id == run_id).count()
    if existing_count >= MAX_PHOTOS_PER_ACTIVITY:
        raise HTTPException(
            status_code=400,
            detail=f"This run already has {MAX_PHOTOS_PER_ACTIVITY} photos (the per-run limit).",
        )

    base64_data = photo_data.get("photo_data")
    distance_marker = photo_data.get("distance_marker_km")
    caption = photo_data.get("caption")
    if caption:
        caption = _sanitize_text(caption, max_length=200)
    
    if not base64_data:
        raise HTTPException(status_code=400, detail="photo_data is required")
    
    # Headroom above the 1200px capture path so manually-uploaded richer
    # library photos still fit. Anything above 10 MB is almost certainly
    # something we don't want stored inline in the row anyway.
    MAX_PHOTO_BYTES = 10 * 1024 * 1024
    if len(base64_data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Photo exceeds maximum size of 10MB")
    
    VALID_IMAGE_PREFIXES = ("/9j/", "iVBOR", "R0lGO", "UklGR", "data:image/")
    clean_data = base64_data.split(",", 1)[-1] if base64_data.startswith("data:") else base64_data
    if not any(clean_data.startswith(p) for p in VALID_IMAGE_PREFIXES) and not base64_data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image format")
    if distance_marker is None or distance_marker <= 0:
        raise HTTPException(status_code=400, detail="distance_marker_km must be positive")
    if distance_marker > run.distance_km:
        raise HTTPException(status_code=400, detail=f"Marker {distance_marker}km exceeds run distance {run.distance_km}km")
    
    photo = RunPhoto(
        run_id=run_id,
        user_id=current_user.id,
        photo_data=base64_data,
        thumb_data=_make_thumbnail_b64(base64_data),
        distance_marker_km=distance_marker,
        caption=caption
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    
    return {
        "id": photo.id,
        "run_id": photo.run_id,
        # Mirror the list-response shape so the client can drop the new photo
        # straight into its list state without a refetch.
        "thumb_data": photo.thumb_data,
        "is_thumb": True,
        "distance_marker_km": photo.distance_marker_km,
        "caption": photo.caption,
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
    }


@app.get("/runs/{run_id}/photos")
def get_run_photos(
    run_id: int,
    thumbnails_only: bool = False,
    full: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get photos for a run.

    Response shape:
      - default: returns `thumb_data` (small base64 thumb, ~5–15 KB each).
        Used by carousels / grids. Lazily backfills missing thumbs in-place.
      - `?full=true`: returns full-resolution `photo_data` (legacy parity).
      - `?thumbnails_only=true`: returns no base64 at all (just metadata).
    """
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    photos = db.query(RunPhoto).filter(RunPhoto.run_id == run_id).order_by(RunPhoto.distance_marker_km.asc()).all()

    if thumbnails_only:
        return [
            {
                "id": p.id,
                "run_id": p.run_id,
                "distance_marker_km": p.distance_marker_km,
                "caption": p.caption,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in photos
        ]

    if full:
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

    # Default: thumbnails. Lazy-backfill missing ones so legacy rows get
    # generated on first read instead of staying broken forever.
    dirty = False
    items: list[dict] = []
    for p in photos:
        thumb = getattr(p, "thumb_data", None)
        if thumb is None:
            thumb = _make_thumbnail_b64(p.photo_data)
            if thumb:
                p.thumb_data = thumb
                dirty = True
        items.append({
            "id": p.id,
            "run_id": p.run_id,
            "thumb_data": thumb,
            "is_thumb": True,
            "distance_marker_km": p.distance_marker_km,
            "caption": p.caption,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    if dirty:
        try:
            db.commit()
        except Exception:
            db.rollback()
    return items


@app.get("/runs/{run_id}/photos/{photo_id}/full")
def get_run_photo_full(
    run_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return one run photo's full-resolution base64 on demand. Used by the
    lightbox / pinch-zoomable viewer once the user taps a thumbnail."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    p = db.query(RunPhoto).filter(RunPhoto.id == photo_id, RunPhoto.run_id == run_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {
        "id": p.id,
        "run_id": p.run_id,
        "photo_data": p.photo_data,
        "distance_marker_km": p.distance_marker_km,
        "caption": p.caption,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


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


@app.put("/runs/{run_id}/photos/{photo_id}")
def update_run_photo(
    run_id: int,
    photo_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Update editable fields on a run photo. Currently: caption."""
    photo = db.query(RunPhoto).filter(
        RunPhoto.id == photo_id,
        RunPhoto.run_id == run_id,
        RunPhoto.user_id == current_user.id,
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if "caption" in payload:
        new_caption = payload.get("caption")
        if new_caption is None or new_caption == "":
            photo.caption = None
        else:
            photo.caption = _sanitize_text(str(new_caption), max_length=200)
    db.commit()
    db.refresh(photo)
    return {
        "id": photo.id,
        "run_id": photo.run_id,
        "distance_marker_km": photo.distance_marker_km,
        "caption": photo.caption,
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
    }


@app.get("/me/photos")
def list_my_photos(
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
    include_data: bool = True,
    full: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """
    📸 Unified Album feed — every photo the current user has, runs and walks
    merged into a single timeline ordered by created_at DESC.

    Pagination is cursor-based on `created_at`. Pass the `next_cursor` from
    the previous response to fetch the next page. `next_cursor` is null on
    the last page.

    `include_data` controls whether `photo_data` (base64) is included.
    By default we serve the small ``thumb_data`` (~360px) so the album loads
    quickly. Pass ``full=true`` to get the full-resolution ``photo_data``
    (slow, only for export-style tools).

    Each item carries a small `activity` payload so the client can render
    distance / when / kind without a second round-trip per photo.
    """
    from datetime import datetime as _dt

    cursor_dt = None
    if cursor:
        try:
            cursor_dt = _dt.fromisoformat(cursor)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor")

    # Fetch a window from each source so the merge has enough material to
    # fill `limit` even when one source dominates the timeline.
    window = limit * 2

    run_q = (
        db.query(RunPhoto, Run)
        .join(Run, Run.id == RunPhoto.run_id)
        .filter(RunPhoto.user_id == current_user.id)
    )
    if cursor_dt is not None:
        run_q = run_q.filter(RunPhoto.created_at < cursor_dt)
    run_rows = run_q.order_by(RunPhoto.created_at.desc()).limit(window).all()

    walk_q = (
        db.query(WalkPhoto, Walk)
        .join(Walk, Walk.id == WalkPhoto.walk_id)
        .filter(WalkPhoto.user_id == current_user.id)
    )
    if cursor_dt is not None:
        walk_q = walk_q.filter(WalkPhoto.created_at < cursor_dt)
    walk_rows = walk_q.order_by(WalkPhoto.created_at.desc()).limit(window).all()

    # Backfill missing thumbnails for *all* rows in the page rather than
    # capping. With a previous cap of 4, older photos kept falling back to
    # the full-resolution base64 — which defeats the point and made the
    # album feel "uncached" because every refetch shipped the same fat
    # payload. Pillow takes ~50–100 ms per image; even at 24 thumbs that's
    # ~1–2 s on first load only. Subsequent loads are instant because the
    # thumbs are now in the DB.
    def _resolve_thumb(p) -> Optional[str]:
        if getattr(p, "thumb_data", None):
            return p.thumb_data
        if full:
            return None  # caller wanted full data anyway
        if p.photo_data:
            t = _make_thumbnail_b64(p.photo_data)
            if t:
                p.thumb_data = t
                return t
        return None

    items: list[dict] = []
    for p, r in run_rows:
        item = {
            "id": p.id,
            "kind": "run",
            "activity_id": p.run_id,
            "distance_marker_km": p.distance_marker_km,
            "lat": None,
            "lng": None,
            "caption": p.caption,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "activity": {
                "id": r.id,
                "kind": "run",
                "distance_km": r.distance_km,
                "duration_seconds": r.duration_seconds,
                "started_at": _iso_utc(r.started_at),
                "completed_at": _iso_utc(r.completed_at),
                "run_type": r.run_type,
                "category": getattr(r, "category", None),
            },
        }
        if include_data:
            if full:
                item["photo_data"] = p.photo_data
            else:
                # Prefer the thumb; fall back to full only when no thumb exists
                # and we couldn't backfill in budget.
                item["photo_data"] = _resolve_thumb(p) or p.photo_data
                item["is_thumb"] = item["photo_data"] is not p.photo_data
        items.append(item)

    for p, w in walk_rows:
        item = {
            "id": p.id,
            "kind": "walk",
            "activity_id": p.walk_id,
            "distance_marker_km": p.distance_marker_km,
            "lat": p.lat,
            "lng": p.lng,
            "caption": p.caption,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "activity": {
                "id": w.id,
                "kind": "walk",
                "distance_km": w.distance_km,
                "duration_seconds": w.duration_seconds,
                "started_at": _iso_utc(w.started_at),
                "completed_at": _iso_utc(w.ended_at),
                "run_type": None,
                "category": getattr(w, "category", None),
            },
        }
        if include_data:
            if full:
                item["photo_data"] = p.photo_data
            else:
                item["photo_data"] = _resolve_thumb(p) or p.photo_data
                item["is_thumb"] = item["photo_data"] is not p.photo_data
        items.append(item)

    # Persist any thumbnails we generated this request.
    try:
        db.commit()
    except Exception:
        db.rollback()

    items.sort(key=lambda x: x["created_at"] or "", reverse=True)
    items = items[:limit]

    next_cursor = items[-1]["created_at"] if len(items) == limit and items[-1]["created_at"] else None

    return {"items": items, "next_cursor": next_cursor}


@app.get("/me/photos/{kind}/{photo_id}/full")
def get_my_photo_full(
    kind: str,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return the full-resolution base64 ``photo_data`` for a single photo
    owned by the current user. Used by the Album detail viewer to upgrade the
    thumbnail to a sharp image on demand.
    """
    if kind == "run":
        p = (
            db.query(RunPhoto)
            .filter(RunPhoto.id == photo_id, RunPhoto.user_id == current_user.id)
            .first()
        )
    elif kind == "walk":
        p = (
            db.query(WalkPhoto)
            .filter(WalkPhoto.id == photo_id, WalkPhoto.user_id == current_user.id)
            .first()
        )
    else:
        raise HTTPException(status_code=400, detail="kind must be 'run' or 'walk'")
    if not p:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"id": p.id, "kind": kind, "photo_data": p.photo_data}


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
            "completed_at": _iso_utc(run.completed_at),
            "pace": pace,
            "mood": getattr(run, 'mood', None),
            "photo_count": run_photo_map.get(run.id, 0),
            "cover_photo": first_photo.photo_data if first_photo else None,
            # Polyline lets the journey view render the actual route + drop
            # photo markers along it. Null for runs without GPS.
            "route_polyline": getattr(run, 'route_polyline', None),
        })
    
    return result


# ==========================================
# 🚶 WALK ENDPOINTS
# ==========================================

def _walk_to_dict(walk: Walk, photo_count: int = 0, milestone_unlocks: Optional[list] = None) -> dict:
    return {
        "id": walk.id,
        "user_id": walk.user_id,
        "started_at": _iso_utc(walk.started_at),
        "ended_at": _iso_utc(walk.ended_at),
        "duration_seconds": walk.duration_seconds,
        "distance_km": walk.distance_km,
        "route_polyline": walk.route_polyline,
        "start_lat": walk.start_lat,
        "start_lng": walk.start_lng,
        "end_lat": walk.end_lat,
        "end_lng": walk.end_lng,
        "elevation_gain_m": walk.elevation_gain_m,
        "avg_pace_seconds_per_km": walk.avg_pace_seconds_per_km,
        "notes": walk.notes,
        "mood": walk.mood,
        "category": walk.category,
        "public_walk_id": walk.public_walk_id,
        "photo_count": photo_count,
        "milestone_unlocks": milestone_unlocks or [],
    }


@app.post("/walks")
def create_walk_endpoint(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Create a walk record from a completed walk session."""
    duration_seconds = payload.get("duration_seconds")
    distance_km = payload.get("distance_km")
    if duration_seconds is None or duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="duration_seconds is required and must be positive")
    if distance_km is None or distance_km < 0:
        raise HTTPException(status_code=400, detail="distance_km is required and must be non-negative")
    if distance_km > 200:
        raise HTTPException(status_code=400, detail="distance_km is unreasonably large")

    notes = payload.get("notes")
    if notes:
        notes = _sanitize_text(notes, max_length=500)

    started_at = payload.get("started_at")
    ended_at = payload.get("ended_at")
    from datetime import datetime as _dt
    started_at_dt = None
    ended_at_dt = None
    if started_at:
        try:
            started_at_dt = _dt.fromisoformat(started_at.replace("Z", "+00:00"))
        except Exception:
            started_at_dt = None
    if ended_at:
        try:
            ended_at_dt = _dt.fromisoformat(ended_at.replace("Z", "+00:00"))
        except Exception:
            ended_at_dt = None

    walk = crud.create_walk(
        db,
        user_id=current_user.id,
        duration_seconds=int(duration_seconds),
        distance_km=float(distance_km),
        started_at=started_at_dt,
        ended_at=ended_at_dt,
        route_polyline=payload.get("route_polyline"),
        start_lat=payload.get("start_lat"),
        start_lng=payload.get("start_lng"),
        end_lat=payload.get("end_lat"),
        end_lng=payload.get("end_lng"),
        elevation_gain_m=payload.get("elevation_gain_m"),
        notes=notes,
        mood=payload.get("mood"),
        category=payload.get("category"),
        public_walk_id=payload.get("public_walk_id"),
    )

    # 🌅 Journey auto-attribution (window-aware, with auto-complete on
    # reaching the target).
    _attach_to_active_journey(db, current_user.id, walk)

    milestones = _milestone_unlocks_after_activity(db, current_user)
    return _walk_to_dict(walk, milestone_unlocks=milestones)


@app.get("/walks")
def list_walks(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    walks = crud.get_walks(db, user_id=current_user.id, limit=min(limit, 200), offset=offset)
    walk_ids = [w.id for w in walks]
    photo_counts = {}
    if walk_ids:
        rows = (
            db.query(WalkPhoto.walk_id, func.count(WalkPhoto.id))
            .filter(WalkPhoto.walk_id.in_(walk_ids))
            .group_by(WalkPhoto.walk_id)
            .all()
        )
        photo_counts = {wid: count for wid, count in rows}
    return [_walk_to_dict(w, photo_counts.get(w.id, 0)) for w in walks]


@app.get("/walks/stats")
def walk_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    return crud.get_walk_stats(db, user_id=current_user.id)


@app.get("/walks/{walk_id}")
def get_walk_endpoint(
    walk_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    walk = crud.get_walk(db, walk_id=walk_id, user_id=current_user.id)
    if not walk:
        raise HTTPException(status_code=404, detail="Walk not found")
    photo_count = (
        db.query(func.count(WalkPhoto.id))
        .filter(WalkPhoto.walk_id == walk_id)
        .scalar()
    ) or 0
    return _walk_to_dict(walk, photo_count)


@app.put("/walks/{walk_id}")
def update_walk_endpoint(
    walk_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    notes = payload.get("notes")
    if notes is not None:
        notes = _sanitize_text(notes, max_length=500)
    walk = crud.update_walk(
        db,
        walk_id=walk_id,
        user_id=current_user.id,
        notes=notes,
        mood=payload.get("mood"),
        category=payload.get("category"),
    )
    if not walk:
        raise HTTPException(status_code=404, detail="Walk not found")
    return _walk_to_dict(walk)


@app.delete("/walks/{walk_id}")
def delete_walk_endpoint(
    walk_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    ok = crud.delete_walk(db, walk_id=walk_id, user_id=current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Walk not found")
    return {"message": "Walk deleted"}


# --- Walk Photos ---

@app.post("/walks/{walk_id}/photos")
def upload_walk_photo(
    walk_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    walk = crud.get_walk(db, walk_id=walk_id, user_id=current_user.id)
    if not walk:
        raise HTTPException(status_code=404, detail="Walk not found")

    existing_count = db.query(WalkPhoto).filter(WalkPhoto.walk_id == walk_id).count()
    if existing_count >= MAX_PHOTOS_PER_ACTIVITY:
        raise HTTPException(
            status_code=400,
            detail=f"This walk already has {MAX_PHOTOS_PER_ACTIVITY} photos (the per-walk limit).",
        )

    base64_data = payload.get("photo_data")
    if not base64_data:
        raise HTTPException(status_code=400, detail="photo_data is required")
    MAX_PHOTO_BYTES = 10 * 1024 * 1024
    if len(base64_data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Photo exceeds maximum size of 10MB")
    VALID_IMAGE_PREFIXES = ("/9j/", "iVBOR", "R0lGO", "UklGR", "data:image/")
    clean_data = base64_data.split(",", 1)[-1] if base64_data.startswith("data:") else base64_data
    if not any(clean_data.startswith(p) for p in VALID_IMAGE_PREFIXES) and not base64_data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image format")

    caption = payload.get("caption")
    if caption:
        caption = _sanitize_text(caption, max_length=200)

    photo = crud.create_walk_photo(
        db,
        walk_id=walk_id,
        user_id=current_user.id,
        photo_data=base64_data,
        thumb_data=_make_thumbnail_b64(base64_data),
        lat=payload.get("lat"),
        lng=payload.get("lng"),
        distance_marker_km=payload.get("distance_marker_km"),
        caption=caption,
    )
    return {
        "id": photo.id,
        "walk_id": photo.walk_id,
        # Mirror the list-response shape so the client can drop the new photo
        # straight into its list state without a refetch.
        "thumb_data": photo.thumb_data,
        "is_thumb": True,
        "lat": photo.lat,
        "lng": photo.lng,
        "distance_marker_km": photo.distance_marker_km,
        "caption": photo.caption,
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
    }


@app.get("/walks/{walk_id}/photos")
def list_walk_photos(
    walk_id: int,
    full: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """List a walk's photos.

    Response shape:
      - default: returns `thumb_data` (small base64 thumb). Used by carousel
        + grid on the walk detail. Lazily backfills missing thumbs in-place.
      - `?full=true`: returns full-resolution `photo_data` (legacy parity).
    """
    walk = crud.get_walk(db, walk_id=walk_id, user_id=current_user.id)
    if not walk:
        raise HTTPException(status_code=404, detail="Walk not found")
    photos = crud.get_walk_photos(db, walk_id=walk_id)

    if full:
        return [
            {
                "id": p.id,
                "walk_id": p.walk_id,
                "photo_data": p.photo_data,
                "lat": p.lat,
                "lng": p.lng,
                "distance_marker_km": p.distance_marker_km,
                "caption": p.caption,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in photos
        ]

    dirty = False
    items: list[dict] = []
    for p in photos:
        thumb = getattr(p, "thumb_data", None)
        if thumb is None:
            thumb = _make_thumbnail_b64(p.photo_data)
            if thumb:
                p.thumb_data = thumb
                dirty = True
        items.append({
            "id": p.id,
            "walk_id": p.walk_id,
            "thumb_data": thumb,
            "is_thumb": True,
            "lat": p.lat,
            "lng": p.lng,
            "distance_marker_km": p.distance_marker_km,
            "caption": p.caption,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    if dirty:
        try:
            db.commit()
        except Exception:
            db.rollback()
    return items


@app.get("/walks/{walk_id}/photos/{photo_id}/full")
def get_walk_photo_full(
    walk_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return one walk photo's full-resolution base64 on demand."""
    walk = crud.get_walk(db, walk_id=walk_id, user_id=current_user.id)
    if not walk:
        raise HTTPException(status_code=404, detail="Walk not found")
    p = db.query(WalkPhoto).filter(WalkPhoto.id == photo_id, WalkPhoto.walk_id == walk_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {
        "id": p.id,
        "walk_id": p.walk_id,
        "photo_data": p.photo_data,
        "lat": p.lat,
        "lng": p.lng,
        "distance_marker_km": p.distance_marker_km,
        "caption": p.caption,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@app.delete("/walks/{walk_id}/photos/{photo_id}")
def delete_walk_photo_endpoint(
    walk_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    ok = crud.delete_walk_photo(db, photo_id=photo_id, walk_id=walk_id, user_id=current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"message": "Photo deleted"}


@app.put("/walks/{walk_id}/photos/{photo_id}")
def update_walk_photo(
    walk_id: int,
    photo_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Update editable fields on a walk photo. Currently: caption."""
    walk = crud.get_walk(db, walk_id=walk_id, user_id=current_user.id)
    if not walk:
        raise HTTPException(status_code=404, detail="Walk not found")
    photo = db.query(WalkPhoto).filter(
        WalkPhoto.id == photo_id,
        WalkPhoto.walk_id == walk_id,
        WalkPhoto.user_id == current_user.id,
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if "caption" in payload:
        new_caption = payload.get("caption")
        if new_caption is None or new_caption == "":
            photo.caption = None
        else:
            photo.caption = _sanitize_text(str(new_caption), max_length=200)
    db.commit()
    db.refresh(photo)
    return {
        "id": photo.id,
        "walk_id": photo.walk_id,
        "lat": photo.lat,
        "lng": photo.lng,
        "distance_marker_km": photo.distance_marker_km,
        "caption": photo.caption,
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
    }


# --- Public Walks (Overpass / OpenStreetMap powered) ---

from services import overpass  # noqa: E402


def _serialize_public_walk(w: PublicWalk) -> dict:
    return {
        "id": w.id,
        "osm_id": w.osm_id,
        "name": w.name,
        "description": w.description,
        "distance_km": w.distance_km,
        "estimated_duration_min": w.estimated_duration_min,
        "difficulty": w.difficulty,
        "route_polyline": w.route_polyline,
        "start_lat": w.start_lat,
        "start_lng": w.start_lng,
        "region": w.region,
        "country": w.country,
        "tags": w.tags,
        "source": w.source,
    }


@app.get("/public-walks")
def list_public_walks(
    region: Optional[str] = None,
    country: Optional[str] = None,
    difficulty: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 15.0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    walks = crud.get_public_walks(
        db, region=region, country=country, difficulty=difficulty, limit=min(limit, 200)
    )
    serialized = [_serialize_public_walk(w) for w in walks]

    # If the caller passed a location, sort by proximity and filter within
    # the requested radius so results are locally relevant.
    if lat is not None and lng is not None:
        for w in serialized:
            w["distance_from_user_km"] = round(
                overpass.haversine_km((lat, lng), (w["start_lat"], w["start_lng"])), 2
            )
        serialized = [w for w in serialized if w["distance_from_user_km"] <= radius_km]
        serialized.sort(key=lambda w: w["distance_from_user_km"])

    return serialized


@app.post("/public-walks/discover")
def discover_public_walks_endpoint(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Refresh the public-walk cache around a (lat,lng) using Overpass.

    Returns the freshly cached walks sorted by distance from the user.
    Falls back to whatever is already cached on Overpass failure.
    """
    try:
        lat = float(payload.get("lat"))
        lng = float(payload.get("lng"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="lat/lng required")

    radius_km = float(payload.get("radius_km") or 10.0)
    radius_km = max(1.0, min(radius_km, 30.0))
    limit = int(payload.get("limit") or 25)
    limit = max(1, min(limit, 50))

    fetched = overpass.discover_public_walks(lat=lat, lng=lng, radius_km=radius_km, limit=limit)
    cached: List[dict] = []
    for w in fetched:
        try:
            row = crud.upsert_public_walk(
                db,
                osm_id=w["osm_id"],
                name=w["name"],
                distance_km=w["distance_km"],
                route_polyline=w["route_polyline"],
                start_lat=w["start_lat"],
                start_lng=w["start_lng"],
                description=w.get("description"),
                estimated_duration_min=w.get("estimated_duration_min"),
                difficulty=w.get("difficulty"),
                region=w.get("region"),
                country=w.get("country"),
                tags=w.get("tags"),
                source=w.get("source") or "osm",
            )
            cached.append(_serialize_public_walk(row))
        except Exception:  # noqa: BLE001
            db.rollback()
            continue

    # Always merge in already-cached nearby walks so the user sees something
    # even when Overpass returns nothing new.
    existing = [_serialize_public_walk(x) for x in crud.get_public_walks(db, limit=200)]
    merged = {w["id"]: w for w in cached}
    for w in existing:
        if w["id"] not in merged:
            merged[w["id"]] = w

    out = list(merged.values())
    for w in out:
        w["distance_from_user_km"] = round(
            overpass.haversine_km((lat, lng), (w["start_lat"], w["start_lng"])), 2
        )
    out = [w for w in out if w["distance_from_user_km"] <= radius_km]
    out.sort(key=lambda w: w["distance_from_user_km"])
    return {"refreshed": len(cached), "walks": out[:limit]}


@app.get("/public-walks/{walk_id}")
def get_public_walk_endpoint(
    walk_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    w = crud.get_public_walk(db, walk_id=walk_id)
    if not w:
        raise HTTPException(status_code=404, detail="Public walk not found")
    return _serialize_public_walk(w)


# ==========================================
# 🧠 COACH ENDPOINTS  (Phase 0)
# ==========================================
#
# All coach endpoints require coach_enabled=true on the user (set via the
# opt-in screen), except for the settings GET and the opt-in POST itself.
#
# When the LLM client is in stub mode (no ANTHROPIC_API_KEY), responses
# are still produced but flagged with is_stub=true so the frontend can
# surface a "running in eval mode" hint.


def _require_coach_enabled(user: User):
    if not getattr(user, "coach_enabled", False):
        raise HTTPException(
            status_code=403,
            detail="Guide is not enabled for this account. Opt in from Profile → Guide.",
        )


def _coach_settings_response(user: User) -> CoachSettings:
    return CoachSettings(
        coach_enabled=bool(getattr(user, "coach_enabled", False)),
        coach_notes_auto=bool(getattr(user, "coach_notes_auto", True)),
        coach_today_card=bool(getattr(user, "coach_today_card", True)),
        coach_voice_during_runs=getattr(user, "coach_voice_during_runs", "coach_runs") or "coach_runs",
        coach_consent_at=getattr(user, "coach_consent_at", None),
    )


@app.get("/coach/settings", response_model=CoachSettings)
def get_coach_settings(
    current_user: User = Depends(require_auth),
):
    """Return the current user's coach settings."""
    return _coach_settings_response(current_user)


@app.put("/coach/settings", response_model=CoachSettings)
def update_coach_settings(
    payload: CoachSettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Update coach toggles. Cannot enable the coach here — use /coach/opt-in."""
    if payload.coach_voice_during_runs not in {"all", "coach_runs", "journeys_only", "off"}:
        raise HTTPException(status_code=400, detail="Invalid coach_voice_during_runs value")
    current_user.coach_notes_auto = bool(payload.coach_notes_auto)
    current_user.coach_today_card = bool(payload.coach_today_card)
    current_user.coach_voice_during_runs = payload.coach_voice_during_runs
    db.commit()
    db.refresh(current_user)
    return _coach_settings_response(current_user)


@app.post("/coach/opt-in", response_model=CoachSettings)
def opt_in_coach(
    payload: CoachOptInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Enable the coach for this account. The screen explains data access."""
    if not payload.accepted:
        raise HTTPException(status_code=400, detail="accepted must be true to opt in")
    from datetime import datetime as _dt
    current_user.coach_enabled = True
    if not getattr(current_user, "coach_consent_at", None):
        current_user.coach_consent_at = _dt.utcnow()
    db.commit()
    db.refresh(current_user)
    return _coach_settings_response(current_user)


@app.delete("/coach/opt-in")
def opt_out_coach(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Disable the coach. Notes and history are kept (read-only) on existing runs."""
    current_user.coach_enabled = False
    db.commit()
    return {"coach_enabled": False}


# ----- Coach's note (Phase 1) -------------------------------------------------

@app.get("/coach/run-note/{run_id}", response_model=CoachNote)
@limiter.limit("30/minute")
def get_run_coach_note(
    request: Request,
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return (or generate-and-cache) the Coach's note for a run."""
    _require_coach_enabled(current_user)
    run = crud.get_run(db, run_id=run_id)
    if not run or run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    if not run.coach_note:
        try:
            text_out = coach.generate_run_note(db, current_user, run=run)
        except Exception as exc:  # noqa: BLE001
            logger.exception("coach run-note failed: %s", exc)
            raise HTTPException(status_code=502, detail="Coach unavailable")
        from datetime import datetime as _dt
        run.coach_note = text_out
        run.coach_note_generated_at = _dt.utcnow()
        db.commit()
    return CoachNote(
        activity_type="run",
        activity_id=run.id,
        text=run.coach_note,
        generated_at=run.coach_note_generated_at,
        is_stub=not llm.is_live(),
    )


@app.get("/coach/walk-note/{walk_id}", response_model=CoachNote)
@limiter.limit("30/minute")
def get_walk_coach_note(
    request: Request,
    walk_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return (or generate-and-cache) the Coach's note for a walk."""
    _require_coach_enabled(current_user)
    walk = db.query(Walk).filter(Walk.id == walk_id, Walk.user_id == current_user.id).first()
    if not walk:
        raise HTTPException(status_code=404, detail="Walk not found")
    if not walk.coach_note:
        try:
            text_out = coach.generate_run_note(db, current_user, walk=walk)
        except Exception as exc:  # noqa: BLE001
            logger.exception("coach walk-note failed: %s", exc)
            raise HTTPException(status_code=502, detail="Coach unavailable")
        from datetime import datetime as _dt
        walk.coach_note = text_out
        walk.coach_note_generated_at = _dt.utcnow()
        db.commit()
    return CoachNote(
        activity_type="walk",
        activity_id=walk.id,
        text=walk.coach_note,
        generated_at=walk.coach_note_generated_at,
        is_stub=not llm.is_live(),
    )


# ----- Today's recommendation (Phase 2) ---------------------------------------

@app.get("/coach/today-card", response_model=CoachTodayCardResponse)
@limiter.limit("60/hour")
def get_today_card(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """One-line recommendation for the Home card. Cached per user-day."""
    _require_coach_enabled(current_user)
    if not getattr(current_user, "coach_today_card", True):
        raise HTTPException(status_code=404, detail="Today card disabled in coach settings")
    from datetime import datetime as _dt
    day_iso = _dt.utcnow().strftime("%Y-%m-%d")
    cached = (
        db.query(CoachTodayCard)
        .filter(CoachTodayCard.user_id == current_user.id, CoachTodayCard.day_iso == day_iso)
        .first()
    )
    if cached:
        return CoachTodayCardResponse(
            text=cached.text,
            generated_at=cached.created_at,
            is_stub=not llm.is_live(),
        )
    try:
        text_out = coach.generate_today_card(db, current_user)
    except Exception as exc:  # noqa: BLE001
        logger.exception("coach today-card failed: %s", exc)
        raise HTTPException(status_code=502, detail="Coach unavailable")
    row = CoachTodayCard(user_id=current_user.id, day_iso=day_iso, text=text_out)
    db.add(row)
    db.commit()
    db.refresh(row)
    return CoachTodayCardResponse(
        text=row.text,
        generated_at=row.created_at,
        is_stub=not llm.is_live(),
    )


# ----- Open chat (Phase 3) ----------------------------------------------------

@app.post("/coach/chat", response_model=CoachChatResponse)
@limiter.limit("20/minute")
def coach_chat(
    request: Request,
    payload: CoachChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Single-turn chat. History is server-managed."""
    _require_coach_enabled(current_user)
    user_text = _sanitize_text(payload.message, max_length=2000).strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    prior = (
        db.query(CoachMessage)
        .filter(CoachMessage.user_id == current_user.id)
        .order_by(CoachMessage.created_at.desc())
        .limit(10)
        .all()
    )
    prior.reverse()
    history = [{"role": m.role, "content": m.content} for m in prior]

    try:
        reply_text = coach.chat(
            db,
            current_user,
            user_message=user_text,
            history=history,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("coach chat failed: %s", exc)
        raise HTTPException(status_code=502, detail="Coach unavailable")

    db.add(CoachMessage(user_id=current_user.id, role="user", content=user_text))
    db.add(CoachMessage(user_id=current_user.id, role="assistant", content=reply_text))
    db.commit()

    refreshed = (
        db.query(CoachMessage)
        .filter(CoachMessage.user_id == current_user.id)
        .order_by(CoachMessage.created_at.desc())
        .limit(10)
        .all()
    )
    refreshed.reverse()

    return CoachChatResponse(
        reply=reply_text,
        history=[
            CoachChatTurn(role=m.role, content=m.content, created_at=m.created_at)
            for m in refreshed
        ],
        is_stub=not llm.is_live(),
    )


@app.get("/coach/chat/history", response_model=List[CoachChatTurn])
def coach_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return the recent chat history (last 20 turns)."""
    _require_coach_enabled(current_user)
    rows = (
        db.query(CoachMessage)
        .filter(CoachMessage.user_id == current_user.id)
        .order_by(CoachMessage.created_at.desc())
        .limit(20)
        .all()
    )
    rows.reverse()
    return [CoachChatTurn(role=r.role, content=r.content, created_at=r.created_at) for r in rows]


@app.delete("/coach/chat/history")
def coach_chat_clear(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Wipe chat history for the current user."""
    db.query(CoachMessage).filter(CoachMessage.user_id == current_user.id).delete()
    db.commit()
    return {"cleared": True}


# ----- In-run companion script (Phase 4) --------------------------------------

@app.post("/coach/run-script", response_model=CoachRunScriptResponse)
@limiter.limit("30/hour")
def create_run_script(
    request: Request,
    payload: CoachRunScriptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Pre-generate the in-run companion script for a planned activity.

    Called by the client at run-start (after route confirm). The client
    caches the returned lines locally and plays them via TTS as the run
    progresses. Server caches every script for resume / debugging.
    """
    _require_coach_enabled(current_user)
    activity = payload.activity if payload.activity in {
        "outdoor_run", "treadmill", "walk", "journey"
    } else "outdoor_run"

    plan = _sanitize_text(payload.plan_summary, max_length=400)

    # 🌅 If the user has an active journey within window, this run is
    # going to auto-attach to it — make the script journey-aware. We
    # promote the activity layer to "journey" and prepend a journey
    # progress line to the plan summary so the LLM mentions it.
    active_journey = _get_active_journey(db, current_user.id)
    if active_journey is not None:
        expires = _journey_expires_at(active_journey)
        within_window = expires is None or datetime.utcnow() <= expires
        if within_window:
            progress = _journey_progress(db, active_journey)
            accumulated = float(progress.get("accumulated_km", 0.0))
            target = float(active_journey.target_distance_km or 0.0)
            remaining = max(0.0, target - accumulated)
            journey_prefix = (
                f"This run will count toward the active journey "
                f"\"{active_journey.name}\" ({active_journey.tier}): "
                f"{accumulated:.1f} of {target:.0f} km accumulated, "
                f"{remaining:.1f} km still to go. "
            )
            plan = (journey_prefix + (plan or "")).strip()
            # Walks during a journey keep the walk activity layer (the
            # walking guidance still applies); runs flip to "journey"
            # which explicitly invites journey-shaped pacing.
            if activity in ("outdoor_run", "treadmill"):
                activity = "journey"

    try:
        lines = coach.generate_run_script(
            db,
            current_user,
            plan_summary=plan,
            target_distance_km=payload.target_distance_km,
            activity=activity,
            route_landmarks=payload.route_landmarks,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("coach run-script failed: %s", exc)
        raise HTTPException(status_code=502, detail="Coach unavailable")

    row = CoachRunScript(
        user_id=current_user.id,
        activity=activity,
        target_distance_km=payload.target_distance_km,
        plan_summary=plan,
        lines_json=json.dumps(lines),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return CoachRunScriptResponse(
        id=row.id,
        activity=row.activity,
        target_distance_km=row.target_distance_km,
        plan_summary=row.plan_summary,
        lines=[CoachRunScriptLine(**ln) for ln in lines],
        created_at=row.created_at,
        is_stub=not llm.is_live(),
    )


@app.get("/coach/run-script/{script_id}", response_model=CoachRunScriptResponse)
def get_run_script(
    script_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Re-fetch a previously generated script (e.g. on app resume mid-run)."""
    row = (
        db.query(CoachRunScript)
        .filter(CoachRunScript.id == script_id, CoachRunScript.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Run script not found")
    try:
        lines = json.loads(row.lines_json)
    except (json.JSONDecodeError, TypeError):
        lines = []
    return CoachRunScriptResponse(
        id=row.id,
        activity=row.activity,
        target_distance_km=row.target_distance_km,
        plan_summary=row.plan_summary,
        lines=[CoachRunScriptLine(**ln) for ln in lines if isinstance(ln, dict)],
        created_at=row.created_at,
        is_stub=not llm.is_live(),
    )


@app.get("/coach/journey-suggestions", response_model=List[JourneyTemplate])
def get_journey_suggestions(
    tier: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return 0–2 bespoke journey ideas tailored to the user, for the
    Start Journey picker. Falls back to an empty list when the Guide is
    off, in stub mode, or the LLM returns invalid output. The static
    template list always lives below these.
    """
    if tier not in JOURNEY_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"tier must be one of: {list(JOURNEY_TIERS.keys())}",
        )
    if not getattr(current_user, "coach_enabled", False):
        return []
    try:
        items = coach.generate_journey_suggestions(
            db,
            current_user,
            tier=tier,
            target_distance_km=JOURNEY_TIERS[tier],
        )
    except Exception as exc:  # pragma: no cover
        print(f"[guide] journey suggestions failed for {tier}: {exc}")
        return []
    return [JourneyTemplate(**item) for item in items]


# ==========================================
# 🌅 JOURNEY ENDPOINTS  (the slow ultra)
# ==========================================


def _journey_progress(db: Session, journey: Journey) -> dict:
    """Sum the contributing run+walk distances for a journey.

    Returns the accumulated km, activity count, and number of distinct
    days the user has worked on the journey. The journey is "completed"
    when accumulated_km >= target_distance_km, but we leave the status
    transition to the explicit POST /journeys/{id}/complete endpoint.
    """
    run_rows = (
        db.query(Run.distance_km, Run.completed_at)
        .filter(Run.journey_id == journey.id, Run.user_id == journey.user_id)
        .all()
    )
    walk_rows = (
        db.query(Walk.distance_km, Walk.ended_at)
        .filter(Walk.journey_id == journey.id, Walk.user_id == journey.user_id)
        .all()
    )
    distances = [float(r[0] or 0.0) for r in run_rows] + [float(w[0] or 0.0) for w in walk_rows]
    accumulated_km = sum(distances)
    activity_count = len(distances)

    days = set()
    for _, ts in run_rows:
        if ts is not None:
            days.add(ts.date().isoformat())
    for _, ts in walk_rows:
        if ts is not None:
            days.add(ts.date().isoformat())
    days_active = len(days) or (1 if journey.started_at else 0)

    return {
        "accumulated_km": round(accumulated_km, 2),
        "activity_count": activity_count,
        "days_active": days_active,
    }


def _journey_expires_at(journey: Journey) -> Optional[datetime]:
    """Return the deadline for journey attribution (started_at + max_days).

    Calendar-day style: a 1-day journey started Monday 09:00 expires at
    Monday 23:59:59. A 3-day journey started Monday expires at Wed 23:59:59.
    """
    if not journey.started_at or not journey.max_days:
        return None
    start = journey.started_at
    # End of (started_at + max_days - 1) calendar day.
    end_day = (start + timedelta(days=int(journey.max_days) - 1)).date()
    return datetime.combine(end_day, datetime.max.time())


def _journey_to_response(db: Session, journey: Journey) -> JourneyResponse:
    # Planned journeys haven't started attributing yet — skip the progress
    # query (and keep accumulated_km at 0) so we don't waste DB roundtrips.
    if journey.status == "planned":
        progress = {"accumulated_km": 0.0, "activity_count": 0, "days_active": 0}
    else:
        progress = _journey_progress(db, journey)
    target = float(journey.target_distance_km or 0.0)
    pct = (progress["accumulated_km"] / target * 100.0) if target > 0 else 0.0
    expires_at = _journey_expires_at(journey) if journey.status == "active" else None
    is_expired = expires_at is not None and datetime.utcnow() > expires_at

    # Decode the prep checklist (stored as JSON array of short strings).
    checklist: List[str] = []
    raw_checklist = getattr(journey, "prep_checklist_json", None)
    if raw_checklist:
        try:
            decoded = json.loads(raw_checklist)
            if isinstance(decoded, list):
                checklist = [str(x) for x in decoded if isinstance(x, str)][:12]
        except (json.JSONDecodeError, ValueError):
            checklist = []

    scheduled = getattr(journey, "scheduled_for", None)
    scheduled_iso = scheduled.date().isoformat() if scheduled else None

    return JourneyResponse(
        id=journey.id,
        name=journey.name,
        tier=journey.tier,
        target_distance_km=journey.target_distance_km,
        max_days=int(journey.max_days or 1),
        status=journey.status,
        plan_summary=journey.plan_summary,
        notes=journey.notes,
        completion_note=journey.completion_note,
        readiness_note=getattr(journey, "readiness_note", None),
        prep_checklist=checklist,
        scheduled_for=scheduled_iso,
        activated_at=getattr(journey, "activated_at", None),
        started_at=journey.started_at,
        completed_at=journey.completed_at,
        accumulated_km=progress["accumulated_km"],
        progress_percent=round(min(pct, 999.0), 1),
        activity_count=progress["activity_count"],
        days_active=progress["days_active"],
        expires_at=expires_at,
        is_expired=is_expired,
    )


def _get_active_journey(db: Session, user_id: int) -> Optional[Journey]:
    return (
        db.query(Journey)
        .filter(Journey.user_id == user_id, Journey.status == "active")
        .order_by(Journey.started_at.desc())
        .first()
    )


def _attach_to_active_journey(db: Session, user_id: int, activity) -> Optional[Journey]:
    """Attach a freshly-created run or walk to the user's active journey if
    it's still within its max_days window. Returns the journey if attached,
    None otherwise. Auto-completes the journey when the running total
    reaches the target."""
    journey = _get_active_journey(db, user_id)
    if journey is None:
        return None
    expires_at = _journey_expires_at(journey)
    if expires_at is not None and datetime.utcnow() > expires_at:
        # Window closed — don't attribute. The journey stays "active" so
        # the user can still mark it complete or abandoned.
        return None
    activity.journey_id = journey.id
    db.commit()
    db.refresh(activity)

    # 🌅 If we just rolled into a new day on a multi-day journey, ensure
    # today's brief is generated. Best-effort.
    _try_generate_journey_day_brief(db, journey)

    # Re-sum and auto-complete if we crossed the target.
    progress = _journey_progress(db, journey)
    if progress["accumulated_km"] >= float(journey.target_distance_km or 0.0):
        journey.status = "completed"
        journey.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(journey)
        # Fire the Guide debrief. Soft-fail: a missing key or LLM error
        # just leaves completion_note NULL — the JourneyDetail screen
        # then shows the regular "Completed" header with no extra text.
        _try_generate_journey_completion_note(db, journey)
    return journey


def _try_generate_journey_day_brief(db: Session, journey: Journey) -> None:
    """If today is day N (>1) of a multi-day journey and no brief exists
    for that day yet, generate one. Best-effort, opt-in gated.

    Called from the activity-attribution path so the brief is ready by
    the time the runner opens the JourneyActiveCard.
    """
    if journey.status != "active":
        return
    if (journey.max_days or 1) <= 1:
        return  # one-go journeys don't get a daily brief
    started = journey.started_at
    if not started:
        return
    today = datetime.utcnow().date()
    day_index = max(1, (today - started.date()).days + 1)
    if day_index > int(journey.max_days):
        return  # window has closed
    if day_index <= 1:
        # Day 1 brief is just the prep note — skip the auto-brief here.
        return

    existing = (
        db.query(JourneyDayBrief)
        .filter(
            JourneyDayBrief.journey_id == journey.id,
            JourneyDayBrief.day_index == day_index,
        )
        .first()
    )
    if existing is not None:
        return

    user = db.query(User).filter(User.id == journey.user_id).first()
    if user is None or not getattr(user, "coach_enabled", False):
        return

    try:
        text = coach.generate_journey_day_brief(db, user, journey, day_index=day_index)
    except Exception as exc:  # pragma: no cover
        print(f"[guide] day brief failed for journey {journey.id} day {day_index}: {exc}")
        return
    if not text:
        return
    brief = JourneyDayBrief(
        journey_id=journey.id,
        user_id=journey.user_id,
        day_index=day_index,
        text=text,
        is_stub=not llm.is_live(),
    )
    db.add(brief)
    db.commit()


def _try_generate_journey_completion_note(db: Session, journey: Journey) -> None:
    """Generate and persist a Guide debrief on a just-completed journey.

    Skips silently if the user hasn't opted into the Guide, or if the
    LLM call fails. Best-effort only.
    """
    if journey.status != "completed":
        return
    if journey.completion_note:
        return  # already written
    user = db.query(User).filter(User.id == journey.user_id).first()
    if user is None or not getattr(user, "coach_enabled", False):
        return
    try:
        text = coach.generate_journey_completion_note(db, user, journey)
    except Exception as exc:  # pragma: no cover
        # The Guide failing is never blocking. Log and move on.
        print(f"[guide] journey completion note failed for journey {journey.id}: {exc}")
        return
    if text:
        journey.completion_note = text
        db.commit()
        db.refresh(journey)


# Static templates. Each tier gets a couple of starter framings — the
# 20k/30k tiers are one-go adventures, 50k/60k/75k/100k are 2–3 day windows.
_JOURNEY_TEMPLATES: List[JourneyTemplate] = [
    # ── 20k — one-go ──
    JourneyTemplate(
        tier="20k",
        name="The slow twenty",
        blurb="20 km in one go. Walk, run, stop for coffee. Photos welcome.",
        target_distance_km=20.0,
    ),
    JourneyTemplate(
        tier="20k",
        name="Twenty in your neighbourhood",
        blurb="A 20 km loop on home turf. Streets you know, seen for a long time.",
        target_distance_km=20.0,
    ),
    # ── 30k — one-go ──
    JourneyTemplate(
        tier="30k",
        name="The slow thirty",
        blurb="30 km, one big day. Slower than a marathon, longer than a long run.",
        target_distance_km=30.0,
    ),
    # ── 50k — up to 3 days ──
    JourneyTemplate(
        tier="50k",
        name="A weekend fifty",
        blurb="50 km across the weekend. Two big efforts or three softer ones.",
        target_distance_km=50.0,
    ),
    # ── 60k — up to 3 days ──
    JourneyTemplate(
        tier="60k",
        name="The unhurried sixty",
        blurb="60 km across two or three days. A long weekend, a steady pace.",
        target_distance_km=60.0,
    ),
    # ── 75k — up to 3 days ──
    JourneyTemplate(
        tier="75k",
        name="Three-day seventy-five",
        blurb="75 km across three days. 25 km a day if you spread it evenly.",
        target_distance_km=75.0,
    ),
    # ── 100k — up to 3 days ──
    JourneyTemplate(
        tier="100k",
        name="The slow hundred",
        blurb="100 km in three days. The proper slow ultra. Sleep matters.",
        target_distance_km=100.0,
    ),
]


@app.get("/journeys/templates", response_model=List[JourneyTemplate])
def list_journey_templates(current_user: User = Depends(require_auth)):
    """Starter Journey suggestions, grouped by tier (20k → 100k)."""
    return _JOURNEY_TEMPLATES


@app.post("/journeys", response_model=JourneyResponse)
def create_journey(
    payload: JourneyCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Plan a new journey, or start one immediately.

    Default behaviour: creates the journey in `planned` state so the user
    can prep, schedule, and start when ready (the new flow). Pass
    `as_planned=False` to flip straight to `active` (the legacy "start
    now" path used when the user is ready right away).

    A user can hold many planned journeys + one active. Trying to start
    a second active journey raises 409.
    """
    if payload.tier not in JOURNEY_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"tier must be one of: {list(JOURNEY_TIERS.keys())}",
        )
    # Only one active per user; planned journeys can stack freely.
    if not payload.as_planned and _get_active_journey(db, current_user.id) is not None:
        raise HTTPException(
            status_code=409,
            detail="You already have an active journey. Complete or abandon it first.",
        )

    name = _sanitize_text(payload.name, max_length=120)
    plan = _sanitize_text(payload.plan_summary, max_length=400) if payload.plan_summary else None

    # Optional Guide-generated content forwarded from the preview screen.
    # We sanitise here so the same trust assumptions apply as for any user
    # text. The preview endpoint produced these — this just persists them.
    readiness_note = (
        _sanitize_text(payload.readiness_note, max_length=600)
        if payload.readiness_note
        else None
    )
    checklist_items: List[str] = []
    if payload.prep_checklist:
        for raw_item in payload.prep_checklist[:12]:
            if not isinstance(raw_item, str):
                continue
            cleaned = _sanitize_text(raw_item, max_length=120)
            if cleaned:
                checklist_items.append(cleaned)

    scheduled_dt: Optional[datetime] = _parse_iso_date(payload.scheduled_for)

    status = "planned" if payload.as_planned else "active"
    activated_at = None if payload.as_planned else datetime.utcnow()

    journey = Journey(
        user_id=current_user.id,
        name=name,
        tier=payload.tier,
        target_distance_km=JOURNEY_TIERS[payload.tier],
        max_days=JOURNEY_TIER_MAX_DAYS.get(payload.tier, 1),
        status=status,
        plan_summary=plan,
        readiness_note=readiness_note,
        prep_checklist_json=json.dumps(checklist_items) if checklist_items else None,
        scheduled_for=scheduled_dt,
        activated_at=activated_at,
    )
    db.add(journey)
    db.commit()
    db.refresh(journey)

    # 🌅 For 50k+ tiers, the Guide writes a one-time prep note (water,
    # food, layers, plaster, fallback). Stored on plan_summary if the
    # user didn't provide one of their own. Best-effort, opt-in gated.
    if not journey.plan_summary and payload.tier in {"50k", "60k", "75k", "100k"}:
        _try_generate_journey_prep_note(db, journey, current_user)

    return _journey_to_response(db, journey)


def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO `YYYY-MM-DD` date string into a midnight-UTC datetime.

    Tolerates full ISO datetimes too (the frontend may send either). Any
    parse failure quietly returns None so the create endpoint isn't
    derailed by a malformed schedule field.
    """
    if not value:
        return None
    try:
        # Accept either bare date or full datetime.
        if "T" in value:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        y, m, d = value.split("-")
        return datetime(int(y), int(m), int(d))
    except (ValueError, IndexError):
        return None


def _try_generate_journey_prep_note(
    db: Session, journey: Journey, user: User
) -> None:
    """Generate and persist a Guide prep note for a fresh 50k+ journey."""
    if not getattr(user, "coach_enabled", False):
        return
    try:
        text = coach.generate_journey_prep_note(db, user, journey)
    except Exception as exc:  # pragma: no cover
        print(f"[guide] prep note failed for journey {journey.id}: {exc}")
        return
    if text:
        journey.plan_summary = text
        db.commit()
        db.refresh(journey)


@app.get("/journeys", response_model=List[JourneyResponse])
def list_journeys(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """All journeys for the current user, newest first."""
    journeys = (
        db.query(Journey)
        .filter(Journey.user_id == current_user.id)
        .order_by(Journey.started_at.desc())
        .all()
    )
    return [_journey_to_response(db, j) for j in journeys]


@app.get("/journeys/active", response_model=Optional[JourneyResponse])
def get_active_journey(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Return the user's currently active journey, or null if none."""
    j = _get_active_journey(db, current_user.id)
    if j is None:
        return None
    return _journey_to_response(db, j)


@app.get("/journeys/{journey_id}", response_model=JourneyResponse)
def get_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id, Journey.user_id == current_user.id)
        .first()
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    return _journey_to_response(db, journey)


@app.patch("/journeys/{journey_id}", response_model=JourneyResponse)
def update_journey(
    journey_id: int,
    payload: JourneyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id, Journey.user_id == current_user.id)
        .first()
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if payload.name is not None:
        journey.name = _sanitize_text(payload.name, max_length=120)
    if payload.notes is not None:
        journey.notes = _sanitize_text(payload.notes, max_length=2000)
    db.commit()
    db.refresh(journey)
    return _journey_to_response(db, journey)


@app.post("/journeys/preview", response_model=JourneyPreviewResponse)
def preview_journey(
    payload: JourneyPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Generate the JourneyPreview payload for a candidate journey.

    Read-only — nothing is persisted. The frontend renders the response
    on `JourneyPreviewScreen`, then sends the same content back via
    `POST /journeys` if the user commits.

    For Guide-disabled users (or stub mode) the response still includes
    a generic readiness line and a fallback checklist so the preview
    screen always has something to render.
    """
    if payload.tier not in JOURNEY_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"tier must be one of: {list(JOURNEY_TIERS.keys())}",
        )
    target = JOURNEY_TIERS[payload.tier]
    max_days = JOURNEY_TIER_MAX_DAYS.get(payload.tier, 1)
    name = _sanitize_text(payload.name, max_length=120) or _default_name_for_tier(payload.tier)
    blurb = _sanitize_text(payload.blurb, max_length=400) if payload.blurb else None

    # Plan summary: prefer the blurb the user picked from the suggestion
    # card. Fall back to a one-line description of the tier so the preview
    # never reads as empty.
    plan_summary = blurb or _default_blurb_for_tier(payload.tier)

    # Readiness + checklist — Guide-aware when opted in, fallback otherwise.
    is_stub = False
    readiness_note = ""
    checklist: List[str] = []

    if getattr(current_user, "coach_enabled", False):
        try:
            readiness_note = coach.generate_journey_readiness(
                db,
                current_user,
                tier=payload.tier,
                target_distance_km=target,
                name=name,
            )
        except Exception as exc:  # pragma: no cover
            print(f"[guide] readiness preview failed for {payload.tier}: {exc}")
        try:
            checklist = coach.generate_journey_prep_checklist(
                db,
                current_user,
                tier=payload.tier,
                target_distance_km=target,
                name=name,
            )
        except Exception as exc:  # pragma: no cover
            print(f"[guide] checklist preview failed for {payload.tier}: {exc}")
        is_stub = not llm.is_live()
    else:
        is_stub = True

    if not readiness_note:
        readiness_note = _fallback_readiness_note(payload.tier)
    if not checklist:
        checklist = coach._fallback_prep_checklist(payload.tier)

    suggested = _suggest_scheduled_for(payload.tier).date().isoformat()

    return JourneyPreviewResponse(
        tier=payload.tier,
        target_distance_km=target,
        max_days=max_days,
        name=name,
        plan_summary=plan_summary,
        readiness_note=readiness_note,
        prep_checklist=checklist,
        suggested_scheduled_for=suggested,
        is_stub=is_stub,
    )


def _default_name_for_tier(tier: str) -> str:
    return {
        "20k": "The slow twenty",
        "30k": "The slow thirty",
        "50k": "A weekend fifty",
        "60k": "The unhurried sixty",
        "75k": "Three-day seventy-five",
        "100k": "The slow hundred",
    }.get(tier, f"The {tier} journey")


def _default_blurb_for_tier(tier: str) -> str:
    return {
        "20k": "20 km in one go. Walk, run, stop for coffee. Photos welcome.",
        "30k": "30 km, one big day. Slower than a marathon, longer than a long run.",
        "50k": "50 km across the weekend. Two big efforts or three softer ones.",
        "60k": "60 km across two or three days. A long weekend, a steady pace.",
        "75k": "75 km across three days. 25 km a day if you spread it evenly.",
        "100k": "100 km in three days. The proper slow ultra. Sleep matters.",
    }.get(tier, f"A {tier} adventure on your own terms.")


def _fallback_readiness_note(tier: str) -> str:
    """Used when the Guide is off / in stub mode. Keeps the screen full."""
    if tier in ("20k", "30k"):
        return (
            "One big day on your feet. Pace it like a long walk with running "
            "in the middle, not a race."
        )
    return (
        "A multi-day journey. The first day sets the tone — start softer than "
        "feels right, eat earlier than you think you need."
    )


def _suggest_scheduled_for(tier: str) -> datetime:
    """Default scheduled date for the picker.

    20k/30k → next Saturday (or this Saturday if the user opens the
    preview before noon on a Saturday).
    50k+    → next Saturday too; multi-day windows roll forward Sat-Sun
    (-Mon) starting from there.
    """
    today = datetime.utcnow()
    days_ahead = (5 - today.weekday()) % 7  # 5 = Saturday
    if days_ahead == 0:
        # If today already is Saturday, push to next week so the user has
        # time to prep. The runner can always reschedule.
        days_ahead = 7
    target = today + timedelta(days=days_ahead)
    return datetime(target.year, target.month, target.day)


@app.post("/journeys/{journey_id}/start", response_model=JourneyResponse)
def start_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Flip a planned journey to active.

    Sets `activated_at` and resets `started_at` to now (the journey
    window measures from activation, not from when the runner first
    planned it). Rejects if another journey is already active.
    """
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id, Journey.user_id == current_user.id)
        .first()
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if journey.status != "planned":
        raise HTTPException(
            status_code=400,
            detail="Only planned journeys can be started",
        )
    if _get_active_journey(db, current_user.id) is not None:
        raise HTTPException(
            status_code=409,
            detail="You already have an active journey. Finish or abandon it first.",
        )

    now = datetime.utcnow()
    journey.status = "active"
    journey.activated_at = now
    journey.started_at = now  # window starts now, not when planned
    db.commit()
    db.refresh(journey)
    return _journey_to_response(db, journey)


@app.post("/journeys/{journey_id}/schedule", response_model=JourneyResponse)
def schedule_journey(
    journey_id: int,
    payload: JourneyScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Reschedule (or clear the schedule of) a planned journey.

    Only valid for `planned` status. Active/completed/abandoned journeys
    have a fixed schedule (the timestamps reflect what actually happened).
    """
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id, Journey.user_id == current_user.id)
        .first()
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if journey.status != "planned":
        raise HTTPException(
            status_code=400,
            detail="Only planned journeys can be rescheduled",
        )
    journey.scheduled_for = _parse_iso_date(payload.scheduled_for)
    db.commit()
    db.refresh(journey)
    return _journey_to_response(db, journey)


@app.post("/journeys/{journey_id}/complete", response_model=JourneyResponse)
def complete_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Mark a journey complete. Allowed at any time so the user can declare
    the journey done early; we don't gate on `accumulated_km >= target`."""
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id, Journey.user_id == current_user.id)
        .first()
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if journey.status != "active":
        raise HTTPException(status_code=400, detail="Journey is not active")
    journey.status = "completed"
    journey.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(journey)

    # 🌅 Guide debrief on completion (best-effort, opt-in gated).
    _try_generate_journey_completion_note(db, journey)

    # Fire any newly-unlocked milestone badges (e.g. "Journeyer 20k") so
    # the client can play the unlock sequence right after completion. We
    # don't return them in the body to keep the response shape stable;
    # the next call to /achievements will pick them up.
    _milestone_unlocks_after_activity(db, current_user)

    return _journey_to_response(db, journey)


@app.post("/journeys/{journey_id}/abandon", response_model=JourneyResponse)
def abandon_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Mark a journey abandoned. Past contributing activities keep their
    journey_id; future ones won't auto-attach."""
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id, Journey.user_id == current_user.id)
        .first()
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if journey.status != "active":
        raise HTTPException(status_code=400, detail="Journey is not active")
    journey.status = "abandoned"
    db.commit()
    db.refresh(journey)
    return _journey_to_response(db, journey)


@app.delete("/journeys/{journey_id}")
def delete_journey(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Permanently delete a planned or abandoned journey.

    Active and completed journeys are part of the user's permanent record
    and cannot be deleted. Contributing runs and walks are *not* deleted;
    we just detach them by clearing their journey_id so they continue to
    count toward all-time stats and milestones.
    """
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id, Journey.user_id == current_user.id)
        .first()
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if journey.status not in ("planned", "abandoned"):
        raise HTTPException(
            status_code=400,
            detail="Only planned or abandoned journeys can be deleted",
        )

    # Detach contributing activities. They keep all their other data —
    # photos, GPS, mood, achievements — and just lose the journey link.
    db.query(Run).filter(
        Run.user_id == current_user.id, Run.journey_id == journey.id
    ).update({Run.journey_id: None})
    db.query(Walk).filter(
        Walk.user_id == current_user.id, Walk.journey_id == journey.id
    ).update({Walk.journey_id: None})

    # Drop any per-day briefs we wrote for this journey.
    db.query(JourneyDayBrief).filter(
        JourneyDayBrief.journey_id == journey.id,
        JourneyDayBrief.user_id == current_user.id,
    ).delete()

    db.delete(journey)
    db.commit()
    return {"ok": True, "deleted_id": journey_id}


@app.get("/journeys/{journey_id}/briefs", response_model=List[JourneyDayBriefResponse])
def list_journey_day_briefs(
    journey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """All Guide-written day briefs for a journey, in chronological order.

    Multi-day journeys (50k/60k/75k/100k) get a brief on day 2 and day 3
    if the user opts into the Guide; one-go journeys (20k/30k) return
    an empty list.
    """
    journey = (
        db.query(Journey)
        .filter(Journey.id == journey_id, Journey.user_id == current_user.id)
        .first()
    )
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    rows = (
        db.query(JourneyDayBrief)
        .filter(JourneyDayBrief.journey_id == journey.id)
        .order_by(JourneyDayBrief.day_index.asc())
        .all()
    )
    return [
        JourneyDayBriefResponse(
            id=r.id,
            journey_id=r.journey_id,
            day_index=r.day_index,
            text=r.text,
            is_stub=bool(r.is_stub),
            generated_at=r.generated_at,
        )
        for r in rows
    ]


# ==========================================
# 🛡️ ADMIN ENDPOINTS
# ==========================================

@app.get("/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return crud.get_admin_stats(db)


@app.get("/admin/user-runs")
def admin_user_runs(
    email: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List recent runs for a user by email (admin only)."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    runs = db.query(Run).filter(Run.user_id == user.id).order_by(Run.completed_at.desc()).limit(20).all()
    return [{"id": r.id, "run_type": r.run_type, "distance_km": r.distance_km, "duration_seconds": r.duration_seconds, "completed_at": _iso_utc(r.completed_at), "category": r.category} for r in runs]


@app.delete("/admin/user-runs/{run_id}")
def admin_delete_run(
    run_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete any run by ID (admin only)."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    db.delete(run)
    db.commit()
    return {"deleted": run_id}


@app.get("/admin/user-walks")
def admin_user_walks(
    email: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List recent walks for a user by email (admin only)."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    walks = db.query(Walk).filter(Walk.user_id == user.id).order_by(Walk.completed_at.desc()).limit(20).all()
    return [{"id": w.id, "distance_km": w.distance_km, "duration_seconds": w.duration_seconds, "completed_at": _iso_utc(w.completed_at), "notes": w.notes} for w in walks]


@app.delete("/admin/user-walks/{walk_id}")
def admin_delete_walk(
    walk_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete any walk by ID (admin only)."""
    walk = db.query(Walk).filter(Walk.id == walk_id).first()
    if not walk:
        raise HTTPException(status_code=404, detail="Walk not found")
    db.delete(walk)
    db.commit()
    return {"deleted": walk_id}
