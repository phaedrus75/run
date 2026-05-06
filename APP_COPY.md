# ZenRun — App Copy

> All the user-facing strings inside the iOS / Apple Watch app, organised
> by surface so we can edit them and iterate. Source files live in
> `frontend/screens/`, `frontend/components/`, and `backend/` (for
> server-rendered messages: daily wisdom, motivation, achievements,
> seasonal markers).

> **House voice (from `BRAND.md`):** warm, calm, plain, patient, visual.
> Short sentences. Friendly second-person. The path and the album. Show
> up. Reflect.

---

## 0. Brand basics

- **App name:** ZenRun
- **Tagline (short):** Show up. Reflect.
- **One-liner (used in TestFlight / App Store):** A running journal built
  around two halves of one practice — the path you take, and the album
  you enjoy afterwards.
- **Pillars:** **The path** (act of running) · **The album** (looking back)

---

## 1. Onboarding

> Source: `frontend/screens/OnboardingScreen.tsx`

### 1.1 Slide carousel (5 slides)

Header brand row: **ZenRun** logo + wordmark. Top-right action: **Skip**.

**Slide 1 — Philosophy 1**
- Eyebrow: THE ZENRUN PHILOSOPHY
- Title: **Run first.\\nTrack second.**
- Body: Most apps want you to carry your phone, watch your pace, and
  analyze every step. ZenRun is different. Run however you want — then
  log it in 2 seconds when you're back.

**Slide 2 — Philosophy 2**
- Eyebrow: CONSISTENCY OVER PERFECTION
- Title: **Find your\\nrhythm.**
- Body: Run at least twice a week. That's your rhythm. Keep it going and
  watch it grow — 66 days of consistency turns running into a habit that
  stays.

**Slide 3 — Quick logging**
- Eyebrow: QUICK LOGGING
- Title: **Log in\\n2 seconds.**
- Body: Pick your distance, hit start, run. When you're done, tap stop.
  That's it — no GPS, no phone in your pocket, no fuss.
- _Stale: GPS is now a real, optional part of the app. Rewrite._
- Visual: 3K · 5K · 10K chips with `12:34` timer, "tap to start".

**Slide 4 — Rhythm & milestones**
- Eyebrow: QUIET CELEBRATIONS
- Title: **Rhythm &\\nmilestones.**
- Body: Your rhythm grows each week you show up. Hit milestones along
  the way — 100 of them — without the pressure of daily streaks.
- Visual: weekly bars + "10 runs" / "50 km" badges.

**Slide 5 — Circles**
- Eyebrow: FRIENDLY ACCOUNTABILITY
- Title: **Run with\\nyour circle.**
- Body: Create a circle with up to 10 friends. See who's running, cheer
  each other on, and keep each other accountable — no leaderboards, just
  showing up together.
- Visual: 4 avatars → "Weekend Warriors".

**Footer button**
- On all but last slide: **Next**
- On last slide: **Get started**

---

### 1.2 Level picker

- Eyebrow: YOUR RUNNING JOURNEY
- Title: **Where are you today?**
- Sub: Pick what feels right. This sets your default distances and goals.
  You can always change it later.

**Level cards**

1. 🌱 **Breath** — _Every journey begins with a single breath_
   - Distances: 1K · 2K · 3K · 5K
   - Description: Perfect for getting started or getting back into running.
2. 🏃 **Stride** — _You've found your stride_
   - Distances: 2K · 3K · 5K · 8K · 10K
   - Description: You run regularly and want to push a little further.
3. 🌊 **Flow** — _Running in flow_
   - Distances: 3K · 5K · 8K · 10K · 15K · 18K · 21K
   - Description: Seasoned runner. From casual 3Ks to half marathons.

> _(There is also a "Zen" level mentioned on Support page; align this
> with the in-app picker. Currently picker shows Breath / Stride / Flow
> only.)_

CTA: **Continue**

---

### 1.3 Goal setup

- Eyebrow: RUNNING GOALS
- Title: **Set your targets**
- Sub: These keep you accountable. You can adjust anytime in Profile.

Recommended banner:
> Recommended for {Level}: {yearly} km/year, {monthly} km/month

Goal cards:
- **Yearly** · {input} km
- **Monthly** · {input} km

Tip box:
> 1000 km/year = about 20 km/week.\\nStart where you are. Adjust as you go.

