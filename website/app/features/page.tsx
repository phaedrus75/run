import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features — ZenRun',
  description:
    'Everything ZenRun offers, organised around the two halves of the practice: the path you take, and the album you enjoy afterwards.',
};

type Feature = {
  icon: string;
  title: string;
  desc: string;
};

type Category = {
  category: string;
  philosophy: string;
  items: Feature[];
};

type Pillar = {
  id: 'show-up' | 'reflect';
  eyebrow: string;
  title: string;
  accent: 'coral' | 'teal';
  intro: string;
  categories: Category[];
};

const PILLARS: Pillar[] = [
  {
    id: 'show-up',
    eyebrow: 'The path',
    title: 'Show up.',
    accent: 'coral',
    intro:
      'The act. The rhythm. The shoes-on, out-the-door, log-it-when-you\'re-back side of running. ZenRun stays quiet so you can stay present — your watch, your phone, and your breath, all working together to make the run easy to start.',
    categories: [
      {
        category: 'Run Logging',
        philosophy: 'Run first. Log later. Get on with your day.',
        items: [
          {
            icon: '⏱️',
            title: '2-Second Logging',
            desc: 'Pick your distance, enter your time, done. Use your Apple Watch or not. Run however you want, log it when you\'re back.',
          },
          {
            icon: '🏃',
            title: '9 Distances',
            desc: '1K through 21K — including 1K, 2K, 3K, 5K, 8K, 10K, 15K, 18K, and 21K. Outdoor or treadmill. Pick the one that fits your day.',
          },
          {
            icon: '📝',
            title: 'Backdate & Edit',
            desc: 'Forgot to log? Add runs from previous days. Made a mistake? Edit distance, time, or category anytime. Your log, your rules.',
          },
        ],
      },
      {
        category: 'Apple Watch Companion',
        philosophy: 'A quiet wrist. GPS captured in the background.',
        items: [
          {
            icon: '⌚',
            title: 'One-Tap Start',
            desc: 'Open the watch app, pick walk or run, tap once. ZenRun records the route, syncs to your phone when you\'re back, and gets out of the way.',
          },
          {
            icon: '🛰️',
            title: 'Background GPS',
            desc: 'Your route is traced and saved without you having to look at your wrist. The line of where you went is yours forever.',
          },
          {
            icon: '🔋',
            title: 'A quiet companion',
            desc: 'Distance, time, heart rate captured calmly on your wrist. The data lands in the journal afterwards, ready when you are.',
          },
        ],
      },
      {
        category: 'Walks',
        philosophy: 'Walks are first-class. Show up however you can.',
        items: [
          {
            icon: '🚶',
            title: 'Walks as Real Activities',
            desc: 'Same logging flow. Same scenic photos. Same maps and recaps. Walks count toward your rhythm, your goals, and your story.',
          },
          {
            icon: '☔',
            title: 'On the Bad-Weather Days',
            desc: 'When a run isn\'t happening, a walk still is. ZenRun protects your rhythm by treating both with equal respect.',
          },
        ],
      },
      {
        category: 'Rhythm & Goals',
        philosophy: 'We reward showing up, not showing off.',
        items: [
          {
            icon: '🌳',
            title: 'Weekly Rhythm',
            desc: 'Run or walk at least twice a week to keep your rhythm going. Not pace. Not distance. Just presence. Miss a week? It\'s a pause — you come back.',
          },
          {
            icon: '🎯',
            title: 'Monthly & Yearly Goals',
            desc: 'Set your own km targets. A simple progress bar shows where you are and where you should be. No judgement.',
          },
          {
            icon: '🎉',
            title: 'Quiet Celebrations',
            desc: 'A small moment of confetti when you maintain your rhythm or hit a goal. No fanfare. Just a nod.',
          },
        ],
      },
    ],
  },
  {
    id: 'reflect',
    eyebrow: 'The album',
    title: 'Reflect.',
    accent: 'teal',
    intro:
      'The journal. The photos you took at km 4. The map of where you went. The slow, occasional looking-back that turns runs into a story. Numbers live here too — pace, heart rate, zones, energy, VO₂ Max — all kept, all available, all read like journal entries.',
    categories: [
      {
        category: 'Scenic Photos',
        philosophy: 'Remember the views, not just the numbers.',
        items: [
          {
            icon: '📸',
            title: 'Tag Photos to Km Markers',
            desc: 'Snap a photo during your outdoor run, tag it to a km marker. Build a visual record of the places you ran through.',
          },
          {
            icon: '🖼️',
            title: 'Scenic Runs Gallery',
            desc: 'Browse all your scenic runs in one beautiful album. Full-screen photos, captions, and a timeline of each run\'s journey.',
          },
          {
            icon: '🗺️',
            title: 'Photo-Walks of Your Route',
            desc: 'See every photo placed along the line of your run. A visual timeline from start to finish, for every run you photographed.',
          },
          {
            icon: '➕',
            title: 'Add Photos After',
            desc: 'Forgot to take photos in the moment? Pick from your camera roll later — ZenRun smartly tags each one to where it was taken on your route.',
          },
        ],
      },
      {
        category: 'Maps & Routes',
        philosophy: 'Every line you traced, kept.',
        items: [
          {
            icon: '🛣️',
            title: 'Run & Walk Maps',
            desc: 'Every GPS-tracked activity gets a map you can revisit. The shape of your morning loop. The unfamiliar park you wandered through. The city you ran in on holiday.',
          },
          {
            icon: '📐',
            title: 'Distance, Time, Elevation',
            desc: 'The fundamentals, recorded automatically. Pace per km when you want it. Elevation gain for the hill days.',
          },
        ],
      },
      {
        category: 'Heart Rate & Energy',
        philosophy: 'Recorded by your watch. Read like a journal entry.',
        items: [
          {
            icon: '❤️',
            title: 'Heart Rate Summary',
            desc: 'Average HR, max HR, and time-in-zone for each run — captured by your Apple Watch, served back in the post-run summary. Nothing to manage mid-run.',
          },
          {
            icon: '🎨',
            title: 'Zones as Colour',
            desc: 'A simple stacked bar shows where your heart spent the run — recovery, aerobic, tempo, threshold, VO₂. An honest picture, read like a journal entry.',
          },
          {
            icon: '🫁',
            title: 'VO₂ Max',
            desc: 'Read directly from Apple Health, shown quietly on your Watch and in your profile. A long-arc fitness signal, not a number to optimise this morning.',
          },
          {
            icon: '🔥',
            title: 'Active Energy',
            desc: 'Calories burned during your run, recorded by HealthKit. Available when you want it, never shouted at you.',
          },
        ],
      },
      {
        category: 'Recaps & Records',
        philosophy: 'Your journey, marked the way you want to remember it.',
        items: [
          {
            icon: '📅',
            title: 'Month in Review',
            desc: 'A Spotify-Wrapped-style carousel at the end of each month. Distance, runs, pace, rhythm, scenic photos, and goals — one swipe-through story on warm gradient slides.',
          },
          {
            icon: '📊',
            title: 'Quarter in Review',
            desc: 'Every three months, a full-screen recap of the season. Total km, run breakdown, consistency, PRs, scenic moments, and more.',
          },
          {
            icon: '⚡',
            title: 'Personal Records',
            desc: 'Your fastest time at each distance, tracked automatically. Filter by outdoor or treadmill. The opponent is yourself, the way you used to be.',
          },
          {
            icon: '🏆',
            title: '100 Milestones',
            desc: 'Across distance, first completions, rhythm, and goals. Each badge celebrates a marker in your own journey.',
          },
        ],
      },
    ],
  },
];

