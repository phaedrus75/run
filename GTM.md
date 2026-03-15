# ZenRun Go-To-Market Plan

**Target launch**: ~March 7, 2026
**Platform**: iOS App Store (Android later)
**Budget**: $0
**Website**: zenrun.co (live)
**Backend**: Railway (auto-deploys on git push)
**App build**: Expo EAS, bundle ID `com.phaedrus75.runzen`, current version 1.3.0

---

## Positioning: Early Access, Built in the Open

ZenRun is not a finished product being launched — it's a running journal being **built alongside its first users**. The app is being actively developed, and early users are not just customers; they're co-builders shaping what ZenRun becomes.

This is the core message for launch and all outreach:

> **ZenRun is in early access. We're building it in the open, and we want you to help shape it.**

Every piece of copy — App Store description, Reddit posts, Product Hunt, emails — should make this clear. Early users should feel:

1. **Ownership** — "My feedback actually changes the app."
2. **Community** — "I'm part of a small group of early runners, not downloading another app from a faceless company."
3. **Honesty** — "This is a real person building something real, and they're not pretending it's perfect."

### How to weave this into every channel:

- **App Store subtitle**: "Less tracking. More running." (stays — the philosophy doesn't change)
- **App Store description**: Add an "EARLY ACCESS" section (see updated description below)
- **Reddit posts**: Lead with "I'm building this and I need runners to tell me what's wrong"
- **Product Hunt**: Frame as "early access, help me build this"
- **Circles**: Position as the way early users stay connected and give feedback
- **Web profiles**: Encourage early users to make profiles public — their journeys become social proof
- **Support page / in-app**: Make it dead simple to share feedback (email, circle discussions)

### What early users get:

- They shape the roadmap — features they ask for get built
- They're the founding members of the first circles
- Their feedback is acknowledged and acted on visibly (changelog, in-app notes)
- When ZenRun grows, they were there from the start

---

## Week 1: Pre-Launch

### App Store Connect Setup

- [ ] Create the app record in App Store Connect (bundle ID: `com.phaedrus75.runzen`)
- [ ] Set the app name to **ZenRun**
- [ ] Set the subtitle to **Less tracking. More running.**
- [ ] Set the primary category to **Health & Fitness**
- [ ] Set the secondary category to **Lifestyle**
- [ ] Set the price to **Free**
- [ ] Set the age rating to **4+** (no objectionable content)
- [ ] Set the copyright to **2026 ZenRun**
- [ ] Set the support URL to **https://zenrun.co/support**
- [ ] Set the privacy policy URL to **https://zenrun.co/privacy**
- [ ] Set `ITSAppUsesNonExemptEncryption` to **No** (already in app.json)

### App Store Description

Use this as the full description:

```
Running apps turned running into a spreadsheet. ZenRun is the opposite.

Log your run in 2 seconds. Find your rhythm. Get back to your life.

ZenRun is built on one insight backed by research: the single most important factor in running progress is consistency. Not pace. Not cadence. Not VO2 max. Just showing up, week after week.

HOW IT WORKS

- Log a run in seconds. Pick your distance, enter your time, done. No GPS needed.
- Weekly rhythm rewards showing up. Run twice a week to keep your rhythm going.
- 100 milestones celebrate your journey. Your first 5K, your 100th run, a year of consistency.
- Circles let you share your journey with close friends. Accountability without competition.
- Scenic run photos. Tag photos to distance markers and build a visual album of your runs.
- Just enough data. Distance, time, rhythm, goals, personal records. That's the full list.

WHAT ZENRUN DOES NOT DO

- No GPS tracking. Run without your phone.
- No live pace alerts buzzing your wrist.
- No leaderboards against strangers.
- No social feeds designed to make you compare.
- No heart rate zones, cadence, VO2 max, or vertical oscillation.

WHO IT'S FOR

You run 2-5 times a week and want to keep doing that for years. You value the mental clarity of running as much as the fitness. You've felt the anxiety of tracking apps and want something calmer. You believe the best run is the one you actually did.

BUILT BY A RUNNER, NOT A FITNESS COMPANY

ZenRun was built by a runner who has started and stopped more times than they can count. Hardly ran in 2025. Set a goal of 1,000km in 2026. Built the app alongside the journey -- 160km and counting. Through the motivated weeks and the weeks they nearly quit again. No venture capital. No subscriptions. No ads. Just a runner building the tool they wished existed.

Inspired by Born to Run, Murakami's What I Talk About When I Talk About Running, and the growing movement of runners leaving their GPS watches at home.

EARLY ACCESS — HELP BUILD ZENRUN

ZenRun is being actively built and improved. You're not downloading a finished product -- you're joining a small group of early runners whose feedback directly shapes what ZenRun becomes. Features you ask for get built. Bugs you find get fixed. Your voice matters here.

Share your thoughts at support@zenrun.co or in your circle. Every piece of feedback makes ZenRun better for the next runner.

Less tracking. More running.
```

### App Store Keywords

The keyword field allows up to 100 characters, comma-separated, no spaces after commas. Use:

```
running,journal,streak,habit,simple,tracker,mindful,run,log,fitness,zen,jog,training
```

Rationale: Targets searches for "running journal", "simple run tracker", "running habit", "mindful running", "run log" while avoiding high-competition generic terms like "running app" where Strava/Nike dominate.

### Privacy Nutrition Labels

In App Store Connect, configure the privacy labels:

**Data collected:**
| Data Type | Collected | Linked to Identity | Used for Tracking |
|-----------|-----------|-------------------|-------------------|
| Email Address | Yes | Yes | No |
| Name | Yes | Yes | No |
| Fitness (runs, steps, weight) | Yes | Yes | No |
| Photos (scenic run photos) | Yes | Yes | No |

**Data not collected:**
- Location, Contacts, Browsing History, Search History, Identifiers, Diagnostics, Purchases

### Screenshots

Prepare 5-6 screenshots for iPhone 6.7" (required) and 6.5" displays. Each screenshot should be a clean app screen with a short headline above it.

| Screenshot | Screen to Show | Headline |
|------------|---------------|----------|
| 1 | Home screen with rhythm and journey card | **Less tracking. More running.** |
| 2 | Run screen (distance selector + timer) | **Log a run in 2 seconds.** |
| 3 | Milestones grid (badges) | **100 milestones for your journey.** |
| 4 | Circle space (feed tab with activity) | **Run alongside friends, not against them.** |
| 5 | Stats screen (monthly view with goal progress) | **Just enough data.** |
| 6 | Scenic run photo being tagged to a distance marker | **Build a trail album, km by km.** |

Design tips:
- Use the warm background color (`#FFF9F5`) as the screenshot background
- Use the muted coral (`#E8756F`) for headline text
- Keep the phone frame minimal or skip it entirely -- Apple prefers clean screenshots
- Show real-looking data, not empty states

### TestFlight Beta

- [ ] Bump version in `app.json` from `1.3.0` to `1.4.0`
- [ ] Run `eas build --profile production --platform ios` from the `frontend/` directory
- [ ] Upload to TestFlight via `eas submit --platform ios`
- [ ] Invite 5-10 beta testers (friends, running partners, anyone from your circles)
- [ ] Give testers 3-5 days to find issues
- [ ] Fix any critical bugs found during beta
- [ ] Build the final release candidate

### Website Updates (for launch day)

The following changes need to happen once the App Store link is live:

- [ ] Replace all `href="#"` on App Store buttons in `website/app/page.tsx` with the real App Store URL
- [ ] Hide or remove the Google Play button (3 instances in `page.tsx`) until Android launches
- [ ] Update the "How ZenRun works" section: change "50 badges" to "100 milestones"
- [ ] Verify "Rhythm rewards showing up" with plant emoji matches the app
- [ ] Deploy: `vercel --prod --yes` from the project root

---

## Launch Day Checklist

- [ ] Submit the final build to App Store Review (if not already submitted)
- [ ] Verify the app is live on the App Store (allow 24-48 hours for review)
- [ ] Copy the App Store URL
- [ ] Update zenrun.co with the live link and deploy
- [ ] Post to all distribution channels (see below)
- [ ] Tell your beta testers the app is live and ask them to leave an honest review

---

## Organic Distribution Strategy

### Day 1: Reddit (highest ROI)

Reddit is the best free channel for indie apps because the audience self-selects and genuine maker posts get upvoted.

**Where to post:**

| Subreddit | Subscribers | Post Angle |
|-----------|------------|------------|
| r/running | 3M+ | "I built a running app with no GPS, no leaderboards, no pace alerts" |
| r/C25K | 500K+ | "Made a simple app for building a running habit -- just log and find your rhythm" |
| r/sideproject | 100K+ | "I built ZenRun -- the anti-Strava running app" |
| r/indiehackers | 50K+ | Technical maker story: React Native + FastAPI + Railway |
| r/apple | 5M+ | "New iOS app: a running journal that gets out of your way" |
| r/iosapps | 30K+ | Direct app showcase |

**Post template for r/running:**

```
Title: I've started and stopped running more times than I can count. This year I'm trying something different.

I hardly ran at all last year. Before that, the same pattern: a few good months,
then nothing. Start, stop, start, stop. This January I set a goal -- 1,000km in
2026. Not for a race. Just to see if the habit could finally stick.

2.5 months in, I've done 160km. Some weeks were great. Some weeks I barely
dragged myself out the door. I also built a running app during the same period --
partly to keep myself accountable, partly because every existing app made running
feel like homework.

Strava made me anxious about pace. Garmin made me feel bad about heart rate zones.
I just wanted to log my run and move on. So I built ZenRun.

What it does:
- Log a run in 2 seconds. Pick distance, enter time, done. No GPS needed.
- Weekly rhythm. Run twice a week, rhythm continues. That's it.
- 100 milestone badges for your personal journey. No rankings.
- Circles of up to 10 friends. Share your runs without competing.
- No GPS. No live tracking. Run without your phone if you want.

The biggest lesson from my own journey: consistency is everything. The weeks I
showed up -- even for short, slow runs -- I felt better than the weeks I skipped
while "resting." The science backs this up. That's why the app only tracks one
thing: did you show up?

It's free, no ads, on iOS. Still early -- I'm building it in the open and want
runners to help shape what it becomes. If something's missing or broken, I want
to hear about it. Every feature so far came from my own running, and I'd love
it to come from yours too.

If you give it a try, I'm genuinely reading every email at support@zenrun.co.

[App Store link]
```

**Rules:**
- Post as yourself, not as a brand account
- Respond to every comment within the first 2 hours
- Do not spam multiple subreddits on the same day -- space them 1-2 days apart
- If a post gets removed, message the mods politely; most allow genuine maker posts

### Day 2-3: Product Hunt

**Timing**: Launch on a Tuesday or Wednesday at 12:01 AM PST (lowest competition, highest visibility-to-effort ratio).

**Listing details:**

- **Tagline**: The running app that gets out of your way
- **Description**: ZenRun replaces data-heavy running apps with a 2-second run logger, a weekly rhythm, and milestone badges. No GPS. No leaderboards. No pace anxiety. Just run.
- **Topics**: Health & Fitness, Mobile Apps, Productivity
- **Thumbnail**: App icon on the warm background

**First comment (post as maker):**

```
Hey Product Hunt! I've started and stopped running more times than I can count.
Hardly ran at all last year. This January I set a goal: 1,000km in 2026. I
built ZenRun alongside my own journey. 160km and 2.5 months later, both the
habit and the app are still going.

The insight I kept coming back to: consistency is the only metric that matters.
Not pace, not VO2 max, not cadence. Just showing up, week after week.

Every existing running app made that harder, not easier. So ZenRun only tracks
what matters:
- Did you run this week? (rhythm)
- How far have you come? (milestones)
- Are your friends running too? (circles)

Everything else is noise. The app is free, no ads, no subscriptions.

This is early access -- I'm building ZenRun in the open and I want runners
to help shape it. Features you ask for get built. Bugs you find get fixed.
If you've ever felt overwhelmed by a running app, I'd love your feedback.
Every email to support@zenrun.co gets read by me personally.
```

### Day 3-5: Social Media

**Twitter/X thread:**

Post a 5-tweet thread:

1. "I've started and stopped running more times than I can count. This January I set a goal: 1,000km. I also built an app. Here's the story:"
2. I hardly ran last year. Every time I tried to come back, running apps made it worse. Strava showed me how slow I was. Garmin showed me how unfit I'd become. I just wanted to show up without judgment.
3. The research is clear: consistency > intensity. Runners who show up 2x/week for years beat runners who crush it for 3 months and burn out. Every time.
4. So I built @ZenRunApp. Log a run in 2 seconds. Find your rhythm. Earn milestones. Share with friends. No GPS, no leaderboards, no noise. Built while learning to run, not in a product lab.
5. 160km in, both the habit and the app are still going. It's in early access on iOS -- free, no ads. I'm building it in the open and want runners to help shape it. Try it and tell me what's missing. Link in bio.

**Instagram:**

- Post 1: Screenshot of the app with the tagline "Less tracking. More running."
- Post 2: Murakami quote card: "The only opponent you have to beat is yourself, the way you used to be."
- Post 3: Screenshot of the milestone badges grid
- Reels idea: 15-second video of someone running, phone in pocket, then logging the run after in 2 seconds

### Day 5-7: Running Communities

| Community | How to Approach |
|-----------|----------------|
| LetsRun forums | Share in the "Gear & Technology" subforum as a genuine runner |
| Fetcheveryone | UK running community; post in the "Apps" discussion |
| Running Facebook Groups | "Casual Runners", "Women Who Run", "Run Club" -- share as a member, not a marketer |
| Running Discord servers | Find servers via Disboard, share in #app-recommendations channels |

### Ongoing: Blog / Press Outreach

Send a short, personal email to indie app reviewers and running bloggers. Not a press release -- a genuine note.

**Email template:**

```
Subject: I started running in January and built an app along the way

Hi [name],

I've started and stopped running more times than I can count. Hardly ran at
all last year. This January I set a goal -- 1,000km in 2026. 160km and 2.5
months later, I've also built a running app called ZenRun.

It takes the opposite approach to Strava/Nike Run Club. No GPS tracking, no
live pace alerts, no social leaderboards. You log your run in 2 seconds after
you're done, keep a weekly rhythm, and earn milestone badges.

I built it because every time I tried to come back to running, existing apps
made it harder. They showed me how slow I was, how unfit I'd become. I just
wanted something that rewarded showing up. The app evolved alongside my own
running journey, through the good weeks and the weeks I nearly quit again.

It's free, no ads, no subscription. It's in early access right now -- I'm
building it in the open and early users' feedback directly shapes what gets
built next. Would love for you to try it and tell me what's missing.

[Your name]
[App Store link]
[zenrun.co]
```

**Who to email:**

| Target | Why |
|--------|-----|
| MacStories (Federico Viticci) | Covers indie iOS apps, appreciates thoughtful design |
| iMore app reviews | Regular "app of the week" coverage |
| The Sweet Setup | Curates best iOS apps by category |
| Running bloggers (search "best running apps 2026") | Target blogs that rank for this keyword |
| YouTube running channels (under 50K subs) | Smaller creators are more likely to respond |

---

## App Store Optimization (ASO)

### Keyword Strategy

Apple allows a 100-character keyword field. The app name and subtitle are also indexed.

**Already indexed** (from name + subtitle):
- ZenRun, Less, tracking, More, running

**Keyword field** (100 chars):
```
running,journal,streak,habit,simple,tracker,mindful,run,log,fitness,zen,jog,training
```
(84 characters -- room for 1-2 more short terms if needed)

**Search phrases this covers:**
- "running journal" / "run journal"
- "running habit tracker"
- "simple running app" / "simple run tracker"
- "mindful running"
- "running streak"
- "running log"
- "fitness tracker simple"
- "zen running"
- "jog tracker"

### Localization (post-launch)

After the initial launch, localize the App Store listing (not the app itself) into:
- Spanish (large running community)
- German (strong fitness app market)
- Japanese (Murakami connection is a natural hook)
- Portuguese (Brazil has a massive running culture)

App Store listing localization is free and can be done in App Store Connect without code changes.

---

## Launch Metrics

### What to Track

| Metric | Where to Find It | Why It Matters |
|--------|-----------------|----------------|
| Downloads | App Store Connect > Sales and Trends | Raw acquisition |
| Day 1 retention | App Store Connect > App Analytics > Retention | Do people come back? |
| Day 7 retention | Same as above | Do people form the habit? |
| Search impressions | App Store Connect > App Analytics > Sources | Is ASO working? |
| Search conversion rate | Same as above | Are the screenshots/description compelling? |
| Rhythm activation | Backend database query (users with rhythm >= 2) | Core engagement metric |
| Circles created | Backend database query | Social feature adoption |

### Realistic Targets ($0 Budget)

| Timeframe | Downloads | Rationale |
|-----------|-----------|-----------|
| Day 1 | 20-50 | Friends, beta testers, and first Reddit post |
| Week 1 | 100-300 | Reddit + Product Hunt + social media |
| Month 1 | 500-1,500 | Organic search starts contributing, word of mouth |
| Month 3 | 2,000-5,000 | If retention is strong and reviews accumulate |

These are conservative for a $0 launch. A single viral Reddit post can blow past these numbers.

### Key Retention Benchmarks

For a free health/fitness app:
- Day 1 retention: 25-35% is good
- Day 7 retention: 12-18% is good
- Day 30 retention: 6-10% is good

ZenRun's rhythm mechanic should push these higher than average because the app gives users a reason to return each week.

---

## Post-Launch (Week 2+)

### Reviews

- [ ] Respond to every App Store review, positive or negative, within 48 hours
- [ ] For bug reports in reviews, fix fast and reply with "Fixed in [version]"
- [ ] Ask happy beta testers to leave honest reviews in the first week (reviews heavily influence early rankings)
- [ ] Never ask for reviews inside the app more than once per 30 days (Apple policy)

### Iterate on ASO

- [ ] After 2 weeks, check App Store Connect > App Analytics > Sources > Search
- [ ] Identify which keywords drive impressions vs. which drive downloads
- [ ] Swap underperforming keywords for new ones
- [ ] Test a new subtitle if conversion rate is below 5%

### Apple Editorial

Apple's editorial team features indie apps with clear, opinionated design philosophies. ZenRun's anti-metrics stance makes it a natural candidate.

- [ ] Submit the app story via the [Apple Developer self-submission form](https://developer.apple.com/contact/app-store/promote/)
- [ ] Focus the pitch on: why ZenRun exists (the anti-Strava philosophy), the design choices (what was deliberately left out), and the cultural inspiration (Born to Run, Murakami)
- [ ] Best time to submit: 1-2 weeks after launch, once you have some reviews and download data

### Android Timeline

- [ ] Plan Android launch for 4-6 weeks after iOS, once iOS is stable
- [ ] Use the same EAS pipeline: `eas build --profile production --platform android`
- [ ] Submit via `eas submit --platform android`
- [ ] Unhide the Google Play button on zenrun.co

### Content Calendar (Weeks 2-4)

| Day | Channel | Content |
|-----|---------|---------|
| Week 2, Mon | Twitter/X | Share a user milestone: "Someone just hit a 10-week rhythm on ZenRun" |
| Week 2, Wed | Instagram | Murakami quote card |
| Week 2, Fri | Reddit | Post in r/C25K if not done in week 1 |
| Week 3, Mon | Twitter/X | Thread: "5 things I deliberately left out of my running app" |
| Week 3, Wed | Instagram | App screenshot: scenic run photo feature |
| Week 3, Sat | Running Discord | Share in a new server |
| Week 4, Mon | Blog post on Medium/Substack | "Why I built a running app with no GPS" |
| Week 4, Thu | Twitter/X | Share download milestone or interesting stat |

---

## Quick Reference: Build and Deploy Commands

```bash
# TestFlight build
cd frontend
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios

# Deploy website
cd /Users/munshi/Downloads/Run
vercel --prod --yes

# Deploy backend (auto on push, or manual)
cd /Users/munshi/Downloads/Run
railway up
```

---

## Summary

The ZenRun launch strategy relies on four things:

1. **A clear, contrarian position.** "Less tracking. More running." is a message that resonates emotionally with runners who feel overwhelmed by Strava/Garmin. Lead with the philosophy, not the features.

2. **Built in the open.** ZenRun is in early access. Every touchpoint should make it clear: this is a product being built alongside its first users, not a polished release from a faceless company. Early users shape the roadmap. Their feedback is heard and acted on. This turns users into advocates.

3. **Authentic distribution.** Reddit maker posts, Product Hunt, and personal emails to bloggers. No paid ads. The $0 constraint is actually an advantage -- it forces genuine, human outreach that converts better than ads for niche apps.

4. **Retention over acquisition.** The rhythm mechanic and circles create natural return loops. A small, loyal user base that keeps coming back is worth more than thousands of downloads with 5% retention. Optimize for week-over-week rhythm activation, not day-1 downloads.