CTA: **Continue**

---

### 1.4 Beta opt-in

- Icon header (flask)
- Eyebrow: EXPERIMENTAL
- Title: **Try beta features**
- Sub: These are optional extras we're still refining. You can turn them
  on or off anytime in Profile.

Toggles:
- 👣 **High Step Days** — Track your daily step count and celebrate big step days
- ⚖️ **Weight Tracking** — Log your weight and track trends over time

CTA: **Continue**

---

### 1.5 Pick your handle

- Eyebrow: ALMOST THERE
- Title: **Pick your handle**
- Sub: This is your unique identity on ZenRun. Friends will find you by
  this name.

- Input prefix: **@**, placeholder: `yourname`
- Hint (default): `This can't be changed later`
- Errors:
  - `Handle must be at least 3 characters`
  - `Only letters, numbers, and underscores`
  - `Handle not available`
  - `Something went wrong. Please try again.`

CTA: **Continue** (or **Setting up…** while saving)

---

### 1.6 Verify email

- Icon header (mail)
- Eyebrow: ONE LAST STEP
- Title: **Verify your email**
- Sub: We sent a 6-digit code to your email. Enter it below to finish
  setting up your account.

- Input placeholder: `000000`
- Errors: `Enter the 6-digit code from your email` · `Invalid code. Please try again.`
- Resend states: `Didn't get the code? Resend` · `Sending…` · `Code sent!` · `Failed to resend code`

CTA: **Let's run** (or **Verifying…**)

---

## 2. Auth — Sign up / Log in (in-app)

> Source: `frontend/screens/AuthScreen.tsx` (and friends). Edit with the
> same pillars (warm, plain, second-person).

Suggested copy to align with web `/login`:

- Login title: **Welcome back**
- Login sub: Sign in to keep your rhythm going.
- Sign-up title: **Start your journal**
- Sign-up sub: Two seconds to log a run. The rest is the journey.
- Forgot password helper: **Forgot password?**
- Reset code prompt: **Check your email for a 6-digit code.**

---

## 3. Home screen

> Source: `frontend/screens/HomeScreen.tsx`

### 3.1 Greeting (time-based)

- Pre-noon: **Good morning, {Name}**
- Noon → 6pm: **Good afternoon, {Name}**
- After 6pm: **Good evening, {Name}**
- Fallback name: `Runner`

### 3.2 Daily wisdom card

> "{quote}"\\n— {author}

(Backend `/daily-wisdom` returns a deterministic quote per day. Full list
in §10.)

### 3.3 Level upgrade banner (when eligible)

- Title: **Your practice is deepening**
- Body: You've been running {maxDistance} every week for a month. {NextLevelName} distances are calling.
- Confirm alert: `{emoji} Your path deepens` / `You've grown into {Level}. New distances await you.`

### 3.4 Comeback / rest banners

- Comeback (👋): **Welcome back.** / Your rhythm starts fresh. Good to see you.
- Rest (🌿): _no title_ / **You took a breather last week. Your body rebuilds during rest.**

### 3.5 Recent moments (scenic photos)

- Section title: **Recent moments**
- Action: **See all** → Album

### 3.6 Recent milestones

- Section title: **Recent milestones**
- Counter: `{n} unlocked`
- Action: **See all** → Honors
- Badge tap → opens `AchievementDetailModal` (see §6).

### 3.7 Your journey (lifetime stats)

- Section title: **Your journey**
- Stat tiles: `{n} runs` · `{km} km` · `{hours} hours`
- Combined-with-walks line: **Plus walking** / `{walkKm} km`

### 3.8 Motivation banner (random)

> {emoji} {message}

(Backend `/motivation` returns either a milestone message or a random
one. Full list in §9.)

### 3.9 Seasonal markers (when applicable)

> {seasonEmoji} {message}

Examples:
- `Your first spring run`
- `You ran through all of summer`
- `27 runs this fall`

### 3.10 Empty / loading

- Loading splash text: **ZenRun**

---

## 4. Run logging — quick log (`RunScreen`)

> Source: `frontend/screens/RunScreen.tsx`

### 4.1 Header & form

- Screen title: **Log a Run**
- Section: **Distance** — chips: `1K · 2K · 3K · 5K · 8K · 10K · 15K · 18K · 21K` (filtered by level).
- Categories: `🌳 Outdoor` · `🏃 Treadmill`
- Section: **Duration** — `MM` `SS` placeholders `00`/`00`. Toggle: timer mode.

