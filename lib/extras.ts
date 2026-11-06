import 'server-only';
import { query } from './db';

export type Shift = { id: number; role: string; when_text: string; slots: number; signups: { id: number; name: string; email: string; user_id: number | null }[] };
export type Award = { id: number; title: string; choice_type: 'player' | 'team'; open: boolean; published: boolean; tally: { choice: string; votes: number }[] };

export async function getShifts(eventId: number): Promise<Shift[]> {
  const shifts = await query<any>('SELECT * FROM shifts WHERE event_id = $1 ORDER BY id', [eventId]);
  const signups = await query<any>(
    'SELECT s.* FROM shift_signups s JOIN shifts h ON h.id = s.shift_id WHERE h.event_id = $1 ORDER BY s.id',
    [eventId],
  );
  return shifts.map((s) => ({
    id: Number(s.id),
    role: s.role,
    when_text: s.when_text,
    slots: Number(s.slots),
    signups: signups
      .filter((x) => Number(x.shift_id) === Number(s.id))
      .map((x) => ({ id: Number(x.id), name: x.name, email: x.email, user_id: x.user_id === null ? null : Number(x.user_id) })),
  }));
}

export async function getAwards(eventId: number): Promise<Award[]> {
  const awards = await query<any>('SELECT * FROM awards WHERE event_id = $1 ORDER BY id', [eventId]);
  const votes = await query<any>(
    `SELECT v.award_id, v.choice, COUNT(*)::int AS votes FROM award_votes v JOIN awards a ON a.id = v.award_id
     WHERE a.event_id = $1 GROUP BY v.award_id, v.choice ORDER BY votes DESC, v.choice`,
    [eventId],
  );
  return awards.map((a) => ({
    id: Number(a.id),
    title: a.title,
    choice_type: a.choice_type === 'team' ? 'team' : 'player',
    open: Boolean(a.open),
    published: Boolean(a.published),
    tally: votes.filter((v) => Number(v.award_id) === Number(a.id)).map((v) => ({ choice: v.choice, votes: Number(v.votes) })),
  }));
}
