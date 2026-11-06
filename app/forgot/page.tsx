import type { Metadata } from 'next';
import Link from 'next/link';
import { requestReset } from '@/lib/auth-actions';
import { mailConfigured } from '@/lib/mail';

export const metadata: Metadata = { title: 'Reset your password' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ForgotPage({ searchParams }: Props) {
  const sp = await searchParams;
  const ready = mailConfigured();
  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <h1>Reset your password</h1>
      {sp.status === 'sent' && (
        <div className="notice good">If that email has an account, we sent a reset link. It works for 1 hour. Check your spam folder too.</div>
      )}
      {sp.status === 'expired' && <div className="notice warn">That reset link has expired or was already used. Ask for a new one below.</div>}
      {(!ready || sp.status === 'unavailable') && (
        <div className="notice warn">Password reset emails aren’t switched on yet. Contact your event organizer or Gina Makes for help.</div>
      )}
      {ready && (
        <div className="card">
          <form action={requestReset} className="stack">
            <label>
              Your account email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <button className="btn">Email me a reset link</button>
          </form>
        </div>
      )}
      <p><Link href="/login">Back to log in</Link></p>
    </div>
  );
}