### 4.2 Run-in-progress quotes

A random quote shown while the timer runs (source: in-screen `QUOTES`):

- "The only opponent you have to beat is yourself, the way you used to be." — Haruki Murakami
- "It is only necessary that he runs and runs. Then one day he will see order and law and love." — George Sheehan
- "Trust your body and keep things simple." — Christopher McDougall
- "All I do is keep on running in my own cozy, homemade void. And this is a pretty wonderful thing." — Haruki Murakami
- "The real purpose of running isn't to win a race. It's to test the limits of the human heart." — Bill Bowerman
- "Every morning in Africa, a gazelle wakes up. It knows it must outrun the fastest lion or it will be killed. It doesn't matter whether you are the lion or a gazelle — when the sun comes up, you'd better be running." — Born to Run
- "Running is the greatest metaphor for life, because you get out of it what you put into it." — Oprah Winfrey
- "Exerting yourself to the fullest within your individual limits: that's the essence of running." — Haruki Murakami
- "We are what we repeatedly do. Excellence, then, is not an act, but a habit." — Aristotle
- "The miracle isn't that I finished. The miracle is that I had the courage to start." — John Bingham
- "You showed up. That's what matters." — ZenRun
- "Another run in the books. The rhythm continues." — ZenRun
- "You didn't run to be fast. You ran to feel alive." — ZenRun
- "Consistency is the only metric that matters. You're building it." — ZenRun

### 4.3 Celebration / save flow

- Title: **Run logged.**
- Summary fields: `Time`, `Distance`, `Pace`
- Mood prompt: **How did it feel?** — `😌 Easy` · `😊 Good` · `😤 Tough` · `🤩 Great`
- Reflection input (one line, 100 chars max): placeholder `Any thoughts on the run?`
- Photos CTA: **📸 Add scenic photos**
- Photo flow:
  - Pick state: **+ Add another photo** / **📷 Pick a photo**
  - Marker prompt: **Where was this taken?**
  - Caption placeholder: `Add a caption (optional)`
  - Save: **Save photo**
- Footer buttons: **Done** · **Log Another**

---

## 5. Run / Walk summary screens (post-GPS)

> Sources: `frontend/screens/RunSummaryScreen.tsx`, `WalkSummaryScreen.tsx`.

### 5.1 Run Summary

- Top: emoji + distance, time, pace
- Sections we surface:
  - **Map** of the route
  - **Heart rate** (if from Watch)
  - **Photos** — "**Add a scenic moment**" (placeholder when none)
  - **Mood** — same 4 chips as above
  - **Reflection** — placeholder `Any thoughts on the run?`
- Save button: **Save run**

### 5.2 Walk Summary

- Title: **Walk logged.** (suggested — confirm in source)
- Same structure: map → photos → mood → reflection.
- Save button: **Save walk**

> _(If the screens deviate from this in the source, edit here to match
> what you'd like the user to read; we'll fold edits back into source.)_

---

## 6. Achievement / badge modal

> Source: `frontend/components/AchievementDetailModal.tsx`

- Centered card with emoji, **{Achievement Name}**, category label.
- Description label (small, uppercase): **WHAT THIS BADGE MEANS**
  > {description}\\n_(fallback: "A meaningful milestone on your running journey.")_
- Dismiss: top-right ✕ icon, or backdrop tap. (No bottom button.)

### Milestone unlock sequence (multiple unlocks)

> Source: `frontend/components/MilestoneUnlockSequence.tsx`

- Confetti on entry.
- One badge at a time. Tap ✕ or backdrop to advance.
- After last, normal celebration / route navigation continues.

---

## 7. Honors (Achievements page)

> Source: `frontend/screens/HonorsScreen.tsx`

- Top sections: **The path** / **The album** (badges grouped by family).
- Tap a badge → opens the detail modal in §6.
- Each badge displays: emoji, name, locked/unlocked state, optional progress.

(Header copy currently inherited from screen — keep simple and aligned
with the path/album split.)

---

## 8. Achievement library (badges)

> Source: `backend/achievements.py` — 100 badges across 9 active
> categories. Names + descriptions are surfaced in the detail modal,
> Honors page, and unlock sequence.

