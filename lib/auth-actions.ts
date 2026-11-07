'use server';

import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { one, query } from './db';
import { allow, clearHits, clientIp, recordHit } from './ratelimit';
import { mailConfigured, sendMail, siteOrigin } from './mail';
import { currentUser, endSession, hashPassword, linkSignupsByEmail, normalizeEmail, sendVerification, startSession, verifyPassword } from './auth';
import { text } from './format';

/** Only allow redirects back into this site. */
function safeNext(input: FormDataEntryValue | null): string {
  const s = text(input, 300);
  return s.startsWith('/') && !s.startsWith('//') ? s : '/account';
}

function back(path: string, err: string, next: string, email = ''): never {
  const p = new URLSearchParams({ err, next });
  if (email) p.set('email', email);
  redirect(`${path}?${p.toString()}`);
}

export async function signUp(fd: FormData) {
  const next = safeNext(fd.get('next'));
  if (!(await allow(`signup:${await clientIp()}`, 10, 60))) {
    back('/signup', 'Too many new accounts from this connection. Please try again later.', next);
  }
  const name = text(fd.get('name'), 80);
  const email = normalizeEmail(text(fd.get('email'), 200));
  const password = String(fd.get('password') ?? '');

  if (!name || !email.includes('@')) back('/signup', 'Please enter your name and a valid email.', next, email);
  if (password.length < 8) back('/signup', 'Password must be at least 8 characters.', next, email);
  if (password.length > 200) back('/signup', 'Password is too long.', next, email);

  const existing = await one('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) back('/login', 'You already have an account. Log in below.', next, email);

  const user = await one<{ id: number }>(
    'INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id',
    [email, name, await hashPassword(password)],
  );
  const id = Number(user!.id);
  // Earlier sign-ups with this email connect once the email is confirmed.
  await sendVerification({ id, email, name });
  await startSession(id);
  redirect(next);
}

export async function logIn(fd: FormData) {
  const next = safeNext(fd.get('next'));
  const email = normalizeEmail(text(fd.get('email'), 200));
  const password = String(fd.get('password') ?? '');

  // Slow down password guessing: 8 misses per email or 30 per connection in 15 minutes.
  const emailBucket = `login:${email}`;
  const ipBucket = `login-ip:${await clientIp()}`;
  if (!(await allow(emailBucket, 8, 15, false)) || !(await allow(ipBucket, 30, 15, false))) {
    back('/login', 'Too many tries. Please wait 15 minutes, or reset your password.', next, email);
  }

  const user = await one<{ id: number; name: string; password_hash: string; email_verified_at: string | null }>(
    'SELECT id, name, password_hash, email_verified_at FROM users WHERE email = $1',
    [email],
  );
  // Same message either way, so the form doesn't reveal who has an account.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordHit(emailBucket);
    await recordHit(ipBucket);
    back('/login', 'That email and password don’t match.', next, email);
  }
  await clearHits(emailBucket);
  const id = Number(user.id);
  if (user.email_verified_at) await linkSignupsByEmail({ id, email });
  await startSession(id);
  redirect(next);
}

export async function logOut() {
  await endSession();
  redirect('/');
}

/* ---------- password reset ---------- */

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export async function requestReset(fd: FormData) {
  const email = normalizeEmail(text(fd.get('email'), 200));
  if (!mailConfigured()) redirect('/forgot?status=unavailable');
  if (!(await allow(`reset:${await clientIp()}`, 5, 60)) || !(await allow(`reset:${email}`, 3, 60))) {
    redirect('/forgot?status=sent'); // same answer, no hints
  }
  const user = await one<{ id: number; name: string }>('SELECT id, name FROM users WHERE email = $1', [email]);
  if (user) {
    const token = randomBytes(32).toString('hex');
    await query(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1,$2, now() + interval '1 hour')`, [
      hashToken(token),
      user.id,
    ]);
    const link = `${await siteOrigin()}/reset?token=${token}`;
    await sendMail(
      email,
      'Reset your Charity Event Kit password',
      `Hi ${user.name || 'there'},\n\nUse this link to set a new password (it works for 1 hour):\n${link}\n\nIf you didn’t ask for this, you can ignore this email.\n\n— Charity Event Kit by Gina Makes`,
    );
  }
  // Same message whether or not the account exists.
  redirect('/forgot?status=sent');
}

export async function resetPassword(fd: FormData) {
  const token = text(fd.get('token'), 200);
  const password = String(fd.get('password') ?? '');
  if (password.length < 8 || password.length > 200) {
    redirect(`/reset?token=${encodeURIComponent(token)}&err=${encodeURIComponent('Password must be at least 8 characters.')}`);
  }
  const row = await one<{ user_id: number }>(
    `UPDATE password_resets SET used = TRUE
     WHERE token_hash = $1 AND used = FALSE AND expires_at > now()
     RETURNING user_id`,
    [hashToken(token)],
  );
  if (!row) redirect('/forgot?status=expired');
  const userId = Number(row.user_id);
  // Clicking a reset link from your inbox also proves you own the email.
  await query('UPDATE users SET password_hash = $1, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2', [
    await hashPassword(password),
    userId,
  ]);
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]); // log out everywhere else
  const u = await one<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
  if (u) {
    await clearHits(`login:${u.email}`);
    await linkSignupsByEmail({ id: userId, email: u.email });
  }
  await startSession(userId);
  redirect('/account?msg=Password+updated');
}

export async function resendVerification() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');
  if (user.verified) redirect('/account?msg=Your+email+is+already+confirmed');
  if (!(await allow(`verify:${user.id}`, 3, 60))) redirect('/account?msg=We+just+sent+one.+Check+your+inbox+and+spam+folder.');
  const ok = await sendVerification(user);
  redirect(`/account?msg=${encodeURIComponent(ok ? `Confirmation email sent to ${user.email}.` : 'Email isn’t switched on yet. Try again later.')}`);
}
