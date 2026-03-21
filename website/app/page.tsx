export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-warm-bg via-white to-warm-surface" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-16 md:pt-36 md:pb-24">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
            <div className="flex-1 max-w-xl">
              <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                Your running journal<br />
                <span className="text-coral">Finding Joy.</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-10 max-w-lg">
                Running apps turned running into a spreadsheet. ZenRun is a
                running journal &mdash; Log your run in 2 seconds, build your rhythm
                and find joy in running.
              </p>
              <div id="download" className="flex flex-wrap gap-4">
                <a
                  href="#"
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
                  className="inline-flex items-center gap-3 bg-gray-900 text-white px-6 py-3.5 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.4l2.443 1.413a1 1 0 010 1.74l-2.443 1.414L15.18 12l2.518-2.693zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wide opacity-80">Get it on</div>
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
              One might reasonably expect that a tool designed to support runners would
              concern itself with the essential question: did you run today? Instead,
              the modern running application presents the user with pace splits, cadence
              measurements, heart rate zone analysis, VO2 max estimates, power output in
              watts, and vertical oscillation in centimetres &mdash; a cascade of data that,
              however precisely rendered, bears remarkably little relation to whether the
              run was any good.
            </p>
            <p>
              The consequences of this are not trivial. A runner who might otherwise have
              enjoyed a slow Tuesday morning loop finds herself monitoring zone 2 thresholds.
              Another adds an unnecessary mile in poor weather so that his weekly total
              survives public scrutiny. Easy runs &mdash; the quiet, unglamorous foundation
              upon which all aerobic fitness is built &mdash; are routinely run too fast,
              not because the body demands it, but because the leaderboard does.
            </p>
            <p className="text-gray-900 font-semibold">
              What began as instruments of measurement have become instruments of anxiety.
              The run worth having, it turns out, is the one in which you are present &mdash;
              not to the data, but to yourself.
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

      {/* What the science says */}
      <section className="bg-warm-surface py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Consistency is the only metric that matters.
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto mb-12">
            The single most important factor in running progress is not pace,
            cadence, or VO2 max. Research shows that runners who show up regularly &mdash;
            even with imperfect sessions &mdash; build lasting fitness. Perfectionism,
            the mindset that data-heavy apps reinforce, actually hinders progress.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-2xl p-6">
              <div className="text-3xl font-extrabold text-coral mb-2">7 days</div>
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
        </div>
      </section>

      {/* How ZenRun works */}
      <section className="bg-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How ZenRun works
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Everything you need, nothing you don&apos;t.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '⏱️',
                title: 'Log in 2 seconds',
                desc: 'Pick your distance, enter your time, done. You can use your Apple Watch or not. Run however you want, log it when you\'re back.',
              },
              {
                icon: '🌳',
                title: 'Rhythm rewards showing up',
                desc: 'Run at least twice a week to keep your rhythm going. Not pace. Not distance. Just presence. And showing up.',
              },
              {
                icon: '🏆',
                title: '100 milestones for your journey',
                desc: 'Earn achievements across your running life — first 5K, 100th run, a year of consistency, and beyond. Your journey, celebrated.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-warm-bg rounded-2xl p-8 text-center hover:shadow-lg transition-shadow"
              >
                <div className="text-5xl mb-5">{item.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            {[
              {
                icon: '📸',
                title: 'Scenic run photos',
                desc: 'Capture the joy of outdoor runs. Tag photos to distance markers. Build a visual album of your running journey, km by km.',
              },
              {
                icon: '👥',
                title: 'Circles, not leaderboards',
                desc: 'Share your running journey with up to 10 close friends. Accountability and maybe some joyful competition.',
              },
              {
                icon: '🎯',
                title: 'Goals that keep you honest',
                desc: 'Set yearly and monthly km targets. A simple progress bar shows where you are and where you should be.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-warm-bg rounded-2xl p-8 text-center hover:shadow-lg transition-shadow"
              >
                <div className="text-5xl mb-5">{item.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            {[
              {
                icon: '📊',
                title: 'Just enough data',
                desc: 'Distance. Time. Rhythm. Goals. Personal records. That\'s the full list. No cadence, no heart rate zones, no VO2 max.',
              },
              {
                icon: '🏃‍♂️',
                title: 'Outdoor & treadmill',
                desc: 'Log runs by type. Filter your stats and personal records by outdoor or treadmill to see what matters to you.',
              },
              {
                icon: '✏️',
                title: 'Edit anytime',
                desc: 'Made a typo? Added the wrong distance? Edit or delete any run, anytime. Your log, your rules.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-warm-bg rounded-2xl p-8 text-center hover:shadow-lg transition-shadow"
              >
                <div className="text-5xl mb-5">{item.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
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
              'Run 2–5 times a week and want to keep doing that for years',
              'Value the running mindfulness as much as the physical fitness',
              'Have used tracking apps but have not stayed consistent',
              'Care more about running than chasing a PR every week',
              'Want to share your journey with close friends',
              'Believe that the best run is the one you actually did',
            ].map((item) => (
              <li key={item} className="flex items-start gap-4">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-coral shrink-0" />
                <span className="text-lg text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-gray-500 leading-relaxed">
            We&apos;re not for the runner optimising their 5K time by 3 seconds.
            We&apos;re for the runner who just wants to run.
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

      {/* CTA */}
      <section className="bg-gray-900 py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Start running. Stop tracking.
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-lg mx-auto">
            Join runners who focus on showing up, not showing off.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#"
              className="inline-flex items-center gap-3 bg-coral hover:bg-coral-dark text-white px-8 py-4 rounded-xl transition-colors font-semibold"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download for iOS
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl transition-colors font-semibold"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.4l2.443 1.413a1 1 0 010 1.74l-2.443 1.414L15.18 12l2.518-2.693zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
              </svg>
              Download for Android
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