Counts by category (current):

| Category | Count | Theme |
|---|---|---|
| `milestone` (run count) | 12 | First Steps → A Thousand Steps |
| `distance` (total km) | 12 | Warming Up → Full World |
| `distance_type` (per-distance counts) | 10 | First 5K → 5K Master |
| `specialist` (per-distance volume) | 12 | Long-distance specialist ladders |
| `streak` (rhythm) | 15 | Sapling → Wildfire |
| `goals` (yearly/monthly) | 8 | First Goal → Full Moon |
| `category` (outdoor/treadmill, mixed) | 8 | Trail Lover → Crossover |
| `steps` (high step days) | 8 | First Steps → Mountain Days |
| `album` (scenic photos / albums) | 13 | First Photo → Compass Journal |
| `levels` (legacy, hidden) | 2 | — |

**Editing tips**

- Names: 1–3 words, evocative, drawn from nature (roots, trees, water,
  mountain, weather) — match BRAND.md's "warm + plain" voice.
- Descriptions: short, declarative, ≤ 7 words where possible. Read like
  a journal entry, not a quest log. e.g. "Run 100km total." (current)
  could read "100km on your shoes." — open question for iteration.

If you want to rewrite specific badges, list them inline below and we'll
fold back into source.

```
# Run-count milestone (sample of current copy)
first_run     🌱  First Steps      Complete your first run
runs_5        🌿  Taking Root      Complete 5 runs
runs_10       🍀  Double Digits    Complete 10 runs
runs_25       🌾  Steady Ground    Complete 25 runs
runs_50       🌳  Deep Roots       Complete 50 runs
runs_75       🍃  The Practice     Complete 75 runs
runs_100      🏔️  Century          Complete 100 runs
runs_200      🪨  Quiet Strength   Complete 200 runs
runs_300      🛤️  Worn Trail       Complete 300 runs
runs_500      🌲  Five Hundred     Complete 500 runs
runs_750      🌊  Ancient Oak      Complete 750 runs
runs_1000     🗻  A Thousand Steps Complete 1000 runs
```

> Add `# REWRITE:` lines under any badge you'd like to revise; we'll
> apply them in `backend/achievements.py`.

---

## 9. Motivation messages (Home banner)

> Source: `backend/crud.py` → `MOTIVATIONAL_MESSAGES` & `MILESTONE_MESSAGES`.

### 9.1 Random rotation (10)

| Emoji | Message |
|---|---|
| 🏃 | You showed up. That's the whole game. |
| 🔁 | Consistency beats intensity. Always. |
| 🌿 | Run today. Worry about pace never. |
| ✓ | The best run is the one you actually do. |
| 📈 | Progress, not perfection. |
| 🫀 | Your body was built to move. |
| 📝 | Every logged run is proof you showed up. |
| 🧘 | Running is moving meditation. |
| 🗺️ | Small runs add up to big journeys. |
| 💨 | Less thinking, more running. |

### 9.2 Run-count milestone messages

When `total_runs ∈ {1, 5, 10, 25, 50, 100}` the banner upgrades:

| Runs | Emoji | Message | Achievement |
|---|---|---|---|
| 1 | 🎉 | First run logged. Your rhythm starts now. | First Steps |
| 5 | 🌱 | 5 runs in. The habit is forming. | Taking Root |
| 10 | 🏃 | 10 runs. You're a runner now. | Double Digits |
| 25 | ⭐ | 25 runs. Consistency is your superpower. | Quarter Century |
| 50 | 🏔️ | 50 runs. This is who you are now. | Half Century |
| 100 | 👑 | 100 runs. Respect the journey. | Century Club |

> _(These names are slightly out-of-sync with the achievement library in
> §8 — e.g. lib uses "Century" at 100 runs, message says "Century Club".
> Worth aligning.)_

---

## 10. Daily wisdom (deterministic per day)

> Source: `backend/main.py` → `DAILY_QUOTES` (64 entries). Cycles through
> the year by `day_of_year % len(quotes)`.

The full current list — edit in place; we'll resync the source array.

