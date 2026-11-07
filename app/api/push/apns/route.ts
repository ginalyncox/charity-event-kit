import { currentUser } from '@/lib/auth';
import { one, query } from '@/lib/db';
import { getEventBySlug } from '@/lib/data';
import { allow, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const okToken = (t: unknown): t is string => typeof t === 'string' && /^[0-9a-fA-F]{32,200}$/.test(t);

/** Save (POST) or remove (DELETE) an iPhone app's alert token for an event. */
export async function POST(req: Request) {
  if (!(await allow(`apns:${await clientIp()}`, 30, 10))) return Response.json({ ok: false }, { status: 429 });
  const body = await req.json().catch(() => null);
  const event = body?.slug ? await getEventBySlug(String(body.slug).slice(0, 100)) : null;
  if (!event || !okToken(body?.token)) return Response.json({ ok: false }, { status: 400 });
  const teamId = body.teamId ? Number(body.teamId) : null;
  const team = teamId ? await one('SELECT id FROM teams WHERE id = $1 AND event_id = $2', [teamId, event.id]) : null;
  const user = await currentUser();
  await query(
    `INSERT INTO apns_tokens (token, event_id, team_id, user_id) VALUES ($1,$2,$3,$4)
     ON CONFLICT (token, event_id) DO UPDATE SET team_id = EXCLUDED.team_id, user_id = EXCLUDED.user_id`,
    [body.token.toLowerCase(), event.id, team ? teamId : null, user?.id ?? null],
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const event = body?.slug ? await getEventBySlug(String(body.slug).slice(0, 100)) : null;
  if (okToken(body?.token) && event) await query('DELETE FROM apns_tokens WHERE token = $1 AND event_id = $2', [body.token.toLowerCase(), event.id]);
  return Response.json({ ok: true });
}
