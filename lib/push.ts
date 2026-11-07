import 'server-only';
import webpush from 'web-push';
import { query } from './db';
import { apnsConfigured, sendApns } from './apns';

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup() {
  if (ready || !pushConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://charity-event-kit.vercel.app',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ready = true;
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };

/**
 * Sends to everyone following this event: people following one of `teamIds`,
 * plus people following the whole event. Dead subscriptions are cleaned up.
 */
export async function notifyEvent(eventId: number, teamIds: number[], msg: PushMessage): Promise<number> {
  let native = 0;
  if (apnsConfigured()) {
    const rows = await query<{ token: string }>(
      `SELECT token FROM apns_tokens WHERE event_id = $1 AND (team_id IS NULL OR team_id = ANY($2::int[]))`,
      [eventId, teamIds],
    );
    native = await sendApns(rows.map((r) => r.token), msg).catch(() => 0);
  }
  if (!pushConfigured()) return native;
  setup();
  const subs = await query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT endpoint, p256dh, auth FROM push_subs WHERE event_id = $1 AND (team_id IS NULL OR team_id = ANY($2::int[]))`,
    [eventId, teamIds],
  );
  let sent = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 600 });
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) await query('DELETE FROM push_subs WHERE endpoint = $1', [s.endpoint]);
      }
    }),
  );
  return sent + native;
}