1. "Sometimes we complicate things with gadgets and gear, when what we really need is to trust our bodies and keep things simple." — Christopher McDougall
2. "All I do is keep on running in my own cozy, homemade void, my own nostalgic silence. And this is a pretty wonderful thing." — Haruki Murakami
3. "The only opponent you have to beat is yourself, the way you used to be." — Haruki Murakami
4. "The runner need not break four minutes in the mile or four hours in the marathon. It is only necessary that he runs." — George Sheehan
5. "If you run, you are a runner. It doesn't matter how fast or how far." — John Bingham
6. "Running is nothing more than a series of arguments between the part of your brain that wants to stop and the part that wants to keep going." — Unknown
7. "The real purpose of running isn't to win a race. It's to test the limits of the human heart." — Bill Bowerman
8. "I run because long after my footprints fade far away, my running will leave imprints in my mind forever." — Budd Coates
9. "There is magic in misery. Just ask any runner." — Dean Karnazes
10. "We run, not because we think it is doing us good, but because we enjoy it and cannot help ourselves." — Roger Bannister
11. "Believe that you can run farther or faster. Believe that you are young enough, old enough, strong enough." — Percy Cerutty
12. "The obsession with running is really an obsession with the potential for more and more life." — George Sheehan
13. "Out on the roads there is fitness and self-discovery and the persons we were destined to be." — George Sheehan
14. "Running allows me to set my mind free. Nothing seems impossible." — Kara Goucher
15. "Pain is inevitable. Suffering is optional." — Haruki Murakami
16. "Every morning in Africa, a gazelle wakes up knowing it must outrun the fastest lion or it will be killed. Every morning a lion wakes up knowing it must run faster than the slowest gazelle or it will starve. It doesn't matter whether you're a lion or a gazelle — when the sun comes up, you'd better be running." — Christopher McDougall
17. "The body does not want you to do this. As you run, it tells you to stop but the mind casts it aside and says keep going." — Jacki Hanson
18. "Ask nothing from your running, and you'll get more than you ever imagined." — Christopher McDougall
19. "I always loved running — it was something you could do by yourself and under your own power." — Jesse Owens
20. "Go fast enough to get there, but slow enough to see." — Jimmy Buffett
21. "Run often. Run long. But never outrun your joy of running." — Julie Isphording
22. "I don't run to add days to my life, I run to add life to my days." — Ronald Rook
23. "The miracle isn't that I finished. The miracle is that I had the courage to start." — John Bingham
24. "Your body will argue that there is no justifiable reason to continue. Your only recourse is to call on your spirit, which fortunately functions independently of logic." — Tim Noakes
25. "Consistency is the true foundation of trust. Either keep your promises or do not make them." — Roy T. Bennett
26. "It does not matter how slowly you go as long as you do not stop." — Confucius
27. "Success isn't always about greatness. It's about consistency. Consistent hard work leads to success." — Dwayne Johnson
28. "Life is a marathon, not a sprint. Pace yourself accordingly." — Amby Burfoot
29. "Running is the greatest metaphor for life, because you get out of it what you put into it." — Oprah Winfrey
30. "There are clubs you can't belong to, neighborhoods you can't live in, schools you can't get into, but the roads are always open." — Nike
31. "A lot of people run a race to see who is fastest. I run to see who has the most guts." — Steve Prefontaine
32. "If you want to win something, run 100 metres. If you want to experience something, run a marathon." — Emil Zátopek
33. "No human is limited." — Eliud Kipchoge
34. "Only the disciplined ones are free in life." — Eliud Kipchoge
35. "The marathon is a charismatic event. It has everything. It has drama. It has competition. It has camaraderie." — Fred Lebow
36. "The marathon can humble you." — Bill Rodgers
37. "You have to forget your last marathon before you try another. Your mind can't know what's coming." — Frank Shorter
38. "The will to win means nothing without the will to prepare." — Juma Ikangaa
39. "Don't dream of winning. Train for it." — Mo Farah
40. "Every marathon is a new beginning." — Grete Waitz
41. "Stadiums are for spectators. Runners have the roads, trails, and tracks." — Amby Burfoot
42. "Run when you can, walk if you have to, crawl if you must — just never give up." — Dean Karnazes
43. "Sometimes you just do things." — Scott Jurek
44. "I don't think limits." — Usain Bolt
45. "I am building a fire, and every day I train, I add more fuel. At just the right moment, I light the match." — Mia Hamm
46. "We are what we repeatedly do. Excellence, then, is not an act, but a habit." — Aristotle
47. "He who is not courageous enough to take risks will accomplish nothing in life." — Muhammad Ali
48. "Energy and persistence conquer all things." — Benjamin Franklin
49. "Well done is better than well said." — Benjamin Franklin
50. "The secret of getting ahead is getting started." — Mark Twain
51. "You do not rise to the level of your goals. You fall to the level of your systems." — James Clear
52. "Small disciplines repeated with consistency lead to great achievements gained slowly over time." — John C. Maxwell
53. "The impediment to action advances action. What stands in the way becomes the way." — Marcus Aurelius
54. "Begin at once to live, and count each separate day as a separate life." — Seneca
55. "How long are you going to wait before you demand the best for yourself?" — Epictetus
56. "The harder the conflict, the more glorious the triumph." — Thomas Paine
57. "What lies behind us and what lies before us are tiny matters compared to what lies within us." — Ralph Waldo Emerson
58. "The future belongs to those who believe in the beauty of their dreams." — Eleanor Roosevelt
59. "You are never too old to set another goal or to dream a new dream." — C.S. Lewis
60. "The only way to prove that you're a good sport is to lose." — Ernie Banks
61. "Winning doesn't always mean being first. Winning means you're doing better than you've ever done before." — Bonnie Blair
62. "You miss 100% of the shots you don't take." — Wayne Gretzky
63. "It always seems impossible until it's done." — Nelson Mandela
64. "The man who moves a mountain begins by carrying away small stones." — Confucius

