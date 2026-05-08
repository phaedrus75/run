# AI Guide — Scope of Work (the journey was the point)

> **Naming**: the AI feature is called **the Guide** in user-facing copy.
> Internal symbols still say `coach_*` (db columns, components, API
> namespace) to avoid a heavyweight rename. The system prompt opens
> with *"You are the ZenRun guide."*

> _A living document. Source of truth for what the AI coach is meant to do.
> Started as a journey-first feature, sprawled outwards, then we forgot
> the journey._

---

## 1. Where we started

The original ask:

> "AI running coach for light ultras (20k, 30k, 50k, 75k, 100k walk-runs)
> focusing on scenic routes, photos, and personalized coaching aligned
> with ZenRun's brand. The coach helps the user plan for a journey
> properly — before, in the lead-up to, and during the journey."

Then expanded to:

> "Coach for journey is good — but what about shorter GPS zenruns and
> also the treadmill run / run habit etc."

And:

> "During coach-recommended runs (short or journeys) the companion/coach
> should provide periodic feedback — every km acknowledgement. The user
> can turn off if they want."

**The shape we agreed on**: a coach with three concentric circles of
responsibility.

```
  ┌──────────────────────────────────────────────────────────┐
  │   3.  RUN HABIT  (everyday GPS runs, treadmill, walks)   │
  │   ┌────────────────────────────────────────────────────┐ │
  │   │   2.  COACHED RUNS  (specific session + voice TTS) │ │
  │   │   ┌──────────────────────────────────────────────┐ │ │
  │   │   │   1.  THE JOURNEY  (the slow ultra arc)      │ │ │
  │   │   │       — before, lead-up, during, after       │ │ │
  │   │   └──────────────────────────────────────────────┘ │ │
  │   └────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────┘
```

The journey was supposed to be the **inner core**. It's not.

---

## 2. What we built (Phases 1–5, shipped)

| Phase | Surface | Lives in |
|---|---|---|
| 1 | **Post-activity coach note** (Run + Walk) | `CoachNoteCard` on summary, detail, edit modal |
| 2 | **Daily Home card** ("today's recommendation") | `CoachTodayCard` on Home |
| 3 | **Ask the coach** (open chat) | `CoachChatSheet` from Home |
| 4 | **In-run voice companion** (TTS at start/km/halfway/finish) | `useCoachVoice` hook + `StartCoachRunModal` |
| 5 | **Journey lifecycle** (data model, screens, badges) | `JourneysScreen`, `JourneyDetailScreen`, `JourneyActiveCard`, `journey_id` on Run/Walk |

**Architecture in place** (good bones):

- Layered prompts: `BASE + ACTIVITY + STAGE + TASK + USER_CONTEXT`
- Single LLM client (`llm.py`) with stub mode for dev/CI
- Anthropic Claude Sonnet 4.5 as the only provider
- Server-side caching for daily card, run scripts, and coach notes
- Coach opt-in granular toggles per surface
- 11 `/coach/*` API endpoints + 8 `/journeys/*` endpoints

---

## 3. What we lost along the way

**The journey has zero AI in it.** None of the phases above are
journey-aware. Specifically:

| Promise | What was meant to happen | What actually happens |
|---|---|---|
| **Plan a journey** | Coach helps pick distance, route, day(s), prep | User picks tier from a static template list |
| **Lead-up to a journey** | Today's card + chat are aware of the upcoming journey, suggest taper / build | Today's card is journey-blind |
| **Pre-journey checklist** | Coach generates a personalised prep note (water, food, layers, plaster, charged phone) for 50k+ | Doesn't exist |
| **During the journey** | Voice companion mentions "this is your journey day-1 run, 7 of 30 km", today's card reframes around the journey | Voice and card don't know a journey is active |
| **Daily brief on multi-day journeys** | Day 2/3 of a 75k starts with a coach line: "Day 2 of 3. Yesterday: 18k. Today: aim for 16–20" | Doesn't exist |
| **Completion debrief** | Coach writes a short reflection on the journey itself ("30k around the river, photos at the bridge, mood steady") | Status flips to `completed`, no narrative |
| **Mid-journey chat** | Chat replies use journey progress, remaining km, days left, the user's pace so far | Chat ignores active journey |

The single TODO that captures the drift, sitting in `coach.py`:

```111:115:backend/coach.py
    stage = coach_prompts.infer_stage(
        runner_level=getattr(user, "runner_level", None),
        runs_last_60_days=runs_last_60,
        has_active_journey=False,  # wired in Phase 5
    )
```

That `False` is the gap. Phase 5 wired the data model and screens but
not the coach awareness.

---

## 4. The journey coaching arc — what it should be

Four temporal zones around any journey. Each one has its own AI surface.

### 4.1 BEFORE — discovery & start (one-shot)

When the user opens **Start a Journey**:

- The picker today is dumb (static templates per tier). Coach should
  **propose 1–2 tailored journey ideas** based on:
  - the user's home city (suggest a route the user already walks/runs near)
  - last 60 days of activity (don't suggest 75k to someone averaging 8k/week)
  - season/weather (avoid the obvious)
- For 50k+ tiers: a **one-shot prep note** generated when the journey
  starts, stored on `journey.plan_summary`. Water, food, layers, plaster,
  charged phone, route fallback.

### 4.2 LEAD-UP — the days before (zero-cost contextual)

The coach already has surfaces here; they just need to **know about the
upcoming journey**.

- **Today's card** in the 3 days before a planned journey:
  *"Saturday is the slow thirty. Today, an easy six. Save the legs."*
- **Chat** answers reference the upcoming journey naturally.
- **Stage inference** flips to `journeying` so prompts shift.

### 4.3 DURING — the journey itself

This is where the voice and card become journey-narrators.

**One-go journeys (20k / 30k)** — single day:
- The in-run voice companion is journey-aware:
  *"That's eight kilometres. A third of the way. Find a rhythm you'd
  hold for another two hours."*
- Mid-run, the runner can save and start a new run/walk — the journey
  total continues across them.

**Multi-day journeys (50k / 60k / 75k / 100k)** — across 2–3 days:
- **Daily brief** at the start of each journey day. Stored on the
  journey, regenerated only on the morning of each day:
  *"Day 2 of 3. Yesterday: 18 km along the canal — soft mood, fair pace.
  Today: 16–20 km feels right. The wind is south-easterly."*
- The daily brief is the **first thing the user sees** in the
  Active-journey strip on Home and Activity that day.
- Today's card is replaced by the daily brief while the journey is
  active.

### 4.4 AFTER — completion debrief (one-shot)

When the journey auto-completes (or the user marks it complete):

- The coach writes a **journey-level note** (3–5 sentences), stored on
  the journey row, shown on the JourneyDetail screen.
- It references the actual contributing runs/walks: distances, days,
  moods, photos taken.
- For abandoned journeys: nothing. Silence is the right tone.

---

## 5. Concrete things to build

In priority order. Each one is small.

### Tier A — The minimum to deliver the original promise (must-have)

1. **Wire `has_active_journey` into context** so every existing surface
   becomes journey-aware. Adds a "Journey: 30k, day 1 of 1, 7.4 of 30 km,
   window closes tonight" line to the user-context block. (≈ 30 lines)
2. **Journey completion note** — auto-generate on auto-complete and
   manual complete; store on `journey.completion_note` (new column);
   render on `JourneyDetailScreen`. (≈ 100 lines)
3. **Daily brief for multi-day journeys** — generate on the first
   activity of each new journey day; store on a new
   `JourneyDayBrief(journey_id, day_index, text, generated_at)` table;
   render at the top of `JourneyActiveCard` and `JourneyDetailScreen`
   while in-window. (≈ 200 lines)

### Tier B — Reaches the original ambition (high payoff)

4. **Pre-journey prep note** for 50k+ tiers, generated at journey
   creation; stored on `journey.plan_summary`. (≈ 60 lines)
5. **Coach-suggested journey ideas** in `StartJourneyScreen` — 1–2
   tailored cards above the static templates. New endpoint
   `GET /coach/journey-suggestions`. (≈ 150 lines)
6. **Journey-aware in-run voice** — when starting a coach-guided run
   that auto-attaches to a journey, the script knows it. (≈ 40 lines
   to thread `journey_id` into `generate_run_script`.)

### Tier C — Polish (postpone unless asked)

7. **Mid-journey check-in** — a small chat prompt at the end of day 1 of
   a multi-day journey. ("How did it feel? Anything to know for tomorrow?")
8. **Photo-aware completion note** — pull thumbnails of journey photos
   into the debrief (Claude vision; cost x5). Probably skip.

---

## 6. Cost & guardrails (still open)

Adding journey-aware surfaces multiplies LLM calls modestly. With caps:

- Daily brief: 1/day/active-journey, generated on first save of the day
- Completion note: 1/journey, generated once
- Prep note: 1/journey, only for 50k+
- Journey suggestions: cached for 24h per user

Rough add-on cost vs current: **~10–15% per active user** if they're
running journeys actively.

Per-user daily caps still need a decision (recommendation: 30 chat
turns / day, soft refusal beyond).

---

## 7. Refusal posture (settled)

Keep as-is in `coach_prompts.py`:

- No race coaching, marathon-tempo, lactate threshold, weight loss
- No emoji, no "crush / smash / PR / let's go"
- For pain / dizziness / medical: defer to a doctor
- Polite redirect to the run, the walk, the photo, the rhythm

---

## 8. The diagram, restated

```
   BEFORE                LEAD-UP              DURING                 AFTER
 ┌────────┐           ┌──────────┐         ┌──────────┐          ┌──────────┐
 │ Plan   │           │ Today's  │         │ Daily    │          │ Journey  │
 │ ideas  │           │ card     │         │ brief    │          │ note     │
 │ +      │   --->    │ knows    │  --->   │ +        │   --->   │ (debrief)│
 │ prep   │           │ journey  │         │ voice    │          │          │
 │ note   │           │ is near  │         │ knows    │          │          │
 └────────┘           └──────────┘         │ journey  │          └──────────┘
                                           └──────────┘
   Tier A.4 / B.5       Tier A.1            Tier A.1, A.3,           Tier A.2
   one-shot             zero-cost            B.6                     one-shot
```

Tier A is the minimum to call the journey-coach feature shipped. Tier B
is the experience we originally promised. Tier C is polish.

---

## 9. Status (updated as we go)

- [x] **Rename** — Coach → Guide across UI copy and the base system prompt
- [x] **A.1** — wire `has_active_journey` into context bundle
- [x] **A.2** — journey completion note (auto-generate on complete, render on detail)
- [x] **A.3** — daily brief for multi-day journeys (`journey_day_briefs` table, auto-generate on first activity of a new day, surfaced on `JourneyActiveCard`)
- [x] **B.4** — pre-journey prep note for 50k+ tiers (auto-generated into `plan_summary` on creation)
- [x] **B.5** — Guide-suggested journey ideas in `StartJourneyScreen` (`/coach/journey-suggestions?tier=...`)
- [x] **B.6** — journey-aware in-run voice script (auto-promotes activity layer + injects journey progress into plan)
- [x] **C.7** — "Check in with your Guide" entry point on active `JourneyDetailScreen` (chat is journey-aware globally)
- [x] **D.1** — **Plan-then-start lifecycle** — preview → plan → schedule → start, with readiness assessment + discrete prep checklist (`POST /journeys/preview`, `POST /journeys/{id}/start`, `POST /journeys/{id}/schedule`); planned journeys live alongside completed ones, many planned + one active per user
- [ ] **C.8** — photo-aware completion note (deferred — Claude vision, ~5× cost)

_Last updated: plan-then-start flow lands. Edit freely._

### 9.1 Plan-then-start lifecycle (new)

Tapping a Guide suggestion or static template card no longer creates a
journey. The flow now is:

```
StartJourney  →  JourneyPreview  →  JourneyDetail (planned)  →  Active
   pick           readiness +          countdown +
   tier +         checklist +          start/reschedule/
   card           date picker          cancel
                  → "Plan it"
                  → "Start now"
```

Backend additions:

- `journeys.status` adds `"planned"` (the new default).
- `journeys.scheduled_for`, `journeys.activated_at` columns.
- `journeys.readiness_note`, `journeys.prep_checklist_json` columns.
- `coach_prompts.journey_readiness` task — 1–2 honest sentences.
- `coach_prompts.journey_prep_checklist` task — 5–8 discrete items.
- `POST /journeys/preview` — read-only payload for the preview screen.
- `POST /journeys/{id}/start` — flips `planned → active`, resets the
  attribution window so it measures from activation.
- `POST /journeys/{id}/schedule` — reschedule before activation.
- `DELETE /journeys/{id}` now allows planned journeys (calling it
  "cancel" in the UI). Active and completed journeys still cannot be
  deleted.

Constraint: many planned + one active per user. Auto-attribution still
only fires for active journeys.

---

## 10. Cheatsheet — what the Guide does, by surface

| Where | What you see | When | Cost |
|---|---|---|---|
| Home — Today card | One-line nudge | First open of the day | ~80 tokens, cached |
| Home — Ask the Guide | Free chat | Whenever | ~600/turn |
| Run/Walk summary + detail | Guide's note | After save | ~250, cached on activity |
| In-run voice | TTS at start/km/halfway/finish | When you start a guided run | ~1200 once, cached |
| Activity strip — active | Progress + today's brief | While a journey is active | brief: 1/day |
| Activity strip — planned | Countdown to nearest planned journey | Whenever no active is running | none (re-uses preview content) |
| Journey detail (planned) | Readiness + prep checklist + start/reschedule | Planned status only | content cached at preview |
| Journey detail (active) | "Check in with your Guide" → chat | Active journeys only | shared chat budget |
| Journey detail (completed) | Guide's debrief note | On completion | 1/journey |
| Start journey | "From your Guide" suggestions | Tier change | 1/tier change/day (suggested) |
| Journey preview (NEW) | Readiness, prep checklist, date picker | Card tap | 2 calls/preview (read + checklist) |
| Guide-suggested route (NEW) | Waypoints + walkable polyline + step-by-step directions | Suggestion generation | 1 LLM + N geocodes + N OSRM calls per suggestion (cached on suggestion) |
| 50k+ creation | Prep note auto-stored on `plan_summary` | At commit | 1/journey |
