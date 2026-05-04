# 🏃 ZenRun Product Roadmap

## 📋 Overview

This document tracks the product roadmap for ZenRun - a mobile app for tracking runs, achieving goals, and staying motivated.

---

## ✅ Completed Features

### v1.0 - Core Features (Done)
- [x] **Run Tracking** - Timer for 3k, 5k, 10k, 15k, 18k, 21k distances
- [x] **Run History** - View and edit past runs
- [x] **Backdated Runs** - Add runs from past dates
- [x] **Weekly/Monthly Stats** - Charts and summaries
- [x] **Personal Records** - Fastest times per distance
- [x] **Achievements** - 21 badges to unlock
- [x] **Goals** - 1000km yearly, 100km monthly
- [x] **Weekly Streak** - 1 long run + 2 short runs = streak
- [x] **Weight Tracking** - 209lb → 180lb goal
- [x] **Motivation Banner** - Encouraging messages
- [x] **Pace Trend Chart** - See pace improvement over time

### v1.5 - Walks 🚶 (Done)
- [x] **Map-based GPS walk tracking** with live route, distance, duration & pace (`expo-maps` + `expo-location`)
- [x] **Walk model + endpoints** with Postgres migration, polyline storage, photos & metadata
- [x] **Walk hub screen** — recent walks, quick stats, "Start a walk" CTA
- [x] **Walk detail screen** — map, stats, mood, notes, photos with route pins
- [x] **Walk summary flow** — mood + notes capture before save
- [x] **Walk photos** — capture during/after walk, snapped to nearest route point
- [x] **Walk stats section** on the Stats screen + walk roll-up on Home
- [x] **Discover walks** screen — public walks from OpenStreetMap (Overpass API), location-aware
- [x] **Public walk detail** screen with route preview & "Start this walk" CTA
- [x] **Background tracking** opt-in (`expo-task-manager` + foreground service notification + battery-conscious sampling)
- [x] **Walking achievements** category (12 new badges across walk count, distance, longest walk, public walks, photo walks)

---

## 🚧 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| - | - | - |

---

## 📅 Planned Features

### v1.1 - Better Insights
| Priority | Feature | Description |
|----------|---------|-------------|
| 🔴 High | **Run Calendar/Heatmap** | Visual calendar showing run intensity per day |
| 🔴 High | **Best Day Analysis** | "You run best on Saturdays at 7am" |
| 🟡 Medium | **Run Tags** | Tag runs: #hills #easy #race #intervals |
| 🟡 Medium | **Search & Filter** | Find runs by date, distance, notes |

### v1.2 - Training & Planning
| Priority | Feature | Description |
|----------|---------|-------------|
| 🔴 High | **Training Plans** | Couch to 5K, 5K to 10K programs |
| 🟡 Medium | **Race Day Mode** | Countdown to a race with prep tips |
| 🟡 Medium | **Rest Day Tracking** | Log and recommend rest days |
| 🟢 Low | **Interval Training** | Track interval workouts |

### v1.3 - Health Integration
| Priority | Feature | Description |
|----------|---------|-------------|
| 🟡 Medium | **Apple Health Sync** | Read/write runs to HealthKit |
| 🟡 Medium | **Sleep Logging** | Track sleep quality impact on runs |
| 🟢 Low | **Heart Rate Zones** | Manual HR zone input |
| 🟢 Low | **Hydration Tracking** | Log water intake |

### v1.4 - Engagement & Social
| Priority | Feature | Description |
|----------|---------|-------------|
| 🔴 High | **Push Notifications** | Run reminders |
| 🟡 Medium | **Share Stats** | Export stats as images for social |
| 🟢 Low | **Dark Mode Toggle** | Switch between light/dark themes |
| 🟢 Low | **Widgets** | Home screen widgets |

### Future Ideas
| Feature | Description |
|---------|-------------|
| **Weather Integration** | Log weather conditions |
| **Audio Coaching** | Voice prompts during runs |
| **Social Leaderboards** | Compete with friends |
| **Strava Import** | Import past runs from Strava |

---

## 🐛 Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| - | - | - |

---

## 💡 Feature Requests

*Add new feature ideas here*

1. ~~**True milestone recency tracking**~~ ✅ *Done — `user_achievements` table records `unlocked_at` on each locked → unlocked transition; Home strip now sorts by real recency and is renamed "Recent milestones."*
2. ~~**Migrate `ScenicRunsScreen` to the thumb + on-demand-full pattern**~~ ✅ *Done — list/grid uses `thumb_data` and the lightbox lazy-fetches `/runs/<id>/photos/<photo_id>/full` on tap, matching WalkDetail / EditRunModal / CircleSpace.*
3. 

---

## 📊 Metrics to Track

- Daily/Weekly Active Users
- Runs logged per user per week
- Streak completion rate
- Goal achievement rate
- App retention (Day 1, Day 7, Day 30)

---

## 🗓️ Release History

| Version | Date | Highlights |
|---------|------|------------|
| v1.0 | Jan 2026 | Initial release with core features |

---

## 📝 How to Use This Roadmap

1. **Add new ideas** to "Feature Requests" section
2. **Prioritize** and move to "Planned Features" with priority level
3. **Track progress** by moving to "In Progress"
4. **Mark complete** by moving to "Completed Features"

Priority Levels:
- 🔴 **High** - Do next
- 🟡 **Medium** - Important but not urgent
- 🟢 **Low** - Nice to have

---

*Last updated: May 2026 — feature requests #1 and #2 shipped.*
