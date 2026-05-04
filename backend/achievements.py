"""
🏆 ACHIEVEMENTS & GOALS SYSTEM
===============================

Tracks personal records, achievements, and goals.
Badges are grouped into Path vs Album on the client; legacy rows stay in
ACHIEVEMENTS for DB compatibility but are hidden from checks and totals.
"""

from datetime import datetime, timedelta
from typing import List, Optional
from collections import defaultdict

from sqlalchemy import func as sqlfunc, or_
from sqlalchemy.orm import Session

from models import Run, RunPhoto

# ==========================================
# 🎯 GOALS CONFIGURATION
# ==========================================

YEARLY_GOAL_KM = 250
MONTHLY_GOAL_KM = 20

# ==========================================
# 🏆 ACHIEVEMENTS DEFINITIONS (50 total)
# ==========================================

ACHIEVEMENTS = {
    # ---- MILESTONE: Run Count (12) ----
    "first_run": {
        "id": "first_run", "name": "First Steps",
        "description": "Complete your first run",
        "emoji": "🌱", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 1,
    },
    "runs_5": {
        "id": "runs_5", "name": "Taking Root",
        "description": "Complete 5 runs",
        "emoji": "🌿", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 5,
    },
    "runs_10": {
        "id": "runs_10", "name": "Double Digits",
        "description": "Complete 10 runs",
        "emoji": "🍀", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 10,
    },
    "runs_25": {
        "id": "runs_25", "name": "Steady Ground",
        "description": "Complete 25 runs",
        "emoji": "🌾", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 25,
    },
    "runs_50": {
        "id": "runs_50", "name": "Deep Roots",
        "description": "Complete 50 runs",
        "emoji": "🌳", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 50,
    },
    "runs_75": {
        "id": "runs_75", "name": "The Practice",
        "description": "Complete 75 runs",
        "emoji": "🍃", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 75,
    },
    "runs_100": {
        "id": "runs_100", "name": "Century",
        "description": "Complete 100 runs",
        "emoji": "🏔️", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 100,
    },
    "runs_200": {
        "id": "runs_200", "name": "Quiet Strength",
        "description": "Complete 200 runs",
        "emoji": "🪨", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 200,
    },
    "runs_300": {
        "id": "runs_300", "name": "Worn Trail",
        "description": "Complete 300 runs",
        "emoji": "🛤️", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 300,
    },
    "runs_500": {
        "id": "runs_500", "name": "Five Hundred",
        "description": "Complete 500 runs",
        "emoji": "🌲", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 500,
    },
    "runs_750": {
        "id": "runs_750", "name": "Ancient Oak",
        "description": "Complete 750 runs",
        "emoji": "🌊", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 750,
    },
    "runs_1000": {
        "id": "runs_1000", "name": "A Thousand Steps",
        "description": "Complete 1000 runs",
        "emoji": "🗻", "category": "milestone",
        "check": lambda s: s["total_runs"] >= 1000,
    },

    # ---- DISTANCE: Total KM (12) ----
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
        "id": "km_100", "name": "Hundred",
        "description": "Run 100km total",
        "emoji": "🌿", "category": "distance",
        "check": lambda s: s["total_km"] >= 100,
    },
    "km_150": {
        "id": "km_150", "name": "Growing Strong",
        "description": "Run 150km total",
        "emoji": "🌻", "category": "distance",
        "check": lambda s: s["total_km"] >= 150,
    },
    "km_250": {
        "id": "km_250", "name": "Quarter Thousand",
        "description": "Run 250km total",
        "emoji": "🌾", "category": "distance",
        "check": lambda s: s["total_km"] >= 250,
    },
    "km_500": {
        "id": "km_500", "name": "Half Way There",
        "description": "Run 500km total",
        "emoji": "🌳", "category": "distance",
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
        "emoji": "🏔️", "category": "distance",
        "check": lambda s: s["total_km"] >= 1000,
    },
    "km_1500": {
        "id": "km_1500", "name": "Ultra Distance",
        "description": "Run 1500km total",
        "emoji": "🌍", "category": "distance",
        "check": lambda s: s["total_km"] >= 1500,
    },
    "km_2000": {
        "id": "km_2000", "name": "Two Thousand",
        "description": "Run 2000km total",
        "emoji": "🛤️", "category": "distance",
        "check": lambda s: s["total_km"] >= 2000,
    },
    "km_3000": {
        "id": "km_3000", "name": "Three Thousand",
        "description": "Run 3000km total",
        "emoji": "🧭", "category": "distance",
        "check": lambda s: s["total_km"] >= 3000,
    },
    "km_5000": {
        "id": "km_5000", "name": "Five Thousand",
        "description": "Run 5000km total",
        "emoji": "🌏", "category": "distance",
        "check": lambda s: s["total_km"] >= 5000,
    },

    # ---- DISTANCE TYPE: First completions (10) ----
    "first_1k": {
        "id": "first_1k", "name": "First Breath",
        "description": "Complete your first 1K",
        "emoji": "🌱", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("1k", 0) >= 1,
    },
    "first_2k": {
        "id": "first_2k", "name": "Getting Going",
        "description": "Complete your first 2K",
        "emoji": "🌿", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("2k", 0) >= 1,
    },
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
        "emoji": "🏞️", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("10k", 0) >= 1,
    },
    "first_15k": {
        "id": "first_15k", "name": "Going Long",
        "description": "Complete your first 15K",
        "emoji": "🌄", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("15k", 0) >= 1,
    },
    "first_8k": {
        "id": "first_8k", "name": "Finding Rhythm",
        "description": "Complete your first 8K",
        "emoji": "🍂", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("8k", 0) >= 1,
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
        "emoji": "🗻", "category": "distance_type",
        "check": lambda s: s.get("runs_by_type", {}).get("21k", 0) >= 1,
    },
    "all_distances": {
        "id": "all_distances", "name": "Full Spectrum",
        "description": "Run every distance at least once (1K-21K)",
        "emoji": "🌈", "category": "distance_type",
        "check": lambda s: all(
            s.get("runs_by_type", {}).get(d, 0) >= 1
            for d in ["1k", "2k", "3k", "5k", "8k", "10k", "15k", "18k", "21k"]
        ),
    },

    # ---- SPECIALIST: Repeat distances (12) ----
    "ten_1ks": {
        "id": "ten_1ks", "name": "1K Rhythm",
        "description": "Complete ten 1K runs",
        "emoji": "🌱", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("1k", 0) >= 10,
    },
    "ten_2ks": {
        "id": "ten_2ks", "name": "2K Rhythm",
        "description": "Complete ten 2K runs",
        "emoji": "🌿", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("2k", 0) >= 10,
    },
    "ten_3ks": {
        "id": "ten_3ks", "name": "3K Rhythm",
        "description": "Complete ten 3K runs",
        "emoji": "🍃", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("3k", 0) >= 10,
    },
    "ten_5ks": {
        "id": "ten_5ks", "name": "5K Familiar Path",
        "description": "Complete ten 5K runs",
        "emoji": "🌳", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("5k", 0) >= 10,
    },
    "ten_10ks": {
        "id": "ten_10ks", "name": "10K Worn Trail",
        "description": "Complete ten 10K runs",
        "emoji": "🛤️", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("10k", 0) >= 10,
    },
    "five_15ks": {
        "id": "five_15ks", "name": "15K Wanderer",
        "description": "Complete five 15K runs",
        "emoji": "🏞️", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("15k", 0) >= 5,
    },
    "five_18ks": {
        "id": "five_18ks", "name": "18K Endurance",
        "description": "Complete five 18K runs",
        "emoji": "🪨", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("18k", 0) >= 5,
    },
    "five_21ks": {
        "id": "five_21ks", "name": "Half Marathon Practice",
        "description": "Complete five 21K runs",
        "emoji": "🗻", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("21k", 0) >= 5,
    },
    "twenty_5ks": {
        "id": "twenty_5ks", "name": "5K Old Friend",
        "description": "Complete twenty 5K runs",
        "emoji": "🌲", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("5k", 0) >= 20,
    },
    "ten_8ks": {
        "id": "ten_8ks", "name": "8K Explorer",
        "description": "Complete ten 8K runs",
        "emoji": "🍂", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("8k", 0) >= 10,
    },
    "fifty_5ks": {
        "id": "fifty_5ks", "name": "5K Home Trail",
        "description": "Complete fifty 5K runs",
        "emoji": "🏡", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("5k", 0) >= 50,
    },
    "twenty_10ks": {
        "id": "twenty_10ks", "name": "10K Deep Practice",
        "description": "Complete twenty 10K runs",
        "emoji": "🌊", "category": "specialist",
        "check": lambda s: s.get("runs_by_type", {}).get("10k", 0) >= 20,
    },

    # ---- STREAK: Consistency (10) ----
    "streak_2": {
        "id": "streak_2", "name": "Seedling",
        "description": "2 weeks of showing up",
        "emoji": "🌱", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 2,
    },
    "streak_3": {
        "id": "streak_3", "name": "Sprout",
        "description": "3 weeks of showing up",
        "emoji": "🌿", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 3,
    },
    "streak_4": {
        "id": "streak_4", "name": "Young Tree",
        "description": "A month of rhythm",
        "emoji": "🌴", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 4,
    },
    "streak_6": {
        "id": "streak_6", "name": "Sapling",
        "description": "6 weeks of rhythm",
        "emoji": "🌾", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 6,
    },
    "streak_8": {
        "id": "streak_8", "name": "Growing Strong",
        "description": "Two months of rhythm",
        "emoji": "🍀", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 8,
    },
    "streak_12": {
        "id": "streak_12", "name": "Deep Roots",
        "description": "A quarter year of rhythm",
        "emoji": "🌳", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 12,
    },
    "streak_16": {
        "id": "streak_16", "name": "Through Seasons",
        "description": "Four months of rhythm",
        "emoji": "🍂", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 16,
    },
    "streak_26": {
        "id": "streak_26", "name": "Mighty Oak",
        "description": "Half a year of rhythm",
        "emoji": "🌲", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 26,
    },
    "streak_40": {
        "id": "streak_40", "name": "Ancient Grove",
        "description": "Ten months of rhythm",
        "emoji": "🏔️", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 40,
    },
    "streak_52": {
        "id": "streak_52", "name": "Evergreen",
        "description": "A full year of rhythm",
        "emoji": "🌅", "category": "streak",
        "check": lambda s: s.get("longest_streak", 0) >= 52,
    },
    "streak_current_2": {
        "id": "streak_current_2", "name": "Present Week",
        "description": "On a 2-week active streak right now",
        "emoji": "🔥", "category": "streak",
        "check": lambda s: s.get("current_streak", 0) >= 2,
    },
    "streak_current_4": {
        "id": "streak_current_4", "name": "Rolling Month",
        "description": "On a 4-week active streak right now",
        "emoji": "🔥", "category": "streak",
        "check": lambda s: s.get("current_streak", 0) >= 4,
    },
    "streak_current_8": {
        "id": "streak_current_8", "name": "Hot Streak",
        "description": "On an 8-week active streak right now",
        "emoji": "🔥", "category": "streak",
        "check": lambda s: s.get("current_streak", 0) >= 8,
    },
    "streak_current_16": {
        "id": "streak_current_16", "name": "Unbroken",
        "description": "On a 16-week active streak right now",
        "emoji": "🔥", "category": "streak",
        "check": lambda s: s.get("current_streak", 0) >= 16,
    },
    "streak_current_26": {
        "id": "streak_current_26", "name": "Half-Year Heat",
        "description": "On a 26-week active streak right now",
        "emoji": "🔥", "category": "streak",
        "check": lambda s: s.get("current_streak", 0) >= 26,
    },

    # ---- GOALS: Monthly & yearly goal hits (8) ----
    "monthly_goal_1": {
        "id": "monthly_goal_1", "name": "First Horizon",
        "description": "Reach your monthly goal once",
        "emoji": "🌅", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 1,
    },
    "monthly_goal_3": {
        "id": "monthly_goal_3", "name": "Hat Trick",
        "description": "Hit your monthly goal 3 times",
        "emoji": "🌤️", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 3,
    },
    "monthly_goal_6": {
        "id": "monthly_goal_6", "name": "Half Year",
        "description": "Reach your monthly goal 6 times",
        "emoji": "☀️", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 6,
    },
    "monthly_goal_9": {
        "id": "monthly_goal_9", "name": "Nine Moons",
        "description": "Reach your monthly goal 9 times",
        "emoji": "🌙", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 9,
    },
    "monthly_goal_12": {
        "id": "monthly_goal_12", "name": "Full Circle",
        "description": "Reach your monthly goal every month",
        "emoji": "🌕", "category": "goals",
        "check": lambda s: s.get("monthly_goals_hit", 0) >= 12,
    },
    "yearly_goal_25": {
        "id": "yearly_goal_25", "name": "First Quarter",
        "description": "Reach 25% of your yearly km goal",
        "emoji": "🌗", "category": "goals",
        "check": lambda s: s.get("yearly_goal_percent", 0) >= 25,
    },
    "yearly_goal_50": {
        "id": "yearly_goal_50", "name": "Halfway There",
        "description": "Reach 50% of your yearly km goal",
        "emoji": "🌓", "category": "goals",
        "check": lambda s: s.get("yearly_goal_percent", 0) >= 50,
    },
    "yearly_goal_100": {
        "id": "yearly_goal_100", "name": "Mission Complete",
        "description": "Hit your yearly km goal",
        "emoji": "🌕", "category": "goals",
        "check": lambda s: s.get("yearly_goal_percent", 0) >= 100,
    },

    # ---- CATEGORY: Outdoor vs Treadmill (8) ----
    "outdoor_10": {
        "id": "outdoor_10", "name": "Nature Lover",
        "description": "Complete 10 outdoor runs",
        "emoji": "🌳", "category": "category",
        "check": lambda s: s.get("outdoor_runs", 0) >= 10,
    },
    "outdoor_25": {
        "id": "outdoor_25", "name": "Fresh Air Fanatic",
        "description": "Complete 25 outdoor runs",
        "emoji": "🍃", "category": "category",
        "check": lambda s: s.get("outdoor_runs", 0) >= 25,
    },
    "outdoor_50": {
        "id": "outdoor_50", "name": "Trail Blazer",
        "description": "Complete 50 outdoor runs",
        "emoji": "🏞️", "category": "category",
        "check": lambda s: s.get("outdoor_runs", 0) >= 50,
    },
    "outdoor_100": {
        "id": "outdoor_100", "name": "One with Nature",
        "description": "Complete 100 outdoor runs",
        "emoji": "🌄", "category": "category",
        "check": lambda s: s.get("outdoor_runs", 0) >= 100,
    },
    "treadmill_10": {
        "id": "treadmill_10", "name": "Indoor Practice",
        "description": "Complete 10 treadmill runs",
        "emoji": "🏠", "category": "category",
        "check": lambda s: s.get("treadmill_runs", 0) >= 10,
    },
    "treadmill_25": {
        "id": "treadmill_25", "name": "Indoor Rhythm",
        "description": "Complete 25 treadmill runs",
        "emoji": "🪴", "category": "category",
        "check": lambda s: s.get("treadmill_runs", 0) >= 25,
    },
    "treadmill_50": {
        "id": "treadmill_50", "name": "Indoor Steady",
        "description": "Complete 50 treadmill runs",
        "emoji": "🧘", "category": "category",
        "check": lambda s: s.get("treadmill_runs", 0) >= 50,
    },
    "both_categories": {
        "id": "both_categories", "name": "Best of Both",
        "description": "Complete 5+ outdoor and 5+ treadmill runs",
        "emoji": "🔀", "category": "category",
        "check": lambda s: s.get("outdoor_runs", 0) >= 5 and s.get("treadmill_runs", 0) >= 5,
    },

    # ---- STEPS: High Step Days (8) ----
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
        "emoji": "🌾", "category": "steps",
        "check": lambda s: s.get("days_20k_steps", 0) >= 5,
    },
    "steps_25k_3": {
        "id": "steps_25k_3", "name": "Marathon Walker",
        "description": "Log three 25K+ step days",
        "emoji": "🌿", "category": "steps",
        "check": lambda s: s.get("days_25k_steps", 0) >= 3,
    },
    "steps_50": {
        "id": "steps_50", "name": "Step Legend",
        "description": "Log 50 high step days",
        "emoji": "🌳", "category": "steps",
        "check": lambda s: s.get("total_step_entries", 0) >= 50,
    },
    "steps_15k_10": {
        "id": "steps_15k_10", "name": "Active Lifestyle",
        "description": "Log ten 15K+ step days",
        "emoji": "🌞", "category": "steps",
        "check": lambda s: s.get("days_15k_steps", 0) >= 10,
    },
    "steps_30k_1": {
        "id": "steps_30k_1", "name": "Mega Steps",
        "description": "Log one 30K+ step day",
        "emoji": "🏔️", "category": "steps",
        "check": lambda s: s.get("days_30k_steps", 0) >= 1,
    },

    # ---- ALBUM: run photos (ids unchanged for user_achievements) ----
    "scenic_first": {
        "id": "scenic_first", "name": "Album Opener",
        "description": "Add your first photo to a run",
        "emoji": "📷", "category": "album",
        "check": lambda s: s.get("total_photos", 0) >= 1,
    },
    "scenic_5": {
        "id": "scenic_5", "name": "Growing Album",
        "description": "Add 5 photos to your runs",
        "emoji": "🖼️", "category": "album",
        "check": lambda s: s.get("total_photos", 0) >= 5,
    },
    "scenic_10": {
        "id": "scenic_10", "name": "Album Regular",
        "description": "Add 10 photos to your runs",
        "emoji": "📸", "category": "album",
        "check": lambda s: s.get("total_photos", 0) >= 10,
    },
    "scenic_25": {
        "id": "scenic_25", "name": "Visual Storyteller",
        "description": "Add 25 photos to your runs",
        "emoji": "🎞️", "category": "album",
        "check": lambda s: s.get("total_photos", 0) >= 25,
    },
    "scenic_3_runs": {
        "id": "scenic_3_runs", "name": "Routes Remembered",
        "description": "Add photos to 3 different runs",
        "emoji": "🗺️", "category": "album",
        "check": lambda s: s.get("runs_with_photos", 0) >= 3,
    },
    "scenic_10_runs": {
        "id": "scenic_10_runs", "name": "Trail Documentarian",
        "description": "Add photos to 10 different runs",
        "emoji": "📖", "category": "album",
        "check": lambda s: s.get("runs_with_photos", 0) >= 10,
    },
    "album_50_photos": {
        "id": "album_50_photos", "name": "Deep Cut",
        "description": "Add 50 photos to your runs",
        "emoji": "📚", "category": "album",
        "check": lambda s: s.get("total_photos", 0) >= 50,
    },
    "album_100_photos": {
        "id": "album_100_photos", "name": "Century Frame",
        "description": "Add 100 photos to your runs",
        "emoji": "🎬", "category": "album",
        "check": lambda s: s.get("total_photos", 0) >= 100,
    },
    "album_25_runs": {
        "id": "album_25_runs", "name": "Many Chapters",
        "description": "Add photos to 25 different runs",
        "emoji": "📔", "category": "album",
        "check": lambda s: s.get("runs_with_photos", 0) >= 25,
    },
    "album_50_runs": {
        "id": "album_50_runs", "name": "Library of Paths",
        "description": "Add photos to 50 different runs",
        "emoji": "📕", "category": "album",
        "check": lambda s: s.get("runs_with_photos", 0) >= 50,
    },
    "album_4km_moment": {
        "id": "album_4km_moment", "name": "The Fourth Kilometre",
        "description": "Capture a run photo at 4 km or beyond along the route",
        "emoji": "🎯", "category": "album",
        "check": lambda s: s.get("photos_at_or_beyond_4km", 0) >= 1,
    },
    "album_seasons_4": {
        "id": "album_seasons_4", "name": "Four Seasons",
        "description": "Run photos across all four seasons of the year",
        "emoji": "🍂", "category": "album",
        "check": lambda s: s.get("photo_seasons_covered", 0) >= 4,
    },
    "album_paths_10": {
        "id": "album_paths_10", "name": "Ten Trails",
        "description": "Photos on 10 distinct start locations (routes)",
        "emoji": "🧭", "category": "album",
        "check": lambda s: s.get("photo_route_buckets", 0) >= 10,
    },

    # ---- LEGACY (hidden; kept so user_achievement rows stay valid) ----
    "level_stride": {
        "id": "level_stride", "name": "Finding Stride",
        "description": "Retired badge",
        "emoji": "🌿", "category": "levels", "legacy": True,
        "check": lambda s: False,
    },
    "level_flow": {
        "id": "level_flow", "name": "In the Flow",
        "description": "Retired badge",
        "emoji": "🌊", "category": "levels", "legacy": True,
        "check": lambda s: False,
    },

    # ---- DISTANCE VARIETY (was mis-labelled as levels) ----
    "level_all_breath": {
        "id": "level_all_breath", "name": "Breath Quartet",
        "description": "Run every distance from 1K through 5K at least once",
        "emoji": "🫁", "category": "distance_type",
        "check": lambda s: all(
            s.get("runs_by_type", {}).get(d, 0) >= 1
            for d in ["1k", "2k", "3k", "5k"]
        ),
    },
    "level_all_stride": {
        "id": "level_all_stride", "name": "Stride Five",
        "description": "Run 2K through 10K at least once each",
        "emoji": "👣", "category": "distance_type",
        "check": lambda s: all(
            s.get("runs_by_type", {}).get(d, 0) >= 1
            for d in ["2k", "3k", "5k", "8k", "10k"]
        ),
    },
    "level_all_flow": {
        "id": "level_all_flow", "name": "Flow Seven",
        "description": "Run 3K through 21K at least once each",
        "emoji": "🌊", "category": "distance_type",
        "check": lambda s: all(
            s.get("runs_by_type", {}).get(d, 0) >= 1
            for d in ["3k", "5k", "8k", "10k", "15k", "18k", "21k"]
        ),
    },

    # ---- DEDICATION (5) ----
    "week_3_runs": {
        "id": "week_3_runs", "name": "Full Week",
        "description": "Log 3 runs in a single week",
        "emoji": "🌿", "category": "dedication",
        "check": lambda s: s.get("max_runs_in_week", 0) >= 3,
    },
    "week_4_runs": {
        "id": "week_4_runs", "name": "Rich Week",
        "description": "Log 4 runs in a single week",
        "emoji": "🌳", "category": "dedication",
        "check": lambda s: s.get("max_runs_in_week", 0) >= 4,
    },
    "week_5_runs": {
        "id": "week_5_runs", "name": "Abundant Week",
        "description": "Log 5 runs in a single week",
        "emoji": "🌲", "category": "dedication",
        "check": lambda s: s.get("max_runs_in_week", 0) >= 5,
    },
    "variety_week": {
        "id": "variety_week", "name": "Many Paths",
        "description": "Run 3 different distances in a single week",
        "emoji": "🍃", "category": "dedication",
        "check": lambda s: s.get("max_types_in_week", 0) >= 3,
    },
    "back_to_back": {
        "id": "back_to_back", "name": "Day After Day",
        "description": "Run on 2 consecutive days",
        "emoji": "🌅", "category": "dedication",
        "check": lambda s: s.get("has_consecutive_days", False),
    },

    # ---- MOOD (4) ----
    "mood_first": {
        "id": "mood_first", "name": "First Reflection",
        "description": "Log your first run with a mood",
        "emoji": "🪞", "category": "mood",
        "check": lambda s: s.get("runs_with_mood", 0) >= 1,
    },
    "mood_10": {
        "id": "mood_10", "name": "Self Aware",
        "description": "Log 10 runs with a mood",
        "emoji": "🧘", "category": "mood",
        "check": lambda s: s.get("runs_with_mood", 0) >= 10,
    },
    "mood_great_5": {
        "id": "mood_great_5", "name": "Runner's High",
        "description": "Log 5 runs that felt great",
        "emoji": "🌸", "category": "mood",
        "check": lambda s: s.get("great_mood_runs", 0) >= 5,
    },
    "mood_25": {
        "id": "mood_25", "name": "Mindful Runner",
        "description": "Log 25 runs with a mood",
        "emoji": "🌙", "category": "mood",
        "check": lambda s: s.get("runs_with_mood", 0) >= 25,
    },
    "mood_50": {
        "id": "mood_50", "name": "Emotional Map",
        "description": "Log 50 runs with a mood",
        "emoji": "🗺️", "category": "mood",
        "check": lambda s: s.get("runs_with_mood", 0) >= 50,
    },
    "mood_every_mood": {
        "id": "mood_every_mood", "name": "Full Spectrum",
        "description": "Log every run mood at least once (easy, good, tough, great)",
        "emoji": "🌈", "category": "mood",
        "check": lambda s: s.get("distinct_run_mood_count", 0) >= 4,
    },

    # ---- WEEKLY REFLECTION ----
    "reflection_first": {
        "id": "reflection_first", "name": "Weekend Pause",
        "description": "Save your first weekly reflection",
        "emoji": "📝", "category": "reflection",
        "check": lambda s: s.get("reflection_count", 0) >= 1,
    },
    "reflection_4": {
        "id": "reflection_4", "name": "Month of Sundays",
        "description": "Save 4 weekly reflections",
        "emoji": "📅", "category": "reflection",
        "check": lambda s: s.get("reflection_count", 0) >= 4,
    },
    "reflection_12": {
        "id": "reflection_12", "name": "Season of Thought",
        "description": "Save 12 weekly reflections",
        "emoji": "🌿", "category": "reflection",
        "check": lambda s: s.get("reflection_count", 0) >= 12,
    },
    "reflection_26": {
        "id": "reflection_26", "name": "Half-Year Journal",
        "description": "Save 26 weekly reflections",
        "emoji": "📔", "category": "reflection",
        "check": lambda s: s.get("reflection_count", 0) >= 26,
    },
    "reflection_52": {
        "id": "reflection_52", "name": "Year of Looking Back",
        "description": "Save 52 weekly reflections",
        "emoji": "📖", "category": "reflection",
        "check": lambda s: s.get("reflection_count", 0) >= 52,
    },
    "reflection_every_mood": {
        "id": "reflection_every_mood", "name": "Every Feeling",
        "description": "Use each weekly reflection mood emoji at least once",
        "emoji": "✨", "category": "reflection",
        "check": lambda s: s.get("distinct_reflection_moods", 0) >= 5,
    },

    # ---- PERSONAL RECORDS ----
    "pr_first": {
        "id": "pr_first", "name": "Personal Best",
        "description": "Set a personal record on any distance",
        "emoji": "🏅", "category": "pr",
        "check": lambda s: s.get("pr_distances_held", 0) >= 1,
    },
    "pr_3_distances": {
        "id": "pr_3_distances", "name": "Triple Threat",
        "description": "Hold a PR on 3 different distances",
        "emoji": "🎖️", "category": "pr",
        "check": lambda s: s.get("pr_distances_held", 0) >= 3,
    },
    "pr_5_distances": {
        "id": "pr_5_distances", "name": "PR Collector",
        "description": "Hold a PR on 5 different distances",
        "emoji": "🏆", "category": "pr",
        "check": lambda s: s.get("pr_distances_held", 0) >= 5,
    },
    "pr_burst": {
        "id": "pr_burst", "name": "Breakthrough Month",
        "description": "Improve a PR 3+ times in a single calendar month",
        "emoji": "⚡", "category": "pr",
        "check": lambda s: s.get("pr_burst_max_in_month", 0) >= 3,
    },
    "pr_all_breath": {
        "id": "pr_all_breath", "name": "PR Quartet",
        "description": "Hold a PR on 1K, 2K, 3K, and 5K",
        "emoji": "🎯", "category": "pr",
        "check": lambda s: s.get("pr_breath_held", False),
    },
    "pr_all_stride": {
        "id": "pr_all_stride", "name": "PR Stride Set",
        "description": "Hold a PR from 2K through 10K",
        "emoji": "🥇", "category": "pr",
        "check": lambda s: s.get("pr_stride_held", False),
    },
    "pr_all_flow": {
        "id": "pr_all_flow", "name": "PR Full Deck",
        "description": "Hold a PR on every standard distance through 21K",
        "emoji": "👑", "category": "pr",
        "check": lambda s: s.get("pr_flow_held", False),
    },

    # ---- ZEN (earned tier) ----
    "zen_unlocked": {
        "id": "zen_unlocked", "name": "Zen Unlocked",
        "description": "Earn Zen by reaching 1000 km in a calendar year",
        "emoji": "🧘", "category": "zen",
        "check": lambda s: s.get("zen_unlocked", False),
    },
    "zen_maintained_3mo": {
        "id": "zen_maintained_3mo", "name": "Zen Three Months",
        "description": "Stay on Zen with a healthy rolling year for 90 days after unlock",
        "emoji": "🌿", "category": "zen",
        "check": lambda s: s.get("zen_maintained_90d", False),
    },
    "zen_maintained_6mo": {
        "id": "zen_maintained_6mo", "name": "Zen Six Months",
        "description": "Stay on Zen with a healthy rolling year for 180 days after unlock",
        "emoji": "🌳", "category": "zen",
        "check": lambda s: s.get("zen_maintained_180d", False),
    },
    "zen_maintained_year": {
        "id": "zen_maintained_year", "name": "Zen Year",
        "description": "Stay on Zen with a healthy rolling year for a full year after unlock",
        "emoji": "🌅", "category": "zen",
        "check": lambda s: s.get("zen_maintained_365d", False),
    },
    "zen_returned": {
        "id": "zen_returned", "name": "Zen Returned",
        "description": "Earn Zen again after a lapse",
        "emoji": "♻️", "category": "zen",
        "check": lambda s: s.get("zen_returned", False),
    },

    # ---- NEIGHBOURHOOD ----
    "neighbourhood_first_share": {
        "id": "neighbourhood_first_share", "name": "City Voice",
        "description": "Share your first run to the Neighbourhood",
        "emoji": "🏙️", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_shared_runs", 0) >= 1,
    },
    "neighbourhood_shared_5": {
        "id": "neighbourhood_shared_5", "name": "Local Regular",
        "description": "Share 5 runs to the Neighbourhood",
        "emoji": "🌆", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_shared_runs", 0) >= 5,
    },
    "neighbourhood_shared_25": {
        "id": "neighbourhood_shared_25", "name": "City Contributor",
        "description": "Share 25 runs to the Neighbourhood",
        "emoji": "🌃", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_shared_runs", 0) >= 25,
    },
    "neighbourhood_shared_100": {
        "id": "neighbourhood_shared_100", "name": "Neighbourhood Anchor",
        "description": "Share 100 runs to the Neighbourhood",
        "emoji": "🗼", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_shared_runs", 0) >= 100,
    },
    "neighbourhood_first_save_received": {
        "id": "neighbourhood_first_save_received", "name": "Saved for Later",
        "description": "Someone saved one of your shared runs",
        "emoji": "🔖", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_saves_received", 0) >= 1,
    },
    "neighbourhood_loves_5": {
        "id": "neighbourhood_loves_5", "name": "Felt in the City",
        "description": "Receive 5 Loves on your shared runs",
        "emoji": "💚", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_loves_received", 0) >= 5,
    },
    "neighbourhood_loves_25": {
        "id": "neighbourhood_loves_25", "name": "City Favourite",
        "description": "Receive 25 Loves on your shared runs",
        "emoji": "💚", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_loves_received", 0) >= 25,
    },
    "neighbourhood_loves_100": {
        "id": "neighbourhood_loves_100", "name": "Beloved Route",
        "description": "Receive 100 Loves on your shared runs",
        "emoji": "💚", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_loves_received", 0) >= 100,
    },
    "neighbourhood_explorer_5": {
        "id": "neighbourhood_explorer_5", "name": "Scout",
        "description": "Save 5 runs from other ZenRunners",
        "emoji": "🧭", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_saves_of_others", 0) >= 5,
    },
    "neighbourhood_explorer_25": {
        "id": "neighbourhood_explorer_25", "name": "Curator",
        "description": "Save 25 runs from other ZenRunners",
        "emoji": "🗺️", "category": "neighbourhood",
        "check": lambda s: s.get("neighbourhood_saves_of_others", 0) >= 25,
    },

    # ---- CIRCLES ----
    "circle_first_join": {
        "id": "circle_first_join", "name": "Circle Up",
        "description": "Join your first circle",
        "emoji": "👥", "category": "circles",
        "check": lambda s: s.get("circle_memberships", 0) >= 1,
    },
    "circle_first_share": {
        "id": "circle_first_share", "name": "Shared with Friends",
        "description": "Have a run visible to your circles",
        "emoji": "🤝", "category": "circles",
        "check": lambda s: s.get("runs_circles_shared", 0) >= 1,
    },
    "checkin_first": {
        "id": "checkin_first", "name": "Weekly Pulse",
        "description": "Post your first circle check-in",
        "emoji": "💬", "category": "circles",
        "check": lambda s: s.get("circle_checkins", 0) >= 1,
    },
    "checkin_4": {
        "id": "checkin_4", "name": "Month of Pulses",
        "description": "Post 4 circle check-ins",
        "emoji": "📣", "category": "circles",
        "check": lambda s: s.get("circle_checkins", 0) >= 4,
    },
    "checkin_12": {
        "id": "checkin_12", "name": "Quarter of Pulses",
        "description": "Post 12 circle check-ins",
        "emoji": "🔔", "category": "circles",
        "check": lambda s: s.get("circle_checkins", 0) >= 12,
    },
    "checkin_26": {
        "id": "checkin_26", "name": "Half-Year Pulse",
        "description": "Post 26 circle check-ins",
        "emoji": "⏰", "category": "circles",
        "check": lambda s: s.get("circle_checkins", 0) >= 26,
    },
    "checkin_52": {
        "id": "checkin_52", "name": "Year of Pulses",
        "description": "Post 52 circle check-ins",
        "emoji": "🎊", "category": "circles",
        "check": lambda s: s.get("circle_checkins", 0) >= 52,
    },

    # ---- WALKING ----
    # Walking badges complement the runner badges. They're driven by the
    # walk-stats payload (total_walks, total_walk_km, longest_walk_km,
    # public_walks_done) injected from get_walk_stats below.
    "first_walk": {
        "id": "first_walk", "name": "First Stroll",
        "description": "Complete your first tracked walk",
        "emoji": "🚶", "category": "walking",
        "check": lambda s: s.get("total_walks", 0) >= 1,
    },
    "walks_10": {
        "id": "walks_10", "name": "Habitual Walker",
        "description": "Complete 10 walks",
        "emoji": "👟", "category": "walking",
        "check": lambda s: s.get("total_walks", 0) >= 10,
    },
    "walks_25": {
        "id": "walks_25", "name": "Quarter Hundred",
        "description": "Complete 25 walks",
        "emoji": "🌳", "category": "walking",
        "check": lambda s: s.get("total_walks", 0) >= 25,
    },
    "walks_50": {
        "id": "walks_50", "name": "Footloose",
        "description": "Complete 50 walks",
        "emoji": "🍂", "category": "walking",
        "check": lambda s: s.get("total_walks", 0) >= 50,
    },
    "walks_100": {
        "id": "walks_100", "name": "Centurion Walker",
        "description": "Complete 100 walks",
        "emoji": "🥾", "category": "walking",
        "check": lambda s: s.get("total_walks", 0) >= 100,
    },
    "walk_km_10": {
        "id": "walk_km_10", "name": "10 km Walked",
        "description": "Walk 10 km in total",
        "emoji": "🌤️", "category": "walking",
        "check": lambda s: s.get("total_walk_km", 0) >= 10,
    },
    "walk_km_50": {
        "id": "walk_km_50", "name": "50 km Walked",
        "description": "Walk 50 km in total",
        "emoji": "🌄", "category": "walking",
        "check": lambda s: s.get("total_walk_km", 0) >= 50,
    },
    "walk_km_100": {
        "id": "walk_km_100", "name": "100 km Walked",
        "description": "Walk 100 km in total",
        "emoji": "🏞️", "category": "walking",
        "check": lambda s: s.get("total_walk_km", 0) >= 100,
    },
    "walk_long_5": {
        "id": "walk_long_5", "name": "5 km Stretch",
        "description": "Complete a single walk of 5 km or more",
        "emoji": "🛤️", "category": "walking",
        "check": lambda s: s.get("longest_walk_km", 0) >= 5,
    },
    "walk_long_10": {
        "id": "walk_long_10", "name": "10 km Stretch",
        "description": "Complete a single walk of 10 km or more",
        "emoji": "🏔️", "category": "walking",
        "check": lambda s: s.get("longest_walk_km", 0) >= 10,
    },
    "walk_public_first": {
        "id": "walk_public_first", "name": "Trail Tried",
        "description": "Complete a walk linked to a public route",
        "emoji": "🧭", "category": "walking",
        "check": lambda s: s.get("public_walks_done", 0) >= 1,
    },
    "walks_250": {
        "id": "walks_250", "name": "Walking Deep",
        "description": "Complete 250 walks",
        "emoji": "🛤️", "category": "walking",
        "check": lambda s: s.get("total_walks", 0) >= 250,
    },
    "walks_500": {
        "id": "walks_500", "name": "Walking Life",
        "description": "Complete 500 walks",
        "emoji": "🌍", "category": "walking",
        "check": lambda s: s.get("total_walks", 0) >= 500,
    },
    "walk_km_250": {
        "id": "walk_km_250", "name": "250 km Walked",
        "description": "Walk 250 km in total",
        "emoji": "🌾", "category": "walking",
        "check": lambda s: s.get("total_walk_km", 0) >= 250,
    },
    "walk_km_500": {
        "id": "walk_km_500", "name": "500 km Walked",
        "description": "Walk 500 km in total",
        "emoji": "🏔️", "category": "walking",
        "check": lambda s: s.get("total_walk_km", 0) >= 500,
    },
    "walk_long_15": {
        "id": "walk_long_15", "name": "15 km Stretch",
        "description": "Complete a single walk of 15 km or more",
        "emoji": "⛰️", "category": "walking",
        "check": lambda s: s.get("longest_walk_km", 0) >= 15,
    },
    "walk_streak_2": {
        "id": "walk_streak_2", "name": "Walk Rhythm",
        "description": "On a 2-week active walking streak right now",
        "emoji": "👣", "category": "walking",
        "check": lambda s: s.get("walk_current_streak", 0) >= 2,
    },
    "walk_streak_4": {
        "id": "walk_streak_4", "name": "Walk Month",
        "description": "On a 4-week active walking streak right now",
        "emoji": "👣", "category": "walking",
        "check": lambda s: s.get("walk_current_streak", 0) >= 4,
    },
    "walk_streak_12": {
        "id": "walk_streak_12", "name": "Walk Quarter",
        "description": "On a 12-week active walking streak right now",
        "emoji": "👣", "category": "walking",
        "check": lambda s: s.get("walk_current_streak", 0) >= 12,
    },
    "walk_photo_first": {
        "id": "walk_photo_first", "name": "Walking with a Camera",
        "description": "Capture a photo on a walk",
        "emoji": "📸", "category": "album",
        "check": lambda s: s.get("walks_with_photos", 0) >= 1,
    },
}


