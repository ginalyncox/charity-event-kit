import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { currentUser } from '@/lib/auth';
import { logOut } from '@/lib/auth-actions';
import SwRegister from './SwRegister';

export const metadata: Metadata = {
  title: { default: 'Charity Event Kit', template: '%s · Charity Event Kit' },
  appleWebApp: { capable: true, title: 'Event Kit', statusBarStyle: 'default' },
  description:
    'Sign-ups, fair teams, brackets, leaderboards, and pledge tracking for charity tournaments, rides, and walks. A tool by Gina Makes.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#d9481f' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <SwRegister />
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand" aria-label="Charity Event Kit home">
              <span className="brand-mark" aria-hidden="true">CE</span>
              <span>
                Charity Event Kit
                <small>by Gina Makes</small>
              </span>
            </Link>
            <nav className="btn-row" style={{ gap: 8 }} aria-label="Account">
              <Link href="/events" className="btn small secondary">Browse</Link>
              {user ? (
                <>
                  <Link href="/account" className="btn small secondary">My events</Link>
                  <form action={logOut}>
                    <button className="btn small secondary" aria-label={`Log out ${user.name}`}>Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn small secondary">Log in</Link>
                  <Link href="/signup" className="btn small">Sign up</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <span>Charity Event Kit · A tool by Gina Makes — Games, tools, and curious creations.</span>
            <span>
              <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/support">Support</Link> · © 2026 Gina Makes LLC · Altoona, Iowa
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
