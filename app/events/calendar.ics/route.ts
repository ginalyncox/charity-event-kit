import { publicEvents } from '@/lib/data';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line: string) => (line.match(/.{1,73}/g) ?? ['']).join('\r\n ');
const ymd = (iso: string) => iso.replace(/-/g, '');

/** Subscribable calendar of every upcoming public event. */
export async function GET(req: Request) {
  const origin = process.env.SITE_URL?.replace(/\/$/, '') || new URL(req.url).origin;
  const events = (await publicEvents(false)).filter((e) => e.start_at);
  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gina Makes//Charity Event Kit//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Charity Event Kit — events',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const e of events) {
    const last = new Date(`${e.end_at || e.start_at}T00:00:00Z`);
    last.setUTCDate(last.getUTCDate() + 1);
    const url = `${origin}/e/${e.slug}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.slug}@charity-event-kit`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.start_at)}`,
      `DTEND;VALUE=DATE:${ymd(last.toISOString().slice(0, 10))}`,
      fold(`SUMMARY:${esc(e.name)}`),
      ...(e.location ? [fold(`LOCATION:${esc(e.location)}`)] : []),
      fold(`DESCRIPTION:${esc([e.charity ? `For ${e.charity}` : '', url].filter(Boolean).join('\n'))}`),
      fold(`URL:${url}`),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
  });
}