def _rolling_year_km(db: Session, user_id: int) -> float:
    now = datetime.now()
    rolling_start = max(now - timedelta(days=365), datetime(2026, 1, 1))
    q = db.query(sqlfunc.coalesce(sqlfunc.sum(Run.distance_km), 0.0)).filter(
        Run.user_id == user_id,
        Run.completed_at >= rolling_start,
    )
    return float(q.scalar() or 0.0)


def _photo_seasons_covered(db: Session, user_id: int) -> int:
    """Distinct seasons (meteorological N. hemisphere) among run photos."""
    rows = (
        db.query(Run.completed_at)
        .join(RunPhoto, RunPhoto.run_id == Run.id)
        .filter(RunPhoto.user_id == user_id, Run.user_id == user_id)
        .all()
    )
    seasons = set()
    for (dt,) in rows:
        if not dt:
            continue
        m = dt.month
        if m in (12, 1, 2):
            seasons.add(0)
        elif m in (3, 4, 5):
            seasons.add(1)
        elif m in (6, 7, 8):
            seasons.add(2)
        else:
            seasons.add(3)
    return len(seasons)


def _photo_route_buckets(db: Session, user_id: int) -> int:
    buckets = set()
    q = (
        db.query(Run.start_lat, Run.start_lng)
        .join(RunPhoto, RunPhoto.run_id == Run.id)
        .filter(RunPhoto.user_id == user_id, Run.user_id == user_id)
        .distinct()
        .all()
    )
    for lat, lng in q:
        if lat is None or lng is None:
            continue
        buckets.add((round(lat, 3), round(lng, 3)))
    return len(buckets)


