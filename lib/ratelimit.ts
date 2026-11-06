import 'server-only';
import { headers } from 'next/headers';
import { one, query } from './db';

/** Best-effort client IP (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'unknown').split(',')[0].trim().slice(0, 64);
}

/**
 * Counts hits in a time window. Returns true if this hit is allowed.
 * Pass record=false to only check (e.g. before a login attempt).
 */
export async function allow(bucket: string, limit: number, windowMinutes: number, record = true): Promise<boolean> {
  const row = await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM rate_hits WHERE bucket = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
    [bucket, String(windowMinutes)],
  );
  const ok = Number(row?.n ?? 0) < limit;
  if (record && ok) await query('INSERT INTO rate_hits (bucket) VALUES ($1)', [bucket]);
  // Occasional cleanup so the table stays small.
  if (Math.random() < 0.02) await query(`DELETE FROM rate_hits WHERE created_at < now() - interval '1 day'`);
  return ok;
}

export async function recordHit(bucket: string): Promise<void> {
  await query('INSERT INTO rate_hits (bucket) VALUES ($1)', [bucket]);
}

export async function clearHits(bucket: string): Promise<void> {
  await query('DELETE FROM rate_hits WHERE bucket = $1', [bucket]);
}
