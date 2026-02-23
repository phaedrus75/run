import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ZenRun — Log runs. Build streaks. Stay consistent.',
  description:
    'A simple running app focused on consistency over performance. Log your run in 10 seconds, track streaks, earn achievements, and compete with friends.',
  openGraph: {
    title: 'ZenRun — Log runs. Build streaks. Stay consistent.',
    description: 'A simple running app focused on consistency over performance.',
    url: 'https://zenrun.co',
    siteName: 'ZenRun',
    type: 'website',
  },
};

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🏃</span>
          <span className="text-xl font-bold text-gray-900">ZenRun</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/features" className="text-sm font-medium text-gray-600 hover:text-coral transition-colors">
            Features
          </Link>
          <Link href="/support" className="text-sm font-medium text-gray-600 hover:text-coral transition-colors">
            Support
          </Link>
          <a
            href="#download"
            className="text-sm font-semibold text-white bg-coral hover:bg-coral-dark px-5 py-2.5 rounded-full transition-colors"
          >
            Download
          </a>
        </div>
        <div className="md:hidden">
          <a
            href="#download"
            className="text-sm font-semibold text-white bg-coral px-4 py-2 rounded-full"
          >
            Download
          </a>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🏃</span>
              <span className="text-xl font-bold text-white">ZenRun</span>
            </div>
            <p className="text-sm leading-relaxed max-w-md">
              A simple running app focused on consistency over performance.
              Log your run in 10 seconds, build streaks, and stay motivated.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-3">
              <li><Link href="/features" className="text-sm hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/support" className="text-sm hover:text-white transition-colors">Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-sm hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8 text-sm text-center">
          &copy; {new Date().getFullYear()} ZenRun. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-warm-bg text-gray-900 antialiased">
        <Header />
        <main className="pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