---

## 11. Seasonal markers

> Source: `backend/main.py` (`/seasonal-markers`).
> Seasons: 🌸 spring (Mar–May) · ☀️ summer (Jun–Aug) · 🍂 fall (Sep–Nov) · ❄️ winter (Dec–Feb).

| Trigger | Message template |
|---|---|
| First run of the season | `Your first {season} run` |
| Ran in every month of the season | `You ran through all of {season}` |
| ≥ 25 runs in the season | `{n} runs this {season}` |
| ≥ 50 runs in the season | `{n} runs this {season}` |

---

## 12. Drawer / navigation

> Source: `frontend/components/AppDrawer.tsx`

| Icon | Label | Subtext |
|---|---|---|
| 👤 | Profile | Privacy, level, handle |
| 🚩 | Goals | _(scrolls to Goals on Profile)_ |
| 🎀 | Honors | PRs & achievements |
| 📊 | Run statistics | Charts, pace, rhythm |
| 📈 | Walk statistics | Averages & totals |
| 📅 | Month & quarter in review | Wrapped summaries |
| 🏋️ | Gym | Strength sessions |
| ⚖️ | Weight | Track weight |
| 👣 | High step days | 15k / 20k / 25k days |
| 💬 | Feedback | Tell us what you think |
| 🍃 | About | The path and the album |

---

## 13. Empty / loading / error states (suggestions to lock down)

These often go unedited; worth a sweep:

- Empty Album: **No moments yet.** / Tag a photo on your next run to start your album.
- Empty Honors: **Your honors live here.** / Each badge celebrates a marker in your journey. Show up to start filling them in.
- Empty Stats: **Nothing to chart yet.** / Log a run and the shape of your year starts to draw itself.
- Network error (generic): **Couldn't reach ZenRun.** / Check your connection and try again.
- Save error (run / walk): **Couldn't save that one.** / Tap retry or come back to it later.

> These aren't from source verbatim — they're proposed defaults to align
> with brand voice. Edit and we'll thread them through the screens that
> currently show terser system text.

---

## 14. Quick checklist for editing

- Stay in the **path / album** vocabulary.
- Stay in **second person**.
- ≤ 12 words per sentence, where possible.
- No "crush it", no "beast mode", no leaderboard language.
- After edits we will fold approved sections back into:
  - Onboarding → `frontend/screens/OnboardingScreen.tsx`
  - Run flow → `frontend/screens/RunScreen.tsx`, `RunSummaryScreen.tsx`
  - Walk flow → `frontend/screens/WalkSummaryScreen.tsx`
  - Home → `frontend/screens/HomeScreen.tsx`
  - Modal → `frontend/components/AchievementDetailModal.tsx`
  - Drawer → `frontend/components/AppDrawer.tsx`
  - Daily wisdom + motivation + seasonal → `backend/main.py`, `backend/crud.py`
  - Achievements library → `backend/achievements.py`
