import 'server-only';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { one, query } from './db';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'cek_session';
const SESSION_DAYS = 30;

export type User = { id: number; email: string; name: string; verified: boolean };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 200);
}

/* ---------- passwords ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* ---------- sessions ---------- */

// Only a hash of the token is stored, so a database leak can't be used to log in.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function startSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [
    hashToken(token),
    userId,
    expires.toISOString(),
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  jar.delete(SESSION_COOKIE);
}

/** The logged-in user for this request, or null. Cached per request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const row = await one<any>(
    `SELECT u.id, u.email, u.name, u.email_verified_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return row ? { id: Number(row.id), email: row.email, name: row.name, verified: Boolean(row.email_verified_at) } : null;
});

/**
 * Connects earlier sign-ups made with this email to the account.
 * Only call this after the email address has been verified.
 */
export async function linkSignupsByEmail(user: Pick<User, 'id' | 'email'>): Promise<void> {
  await query('UPDATE players SET user_id = $1 WHERE user_id IS NULL AND lower(email) = $2', [user.id, user.email]);
  await query('UPDATE teams SET captain_user_id = $1 WHERE captain_user_id IS NULL AND lower(captain_email) = $2', [
    user.id,
    user.email,
  ]);
}

/* ---------- email verification ---------- */

export async function sendVerification(user: Pick<User, 'id' | 'email' | 'name'>): Promise<boolean> {
  const { mailConfigured, sendMail, siteOrigin } = await import('./mail');
  if (!mailConfigured()) return false;
  const token = randomBytes(32).toString('hex');
  await query(`INSERT INTO email_tokens (token_hash, user_id, expires_at) VALUES ($1,$2, now() + interval '2 days')`, [
    hashToken(token),
    user.id,
  ]);
  const link = `${await siteOrigin()}/verify?token=${token}`;
  return sendMail(
    user.email,
    'Confirm your email for Charity Event Kit',
    `Hi ${user.name || 'there'},\n\nTap this link to confirm your email (it works for 2 days):\n${link}\n\nConfirming connects any events you signed up for with this email to your account.\n\nIf you didn’t create an account, you can ignore this email.\n\n— Charity Event Kit by Gina Makes`,
  );
}

/** Marks the email verified and links earlier sign-ups. Returns the user id, or null if the link is bad. */
export async function confirmEmail(token: string): Promise<number | null> {
  const row = await one<{ user_id: number }>(
    'DELETE FROM email_tokens WHERE token_hash = $1 AND expires_at > now() RETURNING user_id',
    [hashToken(token)],
  );
  if (!row) return null;
  const id = Number(row.user_id);
  const u = await one<{ email: string }>('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING email', [id]);
  if (u) await linkSignupsByEmail({ id, email: u.email });
  return id;
}
