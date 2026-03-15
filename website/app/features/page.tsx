import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features — ZenRun',
  description: 'Everything ZenRun offers — and everything it deliberately leaves out.',
};

const FEATURES = [
  {
    category: 'Run Logging',
    philosophy: 'Run first. Log later. Get on with your day.',
    items: [
      {
        icon: '⏱️',
        title: '2-Second Logging',
        desc: 'Pick your distance, enter your time, done. No GPS needed. No phone on your run. Log it when you\'re back.',
      },
      {
        icon: '🏃',
        title: '9 Distances',
        desc: '1K through 21K — including 1K, 2K, 3K, 5K, 8K, 10K, 15K, 18K, and 21K. Outdoor or treadmill. Pick the one that fits your day.',
      },
      {
        icon: '📝',
        title: 'Backdate & Edit',
        desc: 'Forgot to log? Add runs from previous days. Made a mistake? Edit distance, time, or category anytime.',
      },
    ],
  },
  {
    category: 'Rhythm & Consistency',
    philosophy: 'We reward showing up, not showing off.',
    items: [
      {
        icon: '🌳',
        title: 'Weekly Rhythm',
        desc: 'Run at least twice a week to keep your rhythm going. Not pace. Not distance. Just presence. Miss a week? It\'s just a pause — you come back.',
      },
      {
        icon: '🎯',
        title: 'Monthly & Yearly Goals',
        desc: 'Set your own km targets. A simple progress bar shows where you are and where you should be. No judgement.',
      },
      {
        icon: '🎉',
        title: 'Quiet Celebrations',
        desc: 'A small moment of confetti when you maintain your rhythm or hit a goal. No push notifications. No pressure.',
      },
    ],
  },
  {
    category: 'Achievements',
    philosophy: 'Your milestones. Not compared to anyone else\'s.',
    items: [
      {
        icon: '🏆',
        title: '100 Milestones',
        desc: 'Across 8 categories: milestones, distance, first completions, rhythm, goals, and more. Every badge celebrates your journey.',
      },
      {
        icon: '⚡',
        title: 'Personal Records',
        desc: 'Your fastest time at each distance, tracked automatically. Filter by outdoor or treadmill. Compete with yourself — the way you used to be.',
      },
      {
        icon: '📅',
        title: 'Month in Review',
        desc: 'A calm summary of your month. Run breakdown by distance, step highlights, and a moment to reflect.',
      },
    ],
  },
  {
    category: 'Community',
    philosophy: 'Accountability, not a leaderboard.',
    items: [
      {
        icon: '👥',
        title: 'Circles',
        desc: 'Private groups of up to 10 close friends with a live activity feed. See runs, reactions, and scenic photos. Accountability without competition.',
      },
      {
        icon: '🌐',
        title: 'Web Profiles',
        desc: 'Share your running journey on the web. Choose your privacy — private, visible to circles, or fully public. Your profile, your rules.',
      },
      {
        icon: '💬',
        title: 'Reactions & Activity Feed',
        desc: 'React to your circle members\' runs and milestones. Celebrate each other\'s journeys with quiet encouragement.',
      },
    ],
  },
  {
    category: 'Scenic Photos',
    philosophy: 'Remember the views, not just the numbers.',
    items: [
      {
        icon: '📸',
        title: 'Tag Photos to Km Markers',
        desc: 'Snap a photo during your outdoor run, then tag it to a km marker. Build a visual record of the places you run through.',
      },
      {
        icon: '🖼️',
        title: 'Scenic Runs Gallery',
        desc: 'Browse all your scenic runs in a beautiful album. Full-screen photos, captions, and a timeline of each run\'s journey.',
      },
      {
        icon: '🗺️',
        title: 'Your Running Journey',
        desc: 'See every photo placed along your run\'s distance. A visual timeline from start to finish, for every run you photograph.',
      },
    ],
  },
  {
    category: 'Just Enough Data',
    philosophy: 'Distance. Time. Rhythm. Goals. That\'s the full list.',
    items: [
      {
        icon: '👟',
        title: 'Step Tracking',
        desc: 'Log high step days. See your 15K+, 20K+, and 25K+ milestones. Simple and optional.',
      },
      {
        icon: '⚖️',
        title: 'Weight Tracking',
        desc: 'Optional weight logging with a progress chart. There when you want it, invisible when you don\'t.',
      },
      {
        icon: '📊',
        title: 'Stats by Category',
        desc: 'Weekly, monthly, and all-time views. Filter by outdoor or treadmill. Distance, runs, pace trend — no noise.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
          Everything you need.
          <br />
          <span className="text-coral">Nothing you don&apos;t.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          We spent as much time deciding what to leave out as what to put in.
          Here&apos;s what made the cut.
        </p>
      </div>

      {FEATURES.map((section) => (
        <div key={section.category} className="mb-16 last:mb-0">
          <div className="mb-8 pb-3 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">
              {section.category}
            </h2>
            <p className="text-sm text-gray-400 mt-1">{section.philosophy}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {section.items.map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="text-center mt-20 bg-coral/5 rounded-3xl p-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Ready to just run?
        </h2>
        <p className="text-gray-500 mb-8">
          No credit card. No setup. Download and log your first run in under a minute.
        </p>
        <a
          href="/#download"
          className="inline-block bg-coral hover:bg-coral-dark text-white font-semibold px-8 py-3.5 rounded-full transition-colors"
        >
          Download ZenRun
        </a>
      </div>
    </div>
  );
}
