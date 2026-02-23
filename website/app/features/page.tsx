import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features — ZenRun',
  description: 'Everything ZenRun offers: fast run logging, streaks, achievements, circles, personal records, and more.',
};

const FEATURES = [
  {
    category: 'Run Logging',
    items: [
      {
        icon: '⏱️',
        title: '10-Second Logging',
        desc: 'Select your distance (3K to 21K), enter your time, and save. The entire process takes seconds, not minutes.',
      },
      {
        icon: '🏃',
        title: '6 Distances',
        desc: 'Track runs across 3K, 5K, 10K, 15K, 18K, and 21K (half marathon). Outdoor and treadmill categories.',
      },
      {
        icon: '📝',
        title: 'Add Past Runs',
        desc: 'Forgot to log? Add runs from previous days with the backdate feature.',
      },
    ],
  },
  {
    category: 'Motivation & Streaks',
    items: [
      {
        icon: '🔥',
        title: 'Weekly Streaks',
        desc: 'Keep your streak alive by running at least once per week. See your current and longest streak at a glance.',
      },
      {
        icon: '🎯',
        title: 'Monthly & Yearly Goals',
        desc: 'Set your own km targets per month and per year. Watch your progress bars fill up throughout the season.',
      },
      {
        icon: '🎉',
        title: 'Celebrations',
        desc: 'Confetti and special messages when you maintain streaks, hit monthly goals, or log high step days.',
      },
    ],
  },
  {
    category: 'Achievements & Records',
    items: [
      {
        icon: '🏆',
        title: '50 Achievements',
        desc: '8 categories of badges: milestones, total distance, first completions, specialist, streaks, goals, run categories, and steps.',
      },
      {
        icon: '⚡',
        title: 'Personal Records',
        desc: 'Automatic PR tracking for every distance. See your fastest time, pace, and when you set it.',
      },
      {
        icon: '📅',
        title: 'Month in Review',
        desc: 'Detailed monthly summaries with run breakdowns by distance and high step day analysis.',
      },
    ],
  },
  {
    category: 'Social',
    items: [
      {
        icon: '👥',
        title: 'Circles',
        desc: 'Create private groups of up to 10 runners. Share an invite code and compete on monthly leaderboards.',
      },
      {
        icon: '🏷️',
        title: 'Unique Handles',
        desc: 'Claim your @handle and represent yourself in circle leaderboards.',
      },
      {
        icon: '🥇',
        title: 'Leaderboards',
        desc: 'See who ran the most km this month in your circle. Rankings update in real-time.',
      },
    ],
  },
  {
    category: 'Health & Data',
    items: [
      {
        icon: '👟',
        title: 'Step Tracking',
        desc: 'Log high step days and track 15K+, 20K+, and 25K+ milestones over time.',
      },
      {
        icon: '⚖️',
        title: 'Weight Tracking',
        desc: 'Optional weight logging with visual progress charts toward your goal weight.',
      },
      {
        icon: '📊',
        title: 'Stats Dashboard',
        desc: 'All-time, monthly, and weekly stats. Distance breakdowns, pace trends, and run history.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">Features</h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Everything you need to build a consistent running habit.
          Nothing you don&apos;t.
        </p>
      </div>

      {FEATURES.map((section) => (
        <div key={section.category} className="mb-16 last:mb-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 pb-3 border-b border-gray-200">
            {section.category}
          </h2>
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
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to start running?</h2>
        <p className="text-gray-500 mb-8">Download ZenRun and log your first run today.</p>
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
