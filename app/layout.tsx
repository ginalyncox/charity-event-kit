import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Charity Event Kit', template: '%s · Charity Event Kit' },
  description:
    'Sign-ups, fair teams, brackets, leaderboards, and pledge tracking for charity tournaments, rides, and walks. A tool by Gina Makes.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand" aria-label="Charity Event Kit home">
              <span className="brand-mark" aria-hidden="true">CE</span>
              <span>
                Charity Event Kit
                <small>by Gina Makes</small>
              </span>
            </Link>
            <Link href="/new" className="btn small">Create an event</Link>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <span>Charity Event Kit · A tool by Gina Makes — Games, tools, and curious creations.</span>
            <span>© 2026 Gina Makes LLC · Altoona, Iowa</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
