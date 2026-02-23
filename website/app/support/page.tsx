import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support — ZenRun',
  description: 'Get help with ZenRun. Contact our support team.',
};

export default function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Support</h1>
        <p className="text-lg text-gray-500">
          Need help with ZenRun? We&apos;re here for you.
        </p>
      </div>

      <div className="space-y-6">
        {/* Contact */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <div className="text-3xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Email Us</h2>
          <p className="text-gray-500 mb-4">
            For bug reports, feature requests, account issues, or general questions.
          </p>
          <a
            href="mailto:support@zenrun.co"
            className="inline-block text-coral font-semibold hover:underline"
          >
            support@zenrun.co
          </a>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: 'How do I log a run?',
                a: 'Go to the Run tab, select your distance, choose outdoor or treadmill, enter your time in minutes and seconds, and tap Save.',
              },
              {
                q: 'How do streaks work?',
                a: 'Your streak counts consecutive weeks where you logged at least one run. Miss a week and it resets. Your longest streak is always saved.',
              },
              {
                q: 'Can I change my handle?',
                a: 'No. Handles are permanent once set. Choose carefully when you first set yours in Profile settings.',
              },
              {
                q: 'How do I join a circle?',
                a: 'Go to the Circles tab and tap the join button. Enter the invite code shared by the circle creator.',
              },
              {
                q: 'How do I delete my account?',
                a: 'Email support@zenrun.co with your registered email address and we will delete your account and all associated data.',
              },
              {
                q: 'Does ZenRun use GPS?',
                a: 'No. ZenRun does not track your location. You manually log your distance and time after your run.',
              },
              {
                q: 'Is ZenRun free?',
                a: 'Yes. ZenRun is free to download and use.',
              },
            ].map((faq) => (
              <div key={faq.q}>
                <h3 className="font-semibold text-gray-900 mb-1">{faq.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-coral/5 rounded-2xl p-8 text-center">
          <p className="text-gray-600">
            We typically respond within <strong>24 hours</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
