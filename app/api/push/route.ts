import { currentUser } from '@/lib/auth';
import { one, query } from '@/lib/db';
import { getEventBySlug } from '@/lib/data';
import { allow, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const okUrl = (u: unknown) => typeof u === 'string' && u.startsWith('https://') && u.length < 1000;

/** Save (POST) or remove (DELETE) a phone's alert subscription for an event. */
export async function POST(req: Request) {
  if (!(await allow(`push:${await clientIp()}`, 30, 10))) return Response.json({ ok: false }, { status: 429 });
  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  const event = body?.slug ? await getEventBySlug(String(body.slug).slice(0, 100)) : null;
  if (!event || !okUrl(sub?.endpoint) || typeof sub?.keys?.p256dh !== 'string' || typeof sub?.keys?.auth !== 'string') {
    return Response.json({ ok: false }, { status: 400 });
  }
  const teamId = body.teamId ? Number(body.teamId) : null;
  const team = teamId ? await one('SELECT id FROM teams WHERE id = $1 AND event_id = $2', [teamId, event.id]) : null;
  const user = await currentUser();
  await query(
    `INSERT INTO push_subs (endpoint, p256dh, auth, event_id, team_id, user_id) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (endpoint, event_id) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
       team_id = EXCLUDED.team_id, user_id = EXCLUDED.user_id`,
    [sub.endpoint, sub.keys.p256dh.slice(0, 200), sub.keys.auth.slice(0, 100), event.id, team ? teamId : null, user?.id ?? null],
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const event = body?.slug ? await getEventBySlug(String(body.slug).slice(0, 100)) : null;
  if (okUrl(body?.endpoint) && event) await query('DELETE FROM push_subs WHERE endpoint = $1 AND event_id = $2', [body.endpoint, event.id]);
  return Response.json({ ok: true });
}
