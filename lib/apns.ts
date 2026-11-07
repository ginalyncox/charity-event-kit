import 'server-only';
import { createPrivateKey, sign } from 'node:crypto';
import http2 from 'node:http2';
import { query } from './db';

/**
 * Sends iPhone alerts through Apple Push Notification service (APNs).
 * Turns on when these are set: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8_BASE64.
 * APNS_TOPIC defaults to the app's bundle ID.
 */
export function apnsConfigured(): boolean {
  return Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_P8_BASE64);
}

let cached: { token: string; at: number } | null = null;

/** Apple wants a signed ES256 token, reusable for up to an hour. */
function providerToken(): string {
  if (cached && Date.now() - cached.at < 40 * 60 * 1000) return cached.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'ES256', kid: process.env.APNS_KEY_ID });
  const claims = b64({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const key = createPrivateKey(Buffer.from(process.env.APNS_KEY_P8_BASE64!, 'base64').toString('utf8'));
  const sig = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  cached = { token: `${header}.${claims}.${sig}`, at: Date.now() };
  return cached.token;
}

export type ApnsMessage = { title: string; body: string; url: string; tag?: string };

export async function sendApns(tokens: string[], msg: ApnsMessage): Promise<number> {
  if (!apnsConfigured() || !tokens.length) return 0;
  const host = process.env.APNS_SANDBOX === '1' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const topic = process.env.APNS_TOPIC || 'app.ginamakes.eventkit';
  const payload = JSON.stringify({
    aps: { alert: { title: msg.title, body: msg.body }, sound: 'default', 'thread-id': msg.tag ?? 'event' },
    url: msg.url,
  });
  const client = http2.connect(host);
  let sent = 0;
  try {
    await Promise.all(
      tokens.map(
        (t) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ':method': 'POST',
              ':path': `/3/device/${t}`,
              authorization: `bearer ${providerToken()}`,
              'apns-topic': topic,
              'apns-push-type': 'alert',
              'apns-priority': '10',
              ...(msg.tag ? { 'apns-collapse-id': msg.tag.slice(0, 64) } : {}),
            });
            req.setTimeout(8000, () => req.close());
            req.on('response', async (h) => {
              const status = Number(h[':status']);
              if (status === 200) sent++;
              // 410 = the app was deleted or alerts turned off; 400 BadDeviceToken = stale.
              if (status === 410 || status === 400) await query('DELETE FROM apns_tokens WHERE token = $1', [t]).catch(() => {});
            });
            req.on('error', () => resolve());
            req.on('close', () => resolve());
            req.end(payload);
          }),
      ),
    );
  } finally {
    client.close();
  }
  return sent;
}
