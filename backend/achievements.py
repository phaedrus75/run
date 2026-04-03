"""
🏆 ACHIEVEMENTS & GOALS SYSTEM
===============================

Tracks personal records, achievements, and goals.
100 achievements across 13 categories.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from models import Run

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

    # ---- SCENIC PHOTOS (6) ----
    "scenic_first": {
        "id": "scenic_first", "name": "Shutterbug",
        "description": "Take your first scenic photo on a run",
        "emoji": "📷", "category": "scenic",
        "check": lambda s: s.get("total_photos", 0) >= 1,
    },
    "scenic_5": {
        "id": "scenic_5", "name": "Photo Album",
        "description": "Take 5 scenic photos",
        "emoji": "🖼️", "category": "scenic",
        "check": lambda s: s.get("total_photos", 0) >= 5,
    },
    "scenic_10": {
        "id": "scenic_10", "name": "Photographer",
        "description": "Take 10 scenic photos",
        "emoji": "📸", "category": "scenic",
        "check": lambda s: s.get("total_photos", 0) >= 10,
    },
    "scenic_25": {
        "id": "scenic_25", "name": "Visual Storyteller",
        "description": "Take 25 scenic photos",
        "emoji": "🎞️", "category": "scenic",
        "check": lambda s: s.get("total_photos", 0) >= 25,
    },
    "scenic_3_runs": {
        "id": "scenic_3_runs", "name": "Scenic Explorer",
        "description": "Add photos to 3 different runs",
        "emoji": "🗺️", "category": "scenic",
        "check": lambda s: s.get("runs_with_photos", 0) >= 3,
    },
    "scenic_10_runs": {
        "id": "scenic_10_runs", "name": "Trail Documentarian",
        "description": "Add photos to 10 different runs",
        "emoji": "📖", "category": "scenic",
        "check": lambda s: s.get("runs_with_photos", 0) >= 10,
    },

    # ---- LEVELS (5) ----
    "level_stride": {
        "id": "level_stride", "name": "Finding Stride",
        "description": "Reach the Stride level",
        "emoji": "🌿", "category": "levels",
        "check": lambda s: s.get("runner_level", "") in ("stride", "flow", "zen"),
    },
    "level_flow": {
        "id": "level_flow", "name": "In the Flow",
        "description": "Reach the Flow level",
        "emoji": "🌊", "category": "levels",
        "check": lambda s: s.get("runner_level", "") in ("flow", "zen"),
    },
    "level_all_breath": {
        "id": "level_all_breath", "name": "Breath Complete",
        "description": "Run all Breath distances (1K, 2K, 3K, 5K)",
        "emoji": "🫁", "category": "levels",
        "check": lambda s: all(
            s.get("runs_by_type", {}).get(d, 0) >= 1
            for d in ["1k", "2k", "3k", "5k"]
        ),
    },
    "level_all_stride": {
        "id": "level_all_stride", "name": "Stride Complete",
        "description": "Run all Stride distances (2K, 3K, 5K, 8K, 10K)",
        "emoji": "👣", "category": "levels",
        "check": lambda s: all(
            s.get("runs_by_type", {}).get(d, 0) >= 1
            for d in ["2k", "3k", "5k", "8k", "10k"]
        ),
    },
    "level_all_flow": {
        "id": "level_all_flow", "name": "Flow Complete",
        "description": "Run all Flow distances (3K-21K)",
        "emoji": "🌊", "category": "levels",
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
}


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
    """Get all achievements and their unlock status."""
    from models import StepEntry, RunPhoto, User
    from collections import defaultdict
    
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
    
    # Scenic photo data
    total_photos = 0
    runs_with_photos = 0
    if user_id is not None:
        total_photos = db.query(RunPhoto).filter(RunPhoto.user_id == user_id).count()
        from sqlalchemy import func as sqlfunc
        runs_with_photos = db.query(sqlfunc.count(sqlfunc.distinct(RunPhoto.run_id))).filter(
            RunPhoto.user_id == user_id
        ).scalar() or 0
    
    # Runner level
    runner_level = ""
    if user_id is not None:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            runner_level = getattr(user, 'runner_level', '') or ''
    
    goals = get_goals_progress(db, yearly_goal=yearly_goal, monthly_goal=monthly_goal, user_id=user_id)
    
    extended_stats = {
        **stats,
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
        "runner_level": runner_level,
        "runs_with_mood": runs_with_mood,
        "great_mood_runs": great_mood_runs,
        "max_runs_in_week": max_runs_in_week,
        "max_types_in_week": max_types_in_week,
        "has_consecutive_days": has_consecutive_days,
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
