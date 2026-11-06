import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBundle, getEventBySlug } from '@/lib/data';
import { hostOf, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; id: string }> };

async function load(slug: string, id: string) {
  const event = await getEventBySlug(slug);
  if (!event) return null;
  const bundle = await getBundle(event);
  const player = bundle.players.find((p) => String(p.id) === id);
  return player ? { event, bundle, player } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const d = await load(slug, id);
  if (!d) return { title: 'Not found' };
  return {
    title: `Support ${d.player.name}`,
    description: `${d.player.name} is ${d.event.kind === 'pledge' ? 'raising money' : 'playing'} in ${d.event.name}${d.event.charity ? ` for ${d.event.charity}` : ''}.`,
  };
}

/** A personal page people can share: "Support me in this event." */
export default async function PersonalPage({ params }: Props) {
  const { slug, id } = await params;
  const d = await load(slug, id);
  if (!d) notFound();
  const { event, bundle, player } = d;
  const team = bundle.teams.find((t) => t.id === player.team_id);
  // Their own link first, then their team's, then the event's.
  const giveUrl = player.pay_url || team?.pay_url || event.payment_url;
  const pct = player.goal > 0 ? Math.min(100, Math.round((player.raised / player.goal) * 100)) : 0;

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <p className="eyebrow">{event.name}</p>
      <h1>Support {player.name}</h1>
      <p className="lead muted">
        {player.name} is {event.kind === 'pledge' ? 'raising money' : 'playing'}
        {team ? <> with <b>{team.name}</b></> : null}
        {event.charity ? <> for {event.charity}</> : null}.
        {player.honoring && <> Playing in honor of {player.honoring}.</>}
      </p>
      <div className="card">
        <div className="stats">
          <div className="stat"><span className="small muted">Raised</span><b>{money(player.raised)}</b></div>
          {player.goal > 0 && <div className="stat"><span className="small muted">Goal</span><b>{money(player.goal)}</b></div>}
          {player.distance !== null && (
            <div className="stat"><span className="small muted">Distance</span><b>{player.distance} {event.pledge_unit}</b></div>
          )}
        </div>
        {player.goal > 0 && (
          <div className="thermo" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress to goal">
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
        {giveUrl ? (
          <>
            <a className="btn" href={giveUrl} target="_blank" rel="noopener noreferrer">Give to support {player.name}</a>
            <p className="small muted" style={{ marginTop: 8 }}>
              Opens {hostOf(giveUrl)}.
              {!player.pay_url && <> Add “for {player.name}” in the note when you give, so the organizer can credit them.</>}
            </p>
          </>
        ) : (
          <p className="small muted">The organizer hasn’t added a giving link yet.</p>
        )}
      </div>
      <p>
        <Link href={`/e/${event.slug}`}>See the whole event →</Link>
      </p>
    </div>
  );
}
