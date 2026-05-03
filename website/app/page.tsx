export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-warm-bg via-white to-warm-surface" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-16 md:pt-36 md:pb-24">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
            <div className="flex-1 max-w-xl">
              <p className="text-xs font-semibold tracking-[0.25em] uppercase text-coral mb-5">
                Show up. <span className="text-teal">Reflect.</span>
              </p>
              <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                Your <span className="text-coral">joyful</span> running journal
              </h1>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-10 max-w-lg">
                Running apps turned running into a spreadsheet. ZenRun is the
                journal you fill in afterwards &mdash; logged in 2 seconds,
                stitched together with your photos, your routes, and the slow
                story of showing up.
              </p>
              <div id="download" className="flex flex-wrap gap-4">
                <a
                  href="https://apps.apple.com/app/zenrun/id6759347621"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-gray-900 text-white px-6 py-3.5 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wide opacity-80">Download on the</div>
                    <div className="text-base font-semibold -mt-0.5">App Store</div>
                  </div>
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-3 bg-gray-900/50 text-white/70 px-6 py-3.5 rounded-xl cursor-default"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.4l2.443 1.413a1 1 0 010 1.74l-2.443 1.414L15.18 12l2.518-2.693zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wide opacity-80">Coming soon on</div>
                    <div className="text-base font-semibold -mt-0.5">Google Play</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="hidden md:flex flex-1 justify-center">
              <div className="relative w-[280px] h-[580px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10" />
                <div className="w-full h-full bg-[#FFF9F5] rounded-[2.3rem] overflow-hidden px-5 pt-14 pb-6">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[15px] font-bold text-gray-900">ZenRun</span>
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  </div>
                  <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Your Rhythm</span>
                      <span className="text-xs font-semibold text-[#4ECDC4]">Longest: 8</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <span className="text-3xl font-extrabold text-gray-900">5</span>
                      <span className="text-sm text-gray-400">weeks</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="h-1.5 flex-1 bg-[#E8756F] rounded-full" />
                      <div className="h-1.5 flex-1 bg-[#E8756F] rounded-full" />
                      <div className="h-1.5 flex-1 bg-gray-200 rounded-full" />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">1 more run this week</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-900">2026 Goal</span>
                      <span className="text-[10px] font-semibold text-[#4ECDC4] bg-[#4ECDC4]/10 px-2 py-0.5 rounded-full">On Track</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1.5">
                      <div className="bg-[#E8756F] h-2.5 rounded-full" style={{width: '38%'}} />
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>380 km done</span>
                      <span>38%</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-900">5K</span>
                        <span className="text-[11px] text-gray-400 ml-2">28:42</span>
                      </div>
                      <span className="text-[11px] text-gray-400">Today</span>
                    </div>
                  </div>
                  <div className="bg-[#E8756F] rounded-xl py-3 text-center mt-1">
                    <span className="text-white text-sm font-semibold">Log a run</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="bg-white py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Running has been hijacked by metrics.
          </h2>
          <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
            <p>
              Open any popular running app and the numbers come at you mid-stride &mdash;
              live pace, zone alarms, cadence prompts, segment leaderboards, the unspoken
              pressure to perform for an audience while your lungs are still warming up.
            </p>
            <p>
              Easy runs get pushed too fast because the pace is being watched. Recovery
              jogs become zone-2 audits. The last 200 metres turn into a sprint to fix
              an average. The run we set out for &mdash; the one that was supposed to feel
              good &mdash; quietly disappears under the dashboard.
            </p>
            <p className="text-gray-900 font-semibold">
              What started as tools to help runners have become tools that own them.
              The run worth having, it turns out, is the one you stayed present in &mdash;
              and the one you can still remember a year later.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            A different philosophy
          </h2>
          <p className="text-lg text-gray-500 mb-14">
            ZenRun is built on ideas from runners and thinkers who understood
            something the fitness industry forgot.
          </p>

          <div className="space-y-12">
            <div className="border-l-2 border-coral pl-6">
              <blockquote className="text-base text-gray-500 italic leading-relaxed mb-2">
                &ldquo;Sometimes, we complicate things with gadgets and gear, when
                what we really need is to trust our bodies and keep things simple.&rdquo;
              </blockquote>
              <p className="text-xs text-gray-400 font-medium mb-3">
                Christopher McDougall, <em>Born to Run</em>
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                The Tarahumara run hundreds of miles in thin sandals, smiling.
                No GPS. No heart rate monitors. They run because running is
                woven into their culture &mdash; a form of community and celebration.
              </p>
            </div>

            <div className="border-l-2 border-teal pl-6">
              <blockquote className="text-base text-gray-500 italic leading-relaxed mb-2">
                &ldquo;The only opponent you have to beat is yourself, the way
                you used to be.&rdquo;
              </blockquote>
              <p className="text-xs text-gray-400 font-medium mb-3">
                Haruki Murakami, <em>What I Talk About When I Talk About Running</em>
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Murakami has run marathons for four decades. He doesn&apos;t run
                to live longer. He runs to live fully. What matters is whether
                you improved over yesterday &mdash; not where you rank on a leaderboard.
              </p>
            </div>

            <div className="border-l-2 border-gray-300 pl-6">
              <blockquote className="text-base text-gray-500 italic leading-relaxed mb-2">
                &ldquo;It is only necessary that he runs and runs and sometimes
                suffers. Then one day he will wake up and discover that somewhere
                along the way he has begun to see order and law and love and Truth.&rdquo;
              </blockquote>
              <p className="text-xs text-gray-400 font-medium mb-3">
                George Sheehan, <em>Running &amp; Being</em>
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Running transforms the runner. Not through data, but through
                the accumulated experience of showing up, day after day.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bringing the joy back */}
      <section className="bg-warm-bg py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-coral mb-4">
            What we believe
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Reflection is what brings the joy back.
          </h2>
          <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
            <p>
              We believe metrics have made running less joyful. The numbers
              were meant to help; instead they pulled attention away from the
              run itself.
            </p>
            <p>
              ZenRun&apos;s bet is the opposite shape. Enjoy the moment while you run.
              Take pictures of what you see. Let the numbers settle quietly into
              the journal afterwards &mdash; pace, heart rate, zones, all of it.
            </p>
            <p className="text-gray-900 font-semibold">
              The photo you took at km 4. The route you traced through the park.
              The pace you settled into, read the next morning like a journal
              entry. A run becomes joyful again when you have somewhere
              meaningful to look back at it.
            </p>
          </div>
        </div>
      </section>

      {/* What the science says */}
      <section className="bg-warm-surface py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Consistency is the only metric that matters.
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto mb-12">
            The single most important factor in running progress isn&apos;t pace
            or any single number. Runners who show up regularly &mdash; even
            with imperfect sessions &mdash; build lasting fitness. Chasing
            perfect data on every run is what slows you down.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-2xl p-6">
              <div className="text-3xl font-extrabold text-coral mb-2">2 weeks</div>
              <p className="text-sm text-gray-500">
                How fast aerobic fitness starts declining without regular runs
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6">
              <div className="text-3xl font-extrabold text-coral mb-2">66 days</div>
              <p className="text-sm text-gray-500">
                Average time for consistent training to become an automatic habit
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6">
              <div className="text-3xl font-extrabold text-coral mb-2">2x/week</div>
              <p className="text-sm text-gray-500">
                The minimum frequency that maintains your aerobic base and rhythm
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-8 max-w-2xl mx-auto">
            Sources: Mujika &amp; Padilla, <em>Detraining: Loss of Training-Induced Physiological and Performance Adaptations</em>, Sports Medicine (2000).
            Lally et al., <em>How are habits formed</em>, European Journal of Social Psychology (2010).
            ACSM Guidelines for Exercise Testing and Prescription.
          </p>
        </div>
      </section>

      {/* A new paradigm */}
      <section className="bg-white py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-gray-400 mb-4">
            A new paradigm
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            <span className="text-coral">Show up.</span>{' '}
            <span className="text-teal">Reflect.</span>
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto mb-5">
            ZenRun brings mindfulness, photos, and reflection into running
            &mdash; three things kept close together as one practice.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            They create a virtuous loop: showing up makes the moments. The
            moments become an album. The album is what pulls you back out
            tomorrow.
          </p>
        </div>
      </section>

      {/* Pillar: Show up */}
      <section className="bg-warm-surface py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mb-14">
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-coral mb-3">
              The path
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Show up.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              The important thing is to put the shoes on and get out the door.
              ZenRun stays out of your way. Logging takes two seconds. The
              watch app, if you use it, is a quiet companion. Show up enough
              times and you stop calling yourself someone who runs sometimes
              &mdash; you become a runner.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '⏱️',
                title: 'Log in 2 seconds',
                desc: 'Pick your distance, enter your time, done. Run however you want, log it when you\'re back.',
              },
              {
                icon: '🌳',
                title: 'Weekly rhythm',
                desc: 'Two runs (or walks) a week keeps your rhythm going. Not pace. Not distance. Just presence.',
              },
              {
                icon: '⌚',
                title: 'Quiet Apple Watch companion',
                desc: 'One tap to start a run or walk. GPS captured in the background. The watch face stays out of your face.',
              },
              {
                icon: '🚶',
                title: 'Walks count too',
                desc: 'Walks are first-class citizens. Same logging, same rhythm, same scenic photos. Show up however you can.',
              },
              {
                icon: '🎯',
                title: 'Goals you can keep',
                desc: 'Yearly and monthly km targets. A simple bar shows where you are and where you should be. No judgement.',
              },
              {
                icon: '🎉',
                title: 'Quiet celebrations',
                desc: 'A small moment of confetti when you maintain your rhythm or hit a goal. No fanfare. Just a nod.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-7 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillar: Reflect */}
      <section className="bg-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mb-14">
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-teal mb-3">
              The album
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Reflect.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              The journal. The photos you took at km 4. The map of where you
              went. The slow, occasional looking-back that turns runs into a
              story. Numbers live here too &mdash; pace, heart rate, zones,
              energy, VO₂ Max &mdash; all kept, all available, all read like
              journal entries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '📸',
                title: 'Scenic photos, km by km',
                desc: 'Snap photos during your run, tagged to distance markers. Build a visual album of the places you ran through.',
              },
              {
                icon: '🗺️',
                title: 'Maps of every route',
                desc: 'Every GPS-tracked run and walk gets a map you can revisit. The line of where you went, kept.',
              },
              {
                icon: '📅',
                title: 'Month in Review',
                desc: 'A Spotify-Wrapped-style carousel at the end of each month. Distance, runs, photos, rhythm, goals &mdash; one swipe-through story.',
              },
              {
                icon: '📊',
                title: 'Quarter in Review',
                desc: 'Every three months, a full-screen recap of the season. Total km, scenic moments, PRs, the shape of how you ran.',
              },
              {
                icon: '❤️',
                title: 'Heart rate, gently',
                desc: 'Average HR, max HR, time-in-zone, active energy, VO₂ Max &mdash; recorded by your watch, served back in the journal. No alarms while you run.',
              },
              {
                icon: '⚡',
                title: 'Personal records',
                desc: 'Your fastest at each distance, tracked automatically. The opponent is yourself, the way you used to be.',
              },
              {
                icon: '🏆',
                title: '100 milestones',
                desc: 'Across distance, first completions, rhythm, and goals. Each badge celebrates a marker in your journey.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-warm-bg rounded-2xl p-7 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two scales of community */}
      <section className="bg-warm-bg py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mb-14 text-center mx-auto">
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-gray-400 mb-3">
              Two scales of community
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Friends close. Neighbours nearby.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Circles for the people you know. The neighbourhood for the city
              you run in. Both opt-in, both about places celebrated and
              people encouraged.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">👥</div>
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-coral bg-coral/10 px-2.5 py-1 rounded-full">
                  Available now
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Circles</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Up to 10 close friends. Runs, scenic photos, reactions. The
                kitchen table of your running life &mdash; accountability with
                warmth.
              </p>
              <ul className="space-y-1.5 text-xs text-gray-500">
                <li>&middot; The real you</li>
                <li>&middot; Full activity feed</li>
                <li>&middot; Reactions and encouragement</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-8 hover:shadow-md transition-shadow border border-teal/30">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🏘️</div>
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-teal bg-teal/10 px-2.5 py-1 rounded-full">
                  Coming soon
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">The neighbourhood</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Pseudonymous ZenRunners in your city. Share an album, save
                someone else&apos;s, run it yourself. Discovery, not ranking.
              </p>
              <ul className="space-y-1.5 text-xs text-gray-500">
                <li>&middot; A handle, not your real name</li>
                <li>&middot; Albums opt-in per run</li>
                <li>&middot; Saves and &quot;I ran this!&quot;</li>
              </ul>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-10 max-w-xl mx-auto">
            We rank places, never people. No leaderboards of users, no public
            photo counts on a profile.
          </p>
        </div>
      </section>

      {/* ZenRunner */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-10">
            You are a ZenRunner if you...
          </h2>
          <ul className="space-y-5">
            {[
              'Run (or walk) 2–5 times a week and want to keep doing that for years',
              'Value the mental clarity of running as much as the physical fitness',
              'Take photos on the trail and want somewhere meaningful to keep them',
              'Care about building a sustainable practice, not chasing a PR every week',
              'Want to share your journey with close friends, not perform for followers',
              'Like to discover new places to run through other runners’ eyes',
              'Believe the best run is the one you actually did',
            ].map((item) => (
              <li key={item} className="flex items-start gap-4">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-coral shrink-0" />
                <span className="text-lg text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-lg text-gray-700 font-semibold leading-relaxed">
            ZenRun is for the runner who shows up, looks back, and goes again.
          </p>
        </div>
      </section>

      {/* Founder Story */}
      <section className="bg-warm-surface py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Built by a runner who keeps starting over.
          </h2>
          <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
            <p>
              I&apos;ve started and stopped running more times than I can count.
              I ran consistently for a summer 3 years ago. Since then it has been
              on and off. Cold rainy London weather and too much at work, I hardly
              ran at all in 2025. Then, at the beginning of this year, I set a
              simple goal: run 1,000km this year. Not for a race. Just to see
              if the habit could finally stick.
            </p>
            <p>
              I built ZenRun during the same period &mdash; alongside the runs,
              through the weeks of motivation and the weeks I nearly quit again.
              Every feature exists because I thought of it while I ran.
            </p>
            <p className="text-gray-900 font-semibold">
              170km in, both the habit and the app are still going. ZenRun is a
              running journal built by a runner who&apos;s still journaling.
            </p>
          </div>
        </div>
      </section>

      {/* Early Access */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="bg-coral/5 border border-coral/15 rounded-2xl p-10 md:p-14">
            <p className="text-sm font-semibold text-coral uppercase tracking-wide mb-3">Early Access</p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              We&apos;re building ZenRun in the open.
            </h2>
            <p className="text-gray-600 leading-relaxed max-w-xl mx-auto mb-6">
              ZenRun is not a finished product &mdash; it&apos;s a running journal being built
              alongside its first users. Every feature is shaped by runners like you. Join early,
              share what&apos;s working, tell us what&apos;s not, and help shape what ZenRun becomes.
            </p>
            <a
              href="https://zenrun.featurebase.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-coral hover:bg-coral-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Share your feedback &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-coral-light mb-4">
            Show up. Reflect.
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Start running. Stop tracking.
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-lg mx-auto">
            Join runners who focus on showing up, not showing off &mdash; and
            on remembering it later.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://apps.apple.com/app/zenrun/id6759347621"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-coral hover:bg-coral-dark text-white px-8 py-4 rounded-xl transition-colors font-semibold"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download for iOS
            </a>
            <span
              className="inline-flex items-center gap-3 bg-white/10 text-white/50 px-8 py-4 rounded-xl font-semibold cursor-default"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.4l2.443 1.413a1 1 0 010 1.74l-2.443 1.414L15.18 12l2.518-2.693zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
              </svg>
              Android — Coming Soon
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
