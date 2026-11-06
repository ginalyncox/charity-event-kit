import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canManage } from '@/lib/access';
import { getBundle, getEventBySlug } from '@/lib/data';
import { getAwards, getShifts } from '@/lib/extras';
import { champion } from '@/lib/bracket';
import { money } from '@/lib/format';
import { pledgeTotals } from '@/lib/pledges';
import { parseSponsors } from '@/lib/sponsors';
import PrintButton from '@/app/PrintButton';
import { activeTeams, teamName, teamRaised, totalRaised } from '@/app/ui';

export const metadata: Metadata = { title: 'Impact report', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** One-page summary for the charity's board, sponsors, and next year's planning. */
export default async function ReportPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event || !(await canManage(event, sp.key))) notFound();
  const bundle = await getBundle(event);
  const [shifts, awards] = await Promise.all([getShifts(event.id), getAwards(event.id)]);
  const { players, games, auction } = bundle;

  const raised = totalRaised(bundle);
  const people = players.reduce((s, p) => s + p.raised, 0) + bundle.teams.reduce((s, t) => s + t.raised, 0);
  const pledges = pledgeTotals(bundle);
  const auctionPaid = auction.filter((i) => i.paid && i.high_bid).reduce((s, i) => s + (i.high_bid ?? 0), 0);
  const volunteers = shifts.reduce((n, s) => n + s.signups.length, 0);
  const finals = games.filter((g) => g.status === 'final');
  const goals = finals.reduce((n, g) => n + (g.home_score ?? 0) + (g.away_score ?? 0), 0);
  const champ = champion(games);
  const topPeople = [...players].sort((a, b) => b.raised - a.raised).filter((p) => p.raised > 0).slice(0, 5);
  const topTeams = activeTeams(bundle).map((t) => ({ t, sum: teamRaised(bundle, t) })).filter((x) => x.sum > 0).sort((a, b) => b.sum - a.sum).slice(0, 5);
  const sponsors = parseSponsors(event.sponsors);
  const honoring = players.filter((p) => p.honoring).length;

  return (
    <div className="report" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="btn-row no-print" style={{ marginBottom: 16 }}>
        <PrintButton />
        <Link className="btn secondary" href={`/manage/${slug}?key=${event.admin_key}`}>Back</Link>
      </div>
      <p className="eyebrow">Impact report</p>
      <h1>{event.name}</h1>
      <p className="muted">
        {[event.event_date, event.location].filter(Boolean).join(' · ')}
        {event.charity && <><br />Benefiting {event.charity}</>}
      </p>

      <div className="stats card">
        <div className="stat"><span className="small muted">Raised</span><b>{money(raised)}</b></div>
        {event.fundraising_goal > 0 && <div className="stat"><span className="small muted">Goal</span><b>{Math.round((raised / event.fundraising_goal) * 100)}%</b></div>}
        <div className="stat"><span className="small muted">Participants</span><b>{players.length}</b></div>
        <div className="stat"><span className="small muted">Teams</span><b>{activeTeams(bundle).length}</b></div>
        {volunteers > 0 && <div className="stat"><span className="small muted">Volunteers</span><b>{volunteers}</b></div>}
        {finals.length > 0 && <div className="stat"><span className="small muted">Games played</span><b>{finals.length}</b></div>}
      </div>

      <div className="card">
        <h2>Where the money came from</h2>
        <table>
          <tbody>
            <tr><td>Team and personal fundraising</td><td className="num">{money(people)}</td></tr>
            {bundle.pledges.length > 0 && <tr><td>Goal pledges paid ({bundle.pledges.length} pledges, {money(pledges.owed)} pledged)</td><td className="num">{money(pledges.paid)}</td></tr>}
            {auction.length > 0 && <tr><td>Silent auction paid ({auction.length} items)</td><td className="num">{money(auctionPaid)}</td></tr>}
            <tr className="top"><td>Total</td><td className="num">{money(raised)}</td></tr>
          </tbody>
        </table>
        <p className="small muted">Entry fees are collected on the organizer’s own payment page and aren’t included unless entered as fundraising.</p>
      </div>

      {(champ || goals > 0 || awards.some((a) => a.tally.length)) && (
        <div className="card">
          <h2>Highlights</h2>
          <ul>
            {champ && <li>🏆 Champions: <b>{teamName(bundle.teams, champ)}</b></li>}
            {goals > 0 && <li>{goals} goals scored{pledges.perGoal > 0 ? ` — every one raised ${money(pledges.perGoal)}` : ''}</li>}
            {honoring > 0 && <li>{honoring} participant{honoring === 1 ? '' : 's'} played in honor of someone</li>}
            {awards.filter((a) => a.tally.length).map((a) => <li key={a.id}>{a.title}: <b>{a.tally[0].choice}</b></li>)}
          </ul>
        </div>
      )}

      {(topPeople.length > 0 || topTeams.length > 0) && (
        <div className="grid grid-2">
          {topTeams.length > 0 && (
            <div className="card">
              <h3>Top teams</h3>
              <table><tbody>{topTeams.map(({ t, sum }) => <tr key={t.id}><td>{t.name}</td><td className="num">{money(sum)}</td></tr>)}</tbody></table>
            </div>
          )}
          {topPeople.length > 0 && (
            <div className="card">
              <h3>Top fundraisers</h3>
              <table><tbody>{topPeople.map((p) => <tr key={p.id}><td>{p.name}</td><td className="num">{money(p.raised)}</td></tr>)}</tbody></table>
            </div>
          )}
        </div>
      )}

      {sponsors.length > 0 && (
        <div className="card">
          <h2>Thank you to our sponsors</h2>
          <p>{sponsors.map((s) => s.name).join(' · ')}</p>
        </div>
      )}
      <p className="small muted">Made with Charity Event Kit by Gina Makes · © 2026 Gina Makes LLC</p>
    </div>
  );
}
