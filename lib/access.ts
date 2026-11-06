import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { currentUser } from './auth';
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
  return !!user && event.owner_user_id === user.id;
}
