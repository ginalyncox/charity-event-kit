import { getBundle, getEventBySlug } from '@/lib/data';
import { slugify } from '@/lib/format';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// iCalendar lines must be folded at 75 octets.
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

/** Calendar file (.ics) for the event; ?team=ID adds that team's games to the notes. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event || !event.start_at) return new Response('No calendar date set for this event.', { status: 404 });
  const { teams, games } = await getBundle(event);
  const url = new URL(req.url);
  const teamId = Number(url.searchParams.get('team'));
  const team = teams.find((t) => t.id === teamId);

  const day = event.start_at.replace(/-/g, '');
  const next = new Date(`${event.start_at}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, '');

  const lines = [`${url.origin}/e/${slug}`];
  if (event.event_date) lines.unshift(`When: ${event.event_date}`);
  if (team) {
    lines.push('', `Your team: ${team.name}`);
    for (const g of games.filter((x) => x.home_team_id === team.id || x.away_team_id === team.id)) {
      const h = teams.find((t) => t.id === g.home_team_id)?.name ?? 'TBD';
      const a = teams.find((t) => t.id === g.away_team_id)?.name ?? 'TBD';
      lines.push(`${g.stage === 'pool' ? `Round ${g.round}` : 'Playoffs'}: ${h} vs ${a}${g.starts_at ? ` — ${g.starts_at}` : ''}${g.rink ? `, ${g.rink}` : ''}`);
    }
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gina Makes//Charity Event Kit//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.slug}@charity-event-kit`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${end}`,
    fold(`SUMMARY:${esc(event.name)}`),
    event.location ? fold(`LOCATION:${esc(event.location)}`) : '',
    fold(`DESCRIPTION:${esc(lines.join('\n'))}`),
    fold(`URL:${url.origin}/e/${slug}`),
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return new Response(lines.length ? ics.join('\r\n') + '\r\n' : '', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slugify(event.name)}.ics"`,
    },
  });
}
