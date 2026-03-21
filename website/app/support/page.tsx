import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support — ZenRun',
  description: 'Get help with ZenRun. FAQs, contact, and everything you need to know.',
};

const FAQ_SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      {
        q: 'How do I log a run?',
        a: 'Tap the Run tab, pick your distance (1K to 21K), choose outdoor or treadmill, enter your time, and tap Save. The whole thing takes about 2 seconds.',
      },
      {
        q: 'What distances can I log?',
        a: '9 distances: 1K, 2K, 3K, 5K, 8K, 10K, 15K, 18K, and 21K. All available at every runner level.',
      },
      {
        q: 'Can I backdate a run I forgot to log?',
        a: 'Yes. When logging a run, tap the date field to pick any past date. You can also edit or delete any run from your history.',
      },
      {
        q: 'Does ZenRun use GPS?',
        a: 'No. ZenRun deliberately does not track your location. Run without your phone if you want. Log it when you\'re back.',
      },
    ],
  },
  {
    title: 'Rhythm & Milestones',
    items: [
      {
        q: 'How does rhythm work?',
        a: 'Run at least twice in a calendar week (Mon–Sun) and your rhythm continues. Miss a week and it pauses — but your longest rhythm is always saved. It\'s not a streak that punishes you. It\'s a rhythm you come back to.',
      },
      {
        q: 'What is the rhythm plant?',
        a: 'Your rhythm is visualised as a growing plant — from a seed (🌰) at week 0 to a mighty oak (🌲) at 26+ weeks. It grows with your consistency.',
      },
      {
        q: 'How many milestones are there?',
        a: '100 milestones across 8 categories: run count, total distance, first completions, rhythm, goals, scenic runs, speed, and special achievements.',
      },
      {
        q: 'What are runner levels?',
        a: 'You progress through four levels — Breath, Stride, Flow, and Zen — based on your total runs. Each level represents a deeper stage of your running journey.',
      },
    ],
  },
  {
    title: 'Circles & Community',
    items: [
      {
        q: 'What are circles?',
        a: 'Private groups of up to 10 friends. You see each other\'s runs, react to activity, and share scenic photos — accountability without competition.',
      },
      {
        q: 'How do I create or join a circle?',
        a: 'Go to the Circles tab. To create, tap "Create Circle" and share the invite code. To join, tap "Join" and enter the code your friend shared.',
      },
      {
        q: 'What are web profiles?',
        a: 'You can share your running journey on the web at zenrun.co/runner/your-handle. Choose your privacy: fully private, visible to circles only, or public for everyone to see.',
      },
      {
        q: 'How do I set my profile visibility?',
        a: 'Go to your Profile screen in the app and choose from Private, Circles, or Public under Profile Visibility. You can change it anytime.',
      },
    ],
  },
  {
    title: 'Account & Privacy',
    items: [
      {
        q: 'Can I change my handle?',
        a: 'No. Handles are permanent once set. Choose carefully when you create yours in the Profile screen.',
      },
      {
        q: 'I forgot my password. How do I reset it?',
        a: 'Tap "Forgot password?" on the login screen, enter your email, and we\'ll send you a 6-digit reset code. Enter the code and your new password to get back in.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Email support@zenrun.co from your registered email address and we\'ll delete your account and all associated data within 48 hours.',
      },
      {
        q: 'Is ZenRun free?',
        a: 'Yes. ZenRun is completely free. No subscriptions, no in-app purchases, no ads.',
      },
      {
        q: 'What data does ZenRun collect?',
        a: 'Only what you explicitly log: runs, times, scenic photos, step days, and weight (if you choose to track it). We don\'t track location, browsing, or any background data.',
      },
    ],
  },
];

export default function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Support</h1>
        <p className="text-lg text-gray-500">
          Everything you need to know about ZenRun.
        </p>
      </div>

      <div className="space-y-6">
        {/* Contact */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <div className="text-3xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Email Us</h2>
          <p className="text-gray-500 mb-4">
            Bug reports, feature requests, account issues, or just want to say hi.
          </p>
          <a
            href="mailto:support@zenrun.co"
            className="inline-block text-coral font-semibold hover:underline"
          >
            support@zenrun.co
          </a>
        </div>

        {/* FAQ sections */}
        {FAQ_SECTIONS.map((section) => (
          <div key={section.title} className="bg-white rounded-2xl p-8 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{section.title}</h2>
            <div className="space-y-5">
              {section.items.map((faq) => (
                <div key={faq.q}>
                  <h3 className="font-semibold text-gray-900 mb-1.5">{faq.q}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Response Time */}
        <div className="bg-coral/5 rounded-2xl p-8 text-center">
          <p className="text-gray-600">
            We typically respond within <strong>48 hours</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
