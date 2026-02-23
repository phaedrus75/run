import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — ZenRun',
  description: 'How ZenRun handles your data.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: February 22, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-[15px] leading-relaxed text-gray-600">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
          <p>
            When you create a ZenRun account, we collect your email address, display name,
            and an optional handle. When you use the app, we store the running data you
            enter (distance, time, date), step counts, weight entries, and goal settings.
          </p>
          <p>
            We do <strong>not</strong> collect GPS or location data. We do <strong>not</strong> access
            your phone&apos;s health, contacts, camera, or microphone.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
          <p>Your data is used to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Display your running statistics, personal records, and achievements</li>
            <li>Calculate streaks, goals progress, and month-in-review summaries</li>
            <li>Show your name and handle on circle leaderboards you join</li>
            <li>Send password reset emails when you request them</li>
          </ul>
          <p>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. Data Storage & Security</h2>
          <p>
            Your data is stored on secure servers hosted by Railway (railway.app). Passwords
            are hashed using bcrypt and are never stored in plain text. API communication is
            encrypted via HTTPS. Authentication uses JSON Web Tokens (JWT) that expire after 7 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. Circles & Social Features</h2>
          <p>
            When you join a circle, other members can see your display name, handle,
            monthly run count, and monthly km total. They cannot see your weight, steps,
            or individual run details.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Retention & Deletion</h2>
          <p>
            Your data is retained as long as your account is active. You may request
            account deletion by contacting us at{' '}
            <a href="mailto:support@zenrun.co" className="text-coral hover:underline">
              support@zenrun.co
            </a>
            . Upon deletion, all your personal data, runs, and circle memberships will be
            permanently removed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">6. Third-Party Services</h2>
          <p>
            ZenRun uses the following third-party services:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Railway</strong> — backend hosting and database</li>
            <li><strong>Expo / EAS</strong> — app building and distribution</li>
          </ul>
          <p>Each service has its own privacy policy governing their handling of data.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">7. Children&apos;s Privacy</h2>
          <p>
            ZenRun is not intended for children under 13. We do not knowingly collect
            personal information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">8. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Changes will be posted on this
            page with an updated revision date. Continued use of the app after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">9. Contact</h2>
          <p>
            Questions about this privacy policy? Contact us at{' '}
            <a href="mailto:support@zenrun.co" className="text-coral hover:underline">
              support@zenrun.co
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
