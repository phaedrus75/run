import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — ZenRun',
  description: 'Terms and conditions for using ZenRun.',
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: February 22, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-[15px] leading-relaxed text-gray-600">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p>
            By downloading, installing, or using ZenRun (&quot;the App&quot;), you agree to be bound
            by these Terms of Service. If you do not agree, do not use the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
          <p>
            ZenRun is a mobile application that allows users to log running activities,
            track personal records, build streaks, earn achievements, set goals, and
            participate in social circles with other runners.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. User Accounts</h2>
          <p>
            You must create an account to use ZenRun. You are responsible for maintaining
            the confidentiality of your login credentials and for all activities that occur
            under your account. You agree to provide accurate information during registration.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. User Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Use the App for any unlawful purpose</li>
            <li>Submit false or misleading run data</li>
            <li>Attempt to gain unauthorized access to other users&apos; accounts</li>
            <li>Use offensive or inappropriate language in circle names or handles</li>
            <li>Interfere with or disrupt the App&apos;s services or servers</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. Handles</h2>
          <p>
            Once you set a handle (@username), it cannot be changed. Handles must be at
            least 3 characters and may only contain lowercase letters, numbers, and
            underscores. We reserve the right to reclaim handles that violate our policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">6. Circles</h2>
          <p>
            Circles are limited to 10 members each. You may create multiple circles.
            When you join a circle, your display name, handle, and monthly running
            statistics are visible to other members.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">7. Intellectual Property</h2>
          <p>
            All content, design, and functionality of ZenRun are owned by ZenRun and
            protected by applicable intellectual property laws. You retain ownership of the
            data you enter into the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">8. Disclaimer of Warranties</h2>
          <p>
            ZenRun is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
            that the App will be uninterrupted, error-free, or secure. ZenRun is not a
            medical or fitness advisory tool — consult a healthcare professional before
            starting any exercise program.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, ZenRun shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use
            of or inability to use the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">10. Termination</h2>
          <p>
            We may suspend or terminate your account at any time for violations of these
            terms. You may delete your account at any time by contacting{' '}
            <a href="mailto:support@zenrun.co" className="text-coral hover:underline">
              support@zenrun.co
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">11. Changes to Terms</h2>
          <p>
            We may modify these terms at any time. Changes will be posted on this page.
            Continued use of the App after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">12. Contact</h2>
          <p>
            Questions about these terms? Contact us at{' '}
            <a href="mailto:support@zenrun.co" className="text-coral hover:underline">
              support@zenrun.co
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