type Scale = {
  icon: string;
  title: string;
  badge: string;
  badgeAccent: 'coral' | 'teal';
  desc: string;
  bullets: string[];
};

const COMMUNITY_SCALES: Scale[] = [
  {
    icon: '👥',
    title: 'Circles',
    badge: 'Available now',
    badgeAccent: 'coral',
    desc: 'Up to 10 close friends. Runs, scenic photos, reactions. The kitchen table of your running life — accountability with warmth.',
    bullets: [
      'The real you',
      'Full activity feed',
      'Reactions and encouragement',
      'Web profile, sharable on your terms',
    ],
  },
  {
    icon: '🏘️',
    title: 'The neighbourhood',
    badge: 'Coming soon',
    badgeAccent: 'teal',
    desc: 'Pseudonymous ZenRunners in your city. Share an album, save someone else\'s, run it yourself. Discovery, not ranking.',
    bullets: [
      'A handle, not your real name',
      'Albums opt-in per run',
      'Saves and "I ran this!"',
      'Pinterest of beautiful runs near you',
    ],
  },
];

const ACCENT_CLASSES: Record<Pillar['accent'], { eyebrow: string; bar: string; bg: string; cardBg: string }> = {
  coral: {
    eyebrow: 'text-coral',
    bar: 'bg-coral',
    bg: 'bg-warm-surface',
    cardBg: 'bg-white',
  },
  teal: {
    eyebrow: 'text-teal',
    bar: 'bg-teal',
    bg: 'bg-white',
    cardBg: 'bg-warm-bg',
  },
};

function FeatureCard({ item, cardBg }: { item: Feature; cardBg: string }) {
  return (
    <div className={`${cardBg} rounded-2xl p-7 border border-gray-100 hover:shadow-md transition-shadow`}>
      <div className="text-4xl mb-4">{item.icon}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
    </div>
  );
}

