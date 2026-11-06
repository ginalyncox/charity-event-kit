import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { currentUser } from './auth';
import { one } from './db';
import type { EventRow } from './types';

export function sameKey(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Organizer access: the event's owner (logged in), or anyone with the private organizer link. */
export async function canManage(event: EventRow, key: string | undefined | null): Promise<boolean> {
  if (key && sameKey(event.admin_key, key)) return true;
  const user = await currentUser();
  if (!user) return false;
  if (event.owner_user_id === user.id) return true;
  // Co-organizers are tied to a specific account (not just an email), since emails aren't verified yet.
  const co = await one('SELECT 1 FROM event_admins WHERE event_id = $1 AND user_id = $2', [event.id, user.id]);
  return !!co;
}
