import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signUp } from '@/lib/auth-actions';
import { currentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create an account' };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SignupPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/account';
  if (await currentUser()) redirect(next);

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <h1>Create an account</h1>
      <p className="muted">
        One account for everything: run events as an organizer, or sign up to play and see your team and games.
      </p>
      {sp.err && <div className="notice warn">{sp.err}</div>}
      <div className="card">
        <form action={signUp} className="stack">
          <input type="hidden" name="next" value={next} />
          <label>
            Your name
            <input name="name" required maxLength={80} autoComplete="name" />
          </label>
          <label>
            Email <span className="hint">Use the same email you signed up for events with, and they’ll show up in your account.</span>
            <input name="email" type="email" required autoComplete="email" defaultValue={sp.email ?? ''} />
          </label>
          <label>
            Password <span className="hint">At least 8 characters.</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <p className="small muted" style={{ margin: 0 }}>
            By creating an account you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.
          </p>
          <button className="btn">Create account</button>
        </form>
      </div>
      <p>
        Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
      </p>
    </div>
  );
}
