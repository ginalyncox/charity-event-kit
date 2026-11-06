import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { deleteMyAccount } from '@/lib/actions';
import ConfirmButton from '@/app/ConfirmButton';

export const metadata: Metadata = { title: 'Account settings', robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AccountSettings({ searchParams }: Props) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account/settings');
  const sp = await searchParams;
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1>Account settings</h1>
      {sp.err && <div className="notice warn">{sp.err}</div>}
      <div className="card">
        <p style={{ margin: 0 }}><b>{user.name}</b></p>
        <p className="muted" style={{ margin: 0 }}>{user.email}</p>
      </div>
      <div className="card">
        <h2>Change password</h2>
        <p className="small muted">Use “Forgot your password?” to set a new one by email.</p>
        <Link href="/forgot" className="btn secondary small">Reset password</Link>
      </div>
      <div className="card">
        <h2>Delete my account</h2>
        <ul className="small" style={{ paddingLeft: 18 }}>
          <li>Your login and saved alerts are deleted.</li>
          <li>Events you organize go to a co-organizer if there is one. Otherwise they’re deleted.</li>
          <li>Your name stays on rosters for events you joined (the organizer’s records), but your email is removed.</li>
        </ul>
        <form action={deleteMyAccount} className="stack">
          <label>
            Type DELETE to confirm
            <input name="confirm" autoComplete="off" />
          </label>
          <ConfirmButton className="btn danger" message="Delete your account forever? This can’t be undone.">Delete my account</ConfirmButton>
        </form>
      </div>
    </div>
  );
}