function CategoryBlock({ section, cardBg }: { section: Category; cardBg: string }) {
  return (
    <div className="mb-12 last:mb-0">
      <div className="mb-6 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">{section.category}</h3>
        <p className="text-sm text-gray-400 mt-1">{section.philosophy}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {section.items.map((item) => (
          <FeatureCard key={item.title} item={item} cardBg={cardBg} />
        ))}
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <>
      {/* Page hero */}
      <section className="bg-warm-bg">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-gray-400 mb-4">
            The path and the album
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            <span className="text-coral">Show up.</span>{' '}
            <span className="text-teal">Reflect.</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            ZenRun lives in two places: the path you take, and the album you
            enjoy afterwards. Every feature on this page belongs to one of
            them &mdash; if it doesn&apos;t, it shouldn&apos;t exist.
          </p>
        </div>
      </section>

      {/* Pillars */}
      {PILLARS.map((pillar) => {
        const accent = ACCENT_CLASSES[pillar.accent];
        return (
          <section key={pillar.id} className={`${accent.bg} py-20 md:py-28`}>
            <div className="max-w-6xl mx-auto px-6">
              <div className="max-w-3xl mb-14">
                <p className={`text-xs font-semibold tracking-[0.25em] uppercase ${accent.eyebrow} mb-3`}>
                  {pillar.eyebrow}
                </p>
                <div className="flex items-baseline gap-4 mb-4">
                  <span className={`block w-1.5 h-10 ${accent.bar} rounded-full`} aria-hidden />
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                    {pillar.title}
                  </h2>
                </div>
                <p className="text-lg text-gray-600 leading-relaxed">
                  {pillar.intro}
                </p>
              </div>

              {pillar.categories.map((cat) => (
                <CategoryBlock key={cat.category} section={cat} cardBg={accent.cardBg} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Community — two scales */}
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
              you run in. Both opt-in, both about places celebrated and people
              encouraged.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-14">
            {COMMUNITY_SCALES.map((scale) => {
              const accentText = scale.badgeAccent === 'coral' ? 'text-coral' : 'text-teal';
              const accentBg = scale.badgeAccent === 'coral' ? 'bg-coral/10' : 'bg-teal/10';
              const cardBorder = scale.badgeAccent === 'teal' ? 'border-teal/30' : 'border-gray-100';
              return (
                <div
                  key={scale.title}
                  className={`bg-white rounded-2xl p-8 hover:shadow-md transition-shadow border ${cardBorder}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-4xl">{scale.icon}</div>
                    <span className={`text-[10px] font-semibold tracking-[0.2em] uppercase ${accentText} ${accentBg} px-2.5 py-1 rounded-full`}>
                      {scale.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{scale.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{scale.desc}</p>
                  <ul className="space-y-1.5 text-xs text-gray-500">
                    {scale.bullets.map((bullet) => (
                      <li key={bullet}>&middot; {bullet}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Comparison table */}
          <div className="max-w-4xl mx-auto bg-white rounded-2xl p-2 md:p-4 border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 md:px-4 font-semibold text-gray-400 text-xs uppercase tracking-wider w-1/4"></th>
                  <th className="text-left py-3 px-3 md:px-4 font-bold text-gray-900">Circles</th>
                  <th className="text-left py-3 px-3 md:px-4 font-bold text-gray-900">The neighbourhood</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-50">
                  <td className="py-3 px-3 md:px-4 font-medium text-gray-500">Who</td>
                  <td className="py-3 px-3 md:px-4">Up to 10 close friends</td>
                  <td className="py-3 px-3 md:px-4">Pseudonymous ZenRunners in your city</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-3 px-3 md:px-4 font-medium text-gray-500">What&apos;s shared</td>
                  <td className="py-3 px-3 md:px-4">Full runs, photos, reactions</td>
                  <td className="py-3 px-3 md:px-4">Albums (route + photos), opt-in per album</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-3 px-3 md:px-4 font-medium text-gray-500">Identity</td>
                  <td className="py-3 px-3 md:px-4">The real you</td>
                  <td className="py-3 px-3 md:px-4">A handle</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-3 px-3 md:px-4 font-medium text-gray-500">Signal</td>
                  <td className="py-3 px-3 md:px-4">Reactions, encouragement</td>
                  <td className="py-3 px-3 md:px-4">Saves, &ldquo;I ran this!&rdquo;</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 md:px-4 font-medium text-gray-500">Purpose</td>
                  <td className="py-3 px-3 md:px-4">Accountability</td>
                  <td className="py-3 px-3 md:px-4">Discovery</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-center text-sm text-gray-400 mt-10 max-w-xl mx-auto">
            We rank places, never people. Nothing comparative ever lands on a
            runner&apos;s profile.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center bg-coral/5 rounded-3xl p-12">
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
      </section>
    </>
  );
}
