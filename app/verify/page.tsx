import type { Metadata } from 'next';
import Link from 'next/link';
import { confirmEmail } from '@/lib/auth';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const ok = sp.token ? (await confirmEmail(sp.token.slice(0, 200))) !== null : false;
  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }} className="card">
      {ok ? (
        <>
          <h1>Email confirmed ✓</h1>
          <p className="muted">Any events you signed up for with this email are now in your account.</p>
          <Link className="btn" href="/account">Go to My events</Link>
        </>
      ) : (
        <>
          <h1>That link didn’t work</h1>
          <p className="muted">It may have expired or already been used. Log in and send a new confirmation email from My events.</p>
          <Link className="btn secondary" href="/account">My events</Link>
        </>
      )}
    </div>
  );
}
