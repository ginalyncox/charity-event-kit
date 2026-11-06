'use server';

import { redirect } from 'next/navigation';
import { one } from './db';
import { endSession, hashPassword, linkSignupsByEmail, normalizeEmail, startSession, verifyPassword } from './auth';
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
  await linkSignupsByEmail({ id, email, name });
  await startSession(id);
  redirect(next);
}

export async function logIn(fd: FormData) {
  const next = safeNext(fd.get('next'));
  const email = normalizeEmail(text(fd.get('email'), 200));
  const password = String(fd.get('password') ?? '');

  const user = await one<{ id: number; name: string; password_hash: string }>(
    'SELECT id, name, password_hash FROM users WHERE email = $1',
    [email],
  );
  // Same message either way, so the form doesn't reveal who has an account.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    back('/login', 'That email and password don’t match.', next, email);
  }
  const id = Number(user.id);
  await linkSignupsByEmail({ id, email, name: user.name });
  await startSession(id);
  redirect(next);
}

export async function logOut() {
  await endSession();
  redirect('/');
}
