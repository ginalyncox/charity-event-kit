import 'server-only';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { one, query } from './db';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'cek_session';
const SESSION_DAYS = 30;

export type User = { id: number; email: string; name: string };

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
  const row = await one<User>(
    `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return row ? { ...row, id: Number(row.id) } : null;
});

/**
 * Connects earlier sign-ups made with this email to the account.
 * Note: emails aren't verified yet, so only low-risk info is shown for linked sign-ups.
 */
export async function linkSignupsByEmail(user: User): Promise<void> {
  await query('UPDATE players SET user_id = $1 WHERE user_id IS NULL AND lower(email) = $2', [user.id, user.email]);
  await query('UPDATE teams SET captain_user_id = $1 WHERE captain_user_id IS NULL AND lower(captain_email) = $2', [
    user.id,
    user.email,
  ]);
}
