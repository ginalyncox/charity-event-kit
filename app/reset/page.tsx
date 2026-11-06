import type { Metadata } from 'next';
import { resetPassword } from '@/lib/auth-actions';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ResetPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <h1>Choose a new password</h1>
      {sp.err && <div className="notice warn">{sp.err}</div>}
      <div className="card">
        <form action={resetPassword} className="stack">
          <input type="hidden" name="token" value={sp.token ?? ''} />
          <label>
            New password <span className="hint">At least 8 characters.</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <button className="btn">Save new password</button>
        </form>
      </div>
    </div>
  );
}
