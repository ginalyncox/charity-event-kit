import type { Metadata } from 'next';
import Link from 'next/link';
import { publicEvents, type ListedEvent } from '@/lib/data';
import { presetById } from '@/lib/presets';
import NearMe from './NearMe';

export const metadata: Metadata = {
  title: 'Browse events',
  description: 'Find charity tournaments, rides, walks, and more — and sign up.',
};
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const KINDS = [
  { id: '', label: 'All' },
  { id: 'bracket', label: 'Tournaments' },
  { id: 'leaderboard', label: 'Competitions' },
  { id: 'pledge', label: 'Rides & walks' },
];

function fmtDate(e: ListedEvent): string {
  if (e.event_date) return e.event_date;
  if (!e.start_at) return 'Date to be announced';
  const d = new Date(`${e.start_at}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function BrowsePage({ searchParams }: Props) {
  const sp = await searchParams;
  const view = sp.view === 'calendar' ? 'calendar' : 'list';
  const kind = KINDS.some((k) => k.id === sp.kind) ? sp.kind ?? '' : '';
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 80);

  const all = await publicEvents(view === 'calendar');
  const events = all.filter(
    (e) =>
      (!kind || e.kind === kind) &&
      (!q || [e.name, e.charity, e.location, presetById(e.sport)?.label ?? ''].some((x) => x.toLowerCase().includes(q))),
  );
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(kind && { kind }), ...(q && { q }), ...(view === 'calendar' && { view }), ...(sp.month && { month: sp.month }), ...over });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/events?${s}` : '/events';
  };

  return (
    <>
      <p className="eyebrow">Find an event</p>
      <h1>Browse events</h1>
      <p className="muted">Charity tournaments, rides, walks, and more. Sign up, follow along, or give.</p>

      <div className="card">
        <form method="get" className="btn-row" action="/events">
          {kind && <input type="hidden" name="kind" value={kind} />}
          {view === 'calendar' && <input type="hidden" name="view" value="calendar" />}
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Search by name, sport, city, or cause" aria-label="Search events" style={{ flex: 1, minWidth: 200 }} />
          <button className="btn secondary">Search</button>
        </form>
        <div className="btn-row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <nav className="tabs" aria-label="Event type" style={{ margin: 0 }}>
            {KINDS.map((k) => (
              <Link key={k.id || 'all'} href={qs({ kind: k.id })} aria-current={kind === k.id ? 'page' : undefined}>{k.label}</Link>
            ))}
          </nav>
          <nav className="tabs" aria-label="View" style={{ margin: 0 }}>
            <Link href={qs({ view: '' , month: '' })} aria-current={view === 'list' ? 'page' : undefined}>List</Link>
            <Link href={qs({ view: 'calendar' })} aria-current={view === 'calendar' ? 'page' : undefined}>Calendar</Link>
          </nav>
        </div>
      </div>

      {view === 'list' ? (
        <>
          <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="small muted">{events.length} upcoming event{events.length === 1 ? '' : 's'}</span>
            <NearMe items={events.map((e) => ({ slug: e.slug, lat: e.lat, lng: e.lng }))} />
          </div>
          {events.length ? (
            <div id="event-list" className="grid grid-2">
              {events.map((e) => (
                <Link key={e.slug} href={`/e/${e.slug}`} data-slug={e.slug} className="card event-card">
                  <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                    <span className="pill">{presetById(e.sport)?.label ?? 'Event'}</span>
                    {e.signups_open ? <span className="pill good">Sign-ups open</span> : <span className="pill">Sign-ups closed</span>}
                  </div>
                  <h3 style={{ margin: '10px 0 4px' }}>{e.name}</h3>
                  {e.charity && <p className="small muted" style={{ margin: 0 }}>For {e.charity}</p>}
                  <div className="meta" style={{ margin: '8px 0 0' }}>
                    <span>📅 {fmtDate(e)}</span>
                    {e.location && <span>📍 {e.location}</span>}
                    {e.people > 0 && <span>👥 {e.people}</span>}
                  </div>
                  <span className="small" data-distance style={{ color: 'var(--good)', fontWeight: 700 }} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="card"><p className="muted">No events match. Try a different search, or <Link href="/new">create one</Link>.</p></div>
          )}
        </>
      ) : (
        <CalendarView events={events} month={sp.month} qs={qs} />
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Add these events to your calendar</h3>
        <p className="small muted">Subscribe once and new public events show up in your phone’s calendar automatically.</p>
        <div className="btn-row">
          <a className="btn small secondary" href="/events/calendar.ics">Download calendar file</a>
          <a className="btn small secondary" href="webcal://eventkit.ginamakes.app/events/calendar.ics">Subscribe (iPhone / Mac)</a>
        </div>
      </div>
    </>
  );
}

function CalendarView({ events, month, qs }: { events: ListedEvent[]; month?: string; qs: (o: Record<string, string>) => string }) {
  const now = new Date();
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKey(now);
  const [y, mo] = m.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const daysIn = new Date(y, mo, 0).getDate();
  const lead = first.getDay();
  const prev = monthKey(new Date(y, mo - 2, 1));
  const next = monthKey(new Date(y, mo, 1));
  const today = now.toISOString().slice(0, 10);

  const byDay = new Map<number, ListedEvent[]>();
  for (const e of events) {
    if (!e.start_at) continue;
    const start = new Date(`${e.start_at}T12:00:00`);
    const end = e.end_at ? new Date(`${e.end_at}T12:00:00`) : start;
    for (let d = new Date(start); d <= end && d.getTime() - start.getTime() < 40 * 864e5; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === y && d.getMonth() === mo - 1) {
        const day = d.getDate();
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(e);
      }
    }
  }
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const undated = events.filter((e) => !e.start_at);

  return (
    <div className="card">
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <Link className="btn small secondary" href={qs({ view: 'calendar', month: prev })} aria-label="Previous month">←</Link>
        <h2 style={{ margin: 0 }}>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <Link className="btn small secondary" href={qs({ view: 'calendar', month: next })} aria-label="Next month">→</Link>
      </div>
      <div className="cal" role="grid" aria-label="Events calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="cal-head" role="columnheader">{d}</div>
        ))}
        {cells.map((day, i) => {
          const iso = day ? `${m}-${String(day).padStart(2, '0')}` : '';
          return (
            <div key={i} className={`cal-day${day ? '' : ' empty'}${iso === today ? ' today' : ''}`} role="gridcell">
              {day && <span className="cal-num">{day}</span>}
              {day &&
                (byDay.get(day) ?? []).map((e) => (
                  <Link key={e.slug} href={`/e/${e.slug}`} className="cal-event" title={e.name}>{e.name}</Link>
                ))}
            </div>
          );
        })}
      </div>
      {undated.length > 0 && (
        <p className="small muted" style={{ marginTop: 10 }}>
          Date to be announced: {undated.map((e, i) => <span key={e.slug}>{i ? ', ' : ''}<Link href={`/e/${e.slug}`}>{e.name}</Link></span>)}
        </p>
      )}
    </div>
  );
}
