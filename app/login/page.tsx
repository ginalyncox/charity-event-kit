import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logIn } from '@/lib/auth-actions';
import { currentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Log in' };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/account';
  if (await currentUser()) redirect(next);

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <h1>Log in</h1>
      <p className="muted">See your events, your team, and your games.</p>
      {sp.err && <div className="notice warn">{sp.err}</div>}
      <div className="card">
        <form action={logIn} className="stack">
          <input type="hidden" name="next" value={next} />
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" defaultValue={sp.email ?? ''} />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button className="btn">Log in</button>
        </form>
      </div>
      <p>
        New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
      <p className="small muted">
        Forgot your password? Email-based resets aren’t set up yet — contact your event organizer or Gina Makes for help.
      </p>
    </div>
  );
}
