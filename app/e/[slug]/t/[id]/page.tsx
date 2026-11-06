import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBundle, getEventBySlug } from '@/lib/data';
import { hostOf, money } from '@/lib/format';
import { rosterOf, teamRaised } from '@/app/ui';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; id: string }> };

async function load(slug: string, id: string) {
  const event = await getEventBySlug(slug);
  if (!event) return null;
  const bundle = await getBundle(event);
  const team = bundle.teams.find((t) => String(t.id) === id);
  return team ? { event, bundle, team } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const d = await load(slug, id);
  if (!d) return { title: 'Not found' };
  return {
    title: `Support ${d.team.name}`,
    description: `${d.team.name} is raising money in ${d.event.name}${d.event.charity ? ` for ${d.event.charity}` : ''}.`,
  };
}

/** A team's shareable fundraising page. */
export default async function TeamPage({ params }: Props) {
  const { slug, id } = await params;
  const d = await load(slug, id);
  if (!d) notFound();
  const { event, bundle, team } = d;
  const roster = rosterOf(bundle.players, team.id, event.positions.map((p) => p.name));
  const total = teamRaised(bundle, team);
  const giveUrl = team.pay_url || event.payment_url;
  const pct = team.goal > 0 ? Math.min(100, Math.round((total / team.goal) * 100)) : 0;
  const allTeams = bundle.teams
    .filter((t) => t.origin === 'set' || bundle.players.some((p) => p.team_id === t.id))
    .map((t) => ({ t, sum: teamRaised(bundle, t) }))
    .sort((a, b) => b.sum - a.sum);
  const place = allTeams.findIndex((x) => x.t.id === team.id) + 1;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <p className="eyebrow">{event.name}</p>
      <h1>Support {team.name}</h1>
      <p className="lead muted">
        {team.name} is raising money{event.charity ? <> for {event.charity}</> : null}.
        {allTeams.length > 1 && total > 0 && <> They’re <b>#{place}</b> of {allTeams.length} teams.</>}
      </p>
      <div className="card">
        <div className="stats">
          <div className="stat"><span className="small muted">Team total</span><b>{money(total)}</b></div>
          {team.goal > 0 && <div className="stat"><span className="small muted">Team goal</span><b>{money(team.goal)}</b></div>}
          <div className="stat"><span className="small muted">Members</span><b>{roster.length}</b></div>
        </div>
        {team.goal > 0 && (
          <div className="thermo" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress to team goal">
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
        {giveUrl ? (
          <>
            <a className="btn" href={giveUrl} target="_blank" rel="noopener noreferrer">Give to {team.name}</a>
            <p className="small muted" style={{ marginTop: 8 }}>
              Opens {hostOf(giveUrl)}.{!team.pay_url && <> Add “for {team.name}” in the note so the organizer can credit the team.</>}
            </p>
          </>
        ) : (
          <p className="small muted">The organizer hasn’t added a giving link yet.</p>
        )}
      </div>
      <div className="card">
        <h2>Team members</h2>
        {roster.length ? (
          <div className="table-wrap">
            <table>
              <tbody>
                {roster.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/e/${event.slug}/p/${p.id}`}>{p.name}</Link>
                      {p.honoring && <div className="small muted">For {p.honoring}</div>}
                    </td>
                    <td className="num">{p.raised > 0 ? money(p.raised) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No members yet.</p>
        )}
      </div>
      <p><Link href={`/e/${event.slug}`}>See the whole event →</Link></p>
    </div>
  );
}