def _pr_burst_max_in_month(all_runs: list) -> int:
    """Max count of PR improvements in any calendar month."""
    valid = {"1k", "2k", "3k", "5k", "8k", "10k", "15k", "18k", "21k"}
    sorted_runs = sorted(
        (r for r in all_runs if r.run_type in valid and r.completed_at),
        key=lambda r: r.completed_at,
    )
    best: dict[str, int] = {}
    by_month: dict[str, int] = defaultdict(int)
    for run in sorted_runs:
        rt = run.run_type
        prev = best.get(rt)
        if prev is None:
            best[rt] = run.duration_seconds
            key = run.completed_at.strftime("%Y-%m")
            by_month[key] += 1
        elif run.duration_seconds < prev:
            best[rt] = run.duration_seconds
            key = run.completed_at.strftime("%Y-%m")
            by_month[key] += 1
    return max(by_month.values(), default=0)


def get_personal_records(db: Session, user_id: int = None, category: str = None) -> dict:
    """Get personal records for each distance, optionally filtered by category."""
    min_date = datetime(2026, 1, 1)
    
    records = {}
    for run_type in ["1k", "2k", "3k", "5k", "8k", "10k", "15k", "18k", "21k"]:
        query = db.query(Run).filter(
            Run.run_type == run_type,
            Run.completed_at >= min_date
        )
        if user_id is not None:
            query = query.filter(Run.user_id == user_id)
        if category is not None:
            if category == 'outdoor':
                query = query.filter((Run.category == 'outdoor') | (Run.category == None))
            else:
                query = query.filter(Run.category == category)
        fastest = query.order_by(Run.duration_seconds.asc()).first()
        
        if fastest:
            mins = fastest.duration_seconds // 60
            secs = fastest.duration_seconds % 60
            distance = {"1k": 1, "2k": 2, "3k": 3, "5k": 5, "8k": 8, "10k": 10, "15k": 15, "18k": 18, "21k": 21}[run_type]
            pace_seconds = fastest.duration_seconds / distance
            pace_mins = int(pace_seconds // 60)
            pace_secs = int(pace_seconds % 60)
            
            records[run_type] = {
                "time": f"{mins}:{secs:02d}",
                "duration_seconds": fastest.duration_seconds,
                "pace": f"{pace_mins}:{pace_secs:02d}",
                "date": fastest.completed_at.strftime("%Y-%m-%d"),
                "run_id": fastest.id,
                "run_count": query.count(),
            }
        else:
            records[run_type] = None
    
    return records


def get_goals_progress(db: Session, yearly_goal: float = None, monthly_goal: float = None, user_id: int = None, joined_at: datetime = None) -> dict:
    """Get progress toward yearly and monthly goals, pro-rated for join date."""
    from calendar import monthrange

    full_yearly = yearly_goal if yearly_goal is not None else YEARLY_GOAL_KM
    full_monthly = monthly_goal if monthly_goal is not None else MONTHLY_GOAL_KM

    now = datetime.now()
    min_date = datetime(2026, 1, 1)

    # Pro-rate yearly goal: only count from the day the user joined
    if joined_at and joined_at.year == now.year and joined_at > min_date:
        days_in_year = 366 if now.year % 4 == 0 else 365
        days_remaining_from_join = (datetime(now.year + 1, 1, 1) - joined_at).days
        yearly_target = round(full_yearly * (days_remaining_from_join / days_in_year))
    else:
        yearly_target = full_yearly

    # Pro-rate monthly goal for the user's first month
    if joined_at and joined_at.year == now.year and joined_at.month == now.month:
        days_in_month = monthrange(now.year, now.month)[1]
        days_remaining_from_join = days_in_month - joined_at.day + 1
        monthly_target = round(full_monthly * (days_remaining_from_join / days_in_month))
    else:
        monthly_target = full_monthly

    def base_query():
        q = db.query(Run)
        if user_id is not None:
            q = q.filter(Run.user_id == user_id)
        return q

    year_start = datetime(now.year, 1, 1)
    year_runs = base_query().filter(
        Run.completed_at >= year_start,
        Run.completed_at >= min_date
    ).all()
    yearly_km = sum(r.distance_km for r in year_runs)
    yearly_percent = (yearly_km / yearly_target) * 100 if yearly_target > 0 else 0

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_runs = base_query().filter(
        Run.completed_at >= month_start,
        Run.completed_at >= min_date
    ).all()
    monthly_km = sum(r.distance_km for r in month_runs)
    monthly_percent = (monthly_km / monthly_target) * 100 if monthly_target > 0 else 0

    # Count months where full monthly goal was hit (only months after joining)
    first_month = joined_at.month if (joined_at and joined_at.year == now.year) else 1
    monthly_goals_hit = 0
    for month in range(first_month, now.month + 1):
        m_start = datetime(now.year, month, 1)
        m_end = datetime(now.year, month + 1, 1) if month < 12 else datetime(now.year + 1, 1, 1)

        m_runs = base_query().filter(
            Run.completed_at >= m_start,
            Run.completed_at < m_end
        ).all()
        m_km = sum(r.distance_km for r in m_runs)

        # For the joining month, compare against the pro-rated target
        if joined_at and joined_at.year == now.year and month == joined_at.month:
            days_in_m = monthrange(now.year, month)[1]
            days_active = days_in_m - joined_at.day + 1
            m_target = round(full_monthly * (days_active / days_in_m))
        else:
            m_target = full_monthly

        if m_km >= m_target:
            monthly_goals_hit += 1

    days_left_in_month = (datetime(now.year, now.month + 1 if now.month < 12 else 1, 1) - now).days
    days_left_in_year = (datetime(now.year + 1, 1, 1) - now).days

    # "on_track" uses time elapsed since join (not since Jan 1)
    if joined_at and joined_at.year == now.year and joined_at > min_date:
        elapsed_since_join = (now - joined_at).total_seconds()
        total_from_join = (datetime(now.year + 1, 1, 1) - joined_at).total_seconds()
        expected_fraction = elapsed_since_join / total_from_join if total_from_join > 0 else 0
    else:
        expected_fraction = now.timetuple().tm_yday / 365

    # Monthly expected fraction (from join date if joining month, else from 1st)
    if joined_at and joined_at.year == now.year and joined_at.month == now.month:
        days_in_month = monthrange(now.year, now.month)[1]
        days_active_in_month = days_in_month - joined_at.day + 1
        elapsed_in_month = (now - joined_at).total_seconds()
        total_in_month = days_active_in_month * 86400
        monthly_expected_pct = round(min(100, (elapsed_in_month / total_in_month) * 100)) if total_in_month > 0 else 0
    else:
        m_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        m_end_dt = datetime(now.year, now.month + 1, 1) if now.month < 12 else datetime(now.year + 1, 1, 1)
        monthly_expected_pct = round(min(100, ((now - m_start).total_seconds() / (m_end_dt - m_start).total_seconds()) * 100))

    return {
        "yearly": {
            "goal_km": yearly_target,
            "current_km": round(yearly_km, 1),
            "remaining_km": round(max(0, yearly_target - yearly_km), 1),
            "percent": round(yearly_percent),
            "days_remaining": days_left_in_year,
            "on_track": yearly_km >= (yearly_target * expected_fraction),
            "expected_percent": round(expected_fraction * 100),
        },
        "monthly": {
            "goal_km": monthly_target,
            "current_km": round(monthly_km, 1),
            "remaining_km": round(max(0, monthly_target - monthly_km), 1),
            "percent": round(monthly_percent),
            "days_remaining": days_left_in_month,
            "month_name": now.strftime("%B"),
            "is_complete": monthly_km >= monthly_target,
            "expected_percent": monthly_expected_pct,
        },
        "monthly_goals_hit": monthly_goals_hit,
    }


def get_achievements(db: Session, stats: dict, user_id: int = None, yearly_goal: float = None, monthly_goal: float = None) -> dict:
    """Get all achievements and their unlock status.

    Records the first time a badge transitions locked → unlocked into the
    ``user_achievements`` table so the Home "Recent milestones" strip can
    sort by real ``unlocked_at`` instead of the index-position proxy.
    """
    import crud
    from models import (
        StepEntry,
        RunPhoto,
        User,
        Walk,
        WalkPhoto,
        UserAchievement,
        WeeklyReflection,
        NeighbourhoodSave,
        NeighbourhoodIRanThis,
        CircleMembership,
        CircleCheckin,
    )

    min_date = datetime(2026, 1, 1)
    
    query = db.query(Run).filter(Run.completed_at >= min_date)
    if user_id is not None:
        query = query.filter(Run.user_id == user_id)
    all_runs = query.all()
    
    runs_by_type = {}
    outdoor_runs = 0
    treadmill_runs = 0
    runs_with_mood = 0
    great_mood_runs = 0
    run_dates = []
    weekly_runs = defaultdict(list)
    distinct_run_mood_ids: set = set()

    for run in all_runs:
        runs_by_type[run.run_type] = runs_by_type.get(run.run_type, 0) + 1
        cat = getattr(run, 'category', 'outdoor') or 'outdoor'
        if cat == 'treadmill':
            treadmill_runs += 1
        else:
            outdoor_runs += 1

        mood = getattr(run, 'mood', None)
        if mood:
            runs_with_mood += 1
            if mood == 'great':
                great_mood_runs += 1
            distinct_run_mood_ids.add(mood)

        if run.completed_at:
            run_dates.append(run.completed_at.date())
            iso = run.completed_at.isocalendar()
            week_key = f"{iso[0]}-W{iso[1]}"
            weekly_runs[week_key].append(run.run_type)
    
    # Weekly pattern stats
    max_runs_in_week = max((len(types) for types in weekly_runs.values()), default=0)
    max_types_in_week = max((len(set(types)) for types in weekly_runs.values()), default=0)
    
    # Consecutive days check
    has_consecutive_days = False
    if run_dates:
        sorted_dates = sorted(set(run_dates))
        for i in range(len(sorted_dates) - 1):
            if (sorted_dates[i + 1] - sorted_dates[i]).days == 1:
                has_consecutive_days = True
                break
    
    # Step data
    step_query = db.query(StepEntry)
    if user_id is not None:
        step_query = step_query.filter(StepEntry.user_id == user_id)
    step_entries = step_query.all()
    total_step_entries = len(step_entries)
    days_15k_steps = sum(1 for s in step_entries if s.step_count >= 15000)
    days_20k_steps = sum(1 for s in step_entries if s.step_count >= 20000)
    days_25k_steps = sum(1 for s in step_entries if s.step_count >= 25000)
    days_30k_steps = sum(1 for s in step_entries if s.step_count >= 30000)
    
    # Run photo / album roll-ups
    total_photos = 0
    runs_with_photos = 0
    photos_at_or_beyond_4km = 0
    photo_seasons_covered = 0
    photo_route_buckets = 0
    if user_id is not None:
        total_photos = db.query(RunPhoto).filter(RunPhoto.user_id == user_id).count()
        runs_with_photos = (
            db.query(sqlfunc.count(sqlfunc.distinct(RunPhoto.run_id)))
            .filter(RunPhoto.user_id == user_id)
            .scalar()
            or 0
        )
        photos_at_or_beyond_4km = (
            db.query(RunPhoto)
            .filter(RunPhoto.user_id == user_id, RunPhoto.distance_marker_km >= 4.0)
            .count()
        )
        photo_seasons_covered = _photo_seasons_covered(db, user_id)
        photo_route_buckets = _photo_route_buckets(db, user_id)

    # Runner level + zen + reflection + social
    runner_level = ""
    zen_unlocked = False
    zen_maintained_90d = False
    zen_maintained_180d = False
    zen_maintained_365d = False
    zen_returned = False
    rolling_km = 0.0
    reflection_count = 0
    distinct_reflection_moods = 0
    neighbourhood_shared_runs = 0
    neighbourhood_saves_received = 0
    neighbourhood_loves_received = 0
    neighbourhood_saves_of_others = 0
    circle_memberships = 0
    runs_circles_shared = 0
    circle_checkins = 0
    user_obj = None
    if user_id is not None:
        user_obj = db.query(User).filter(User.id == user_id).first()
        if user_obj:
            runner_level = getattr(user_obj, "runner_level", "") or ""
            rolling_km = _rolling_year_km(db, user_id)
            zen_unlocked = user_obj.zen_unlocked_at is not None
            if zen_unlocked and user_obj.zen_unlocked_at:
                days_since = (datetime.now() - user_obj.zen_unlocked_at).days
                ok = rolling_km >= 1000.0 and runner_level == "zen"
                zen_maintained_90d = ok and days_since >= 90
                zen_maintained_180d = ok and days_since >= 180
                zen_maintained_365d = ok and days_since >= 365
            zen_returned = (
                getattr(user_obj, "zen_demoted_at", None) is not None and runner_level == "zen"
            )

        reflection_count = db.query(WeeklyReflection).filter(WeeklyReflection.user_id == user_id).count()
        ref_moods = (
            db.query(sqlfunc.count(sqlfunc.distinct(WeeklyReflection.mood)))
            .filter(WeeklyReflection.user_id == user_id, WeeklyReflection.mood.isnot(None))
            .scalar()
            or 0
        )
        distinct_reflection_moods = int(ref_moods)

        neighbourhood_shared_runs = (
            db.query(Run)
            .filter(Run.user_id == user_id, Run.neighbourhood_visibility == "neighbourhood")
            .count()
        )
        neighbourhood_saves_received = (
            db.query(sqlfunc.count(NeighbourhoodSave.id))
            .join(Run, Run.id == NeighbourhoodSave.run_id)
            .filter(Run.user_id == user_id, NeighbourhoodSave.user_id != user_id)
            .scalar()
            or 0
        )
        neighbourhood_loves_received = (
            db.query(sqlfunc.count(NeighbourhoodIRanThis.id))
            .join(Run, Run.id == NeighbourhoodIRanThis.run_id)
            .filter(Run.user_id == user_id, NeighbourhoodIRanThis.user_id != user_id)
            .scalar()
            or 0
        )
        neighbourhood_saves_of_others = (
            db.query(sqlfunc.count(NeighbourhoodSave.id))
            .join(Run, Run.id == NeighbourhoodSave.run_id)
            .filter(NeighbourhoodSave.user_id == user_id, Run.user_id != user_id)
            .scalar()
            or 0
        )

        circle_memberships = (
            db.query(sqlfunc.count(CircleMembership.id))
            .filter(CircleMembership.user_id == user_id)
            .scalar()
            or 0
        )
        runs_circles_shared = (
            db.query(Run)
            .filter(
                Run.user_id == user_id,
                or_(Run.circles_share.is_(None), Run.circles_share == True),
            )
            .count()
        )
        circle_checkins = (
            db.query(sqlfunc.count(CircleCheckin.id))
            .filter(CircleCheckin.user_id == user_id)
            .scalar()
            or 0
        )
    
    goals = get_goals_progress(db, yearly_goal=yearly_goal, monthly_goal=monthly_goal, user_id=user_id)

    # Walk-stats roll-up — kept here (rather than in walk crud) so badge
    # checks stay self-contained inside achievements.py.
    total_walks = 0
    total_walk_km = 0.0
    longest_walk_km = 0.0
    public_walks_done = 0
    walks_with_photos = 0
    if user_id is not None:
        walk_q = db.query(Walk).filter(Walk.user_id == user_id)
        for w in walk_q:
            total_walks += 1
            total_walk_km += float(w.distance_km or 0)
            if (w.distance_km or 0) > longest_walk_km:
                longest_walk_km = float(w.distance_km or 0)
            if w.public_walk_id:
                public_walks_done += 1
        walks_with_photos = (
            db.query(sqlfunc.count(sqlfunc.distinct(WalkPhoto.walk_id)))
            .filter(WalkPhoto.user_id == user_id)
            .scalar()
            or 0
        )

    walk_current_streak = 0
    if user_id is not None:
        walk_current_streak, _ = crud.calculate_walk_streaks(db, user_id)

    pr_records = get_personal_records(db, user_id=user_id) if user_id is not None else {}
    pr_distances_held = sum(1 for v in pr_records.values() if v is not None)
    breath_keys = ["1k", "2k", "3k", "5k"]
    stride_keys = ["2k", "3k", "5k", "8k", "10k"]
    flow_keys = ["3k", "5k", "8k", "10k", "15k", "18k", "21k"]
    pr_breath_held = all(pr_records.get(d) for d in breath_keys)
    pr_stride_held = all(pr_records.get(d) for d in stride_keys)
    pr_flow_held = all(pr_records.get(d) for d in flow_keys)
    pr_burst_max_in_month = _pr_burst_max_in_month(all_runs)

    mood_canon = {"easy", "good", "tough", "great"}
    distinct_run_mood_count = len(distinct_run_mood_ids & mood_canon)

    extended_stats = {
        **stats,
        "total_walks": total_walks,
        "total_walk_km": round(total_walk_km, 2),
        "longest_walk_km": round(longest_walk_km, 2),
        "public_walks_done": public_walks_done,
        "walks_with_photos": walks_with_photos,
        "walk_current_streak": walk_current_streak,
        "runs_by_type": runs_by_type,
        "monthly_goals_hit": goals["monthly_goals_hit"],
        "yearly_goal_percent": goals["yearly"]["percent"],
        "outdoor_runs": outdoor_runs,
        "treadmill_runs": treadmill_runs,
        "total_step_entries": total_step_entries,
        "days_15k_steps": days_15k_steps,
        "days_20k_steps": days_20k_steps,
        "days_25k_steps": days_25k_steps,
        "days_30k_steps": days_30k_steps,
        "total_photos": total_photos,
        "runs_with_photos": runs_with_photos,
        "photos_at_or_beyond_4km": photos_at_or_beyond_4km,
        "photo_seasons_covered": photo_seasons_covered,
        "photo_route_buckets": photo_route_buckets,
        "runner_level": runner_level,
        "runs_with_mood": runs_with_mood,
        "great_mood_runs": great_mood_runs,
        "distinct_run_mood_count": distinct_run_mood_count,
        "max_runs_in_week": max_runs_in_week,
        "max_types_in_week": max_types_in_week,
        "has_consecutive_days": has_consecutive_days,
        "reflection_count": reflection_count,
        "distinct_reflection_moods": distinct_reflection_moods,
        "pr_distances_held": pr_distances_held,
        "pr_burst_max_in_month": pr_burst_max_in_month,
        "pr_breath_held": pr_breath_held,
        "pr_stride_held": pr_stride_held,
        "pr_flow_held": pr_flow_held,
        "zen_unlocked": zen_unlocked,
        "zen_maintained_90d": zen_maintained_90d,
        "zen_maintained_180d": zen_maintained_180d,
        "zen_maintained_365d": zen_maintained_365d,
        "zen_returned": zen_returned,
        "neighbourhood_shared_runs": neighbourhood_shared_runs,
        "neighbourhood_saves_received": int(neighbourhood_saves_received),
        "neighbourhood_loves_received": int(neighbourhood_loves_received),
        "neighbourhood_saves_of_others": int(neighbourhood_saves_of_others),
        "circle_memberships": int(circle_memberships),
        "runs_circles_shared": runs_circles_shared,
        "circle_checkins": int(circle_checkins),
    }
    
    # Pull existing unlock timestamps for this user so we can (a) annotate
    # the response and (b) detect locked → unlocked transitions to record.
    existing_unlocks: dict[str, datetime] = {}
    if user_id is not None:
        rows = db.query(UserAchievement).filter(UserAchievement.user_id == user_id).all()
        existing_unlocks = {r.achievement_id: r.unlocked_at for r in rows}

    unlocked = []
    locked = []
    new_unlock_rows: list[UserAchievement] = []
    now = datetime.now()
    achievement_total_active = sum(1 for a in ACHIEVEMENTS.values() if not a.get("legacy"))

    for achievement_id, achievement in ACHIEVEMENTS.items():
        if achievement.get("legacy"):
            continue
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
            ts = existing_unlocks.get(achievement_id)
            if ts is None and user_id is not None:
                # First time we've seen this badge unlocked — stamp now.
                # Existing badges that were already unlocked before this
                # feature shipped also get stamped on the first call after
                # deploy; they all share roughly the same timestamp, but
                # any future unlocks naturally sort newer than them.
                ts = now
                new_unlock_rows.append(UserAchievement(
                    user_id=user_id,
                    achievement_id=achievement_id,
                    unlocked_at=ts,
                ))
            achievement_data["unlocked_at"] = ts.isoformat() if ts else None
            unlocked.append(achievement_data)
        else:
            locked.append(achievement_data)

    if new_unlock_rows:
        try:
            db.bulk_save_objects(new_unlock_rows)
            db.commit()
        except Exception:
            db.rollback()

    return {
        "unlocked": unlocked,
        "locked": locked,
        "total": achievement_total_active,
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
