export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-warm-bg via-white to-warm-surface" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-36 md:pb-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-coral/10 text-coral text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              <span>🏃</span> Now on iOS
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              Log runs.<br />
              Build streaks.<br />
              <span className="text-coral">Stay consistent.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-10 max-w-lg">
              ZenRun is a simple running app that helps you build a lasting
              running habit. No GPS tracking, no overload — just log your run
              in 10 seconds and get back to your day.
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
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Running should be simple
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              No GPS. No heart rate. No data overload. Just you, your run, and a
              10-second log when you&apos;re done.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '⏱️',
                title: '10-Second Logging',
                desc: 'Pick your distance, enter your time, done. The fastest run logger you\'ll ever use.',
              },
              {
                icon: '🔥',
                title: 'Weekly Streaks',
                desc: 'Run at least once a week to keep your streak alive. Simple rules, powerful motivation.',
              },
              {
                icon: '🏆',
                title: '50 Achievements',
                desc: 'Earn badges for milestones, distances, consistency, and more. Always something to chase.',
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

      {/* Features Grid */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything you need, nothing you don&apos;t
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: '📊',
                title: 'Personal Records',
                desc: 'Track your best times across 3K, 5K, 10K, 15K, 18K, and 21K distances.',
                color: 'bg-purple-50 text-purple-600',
              },
              {
                icon: '👥',
                title: 'Circles',
                desc: 'Create groups with friends. Share invite codes and compete on monthly leaderboards.',
                color: 'bg-teal-50 text-teal-600',
              },
              {
                icon: '📅',
                title: 'Month in Review',
                desc: 'Get a comprehensive summary of your running month with breakdowns by distance.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: '🎯',
                title: 'Goals & Progress',
                desc: 'Set yearly and monthly km goals. Track your progress with clear visual indicators.',
                color: 'bg-coral/10 text-coral',
              },
              {
                icon: '👟',
                title: 'Step Tracking',
                desc: 'Log high step days and track 15K+, 20K+, and 25K+ milestones.',
                color: 'bg-green-50 text-green-600',
              },
              {
                icon: '⚖️',
                title: 'Weight Tracking',
                desc: 'Optional weight logging with progress charts toward your goal.',
                color: 'bg-blue-50 text-blue-600',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-8 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${item.color} text-2xl mb-4`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Start your running streak today
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-lg mx-auto">
            Join runners who focus on showing up, not showing off.
            Download ZenRun and log your first run in under a minute.
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
