import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getBundle, getEventBySlug } from '@/lib/data';
import { champion } from '@/lib/bracket';
import { money } from '@/lib/format';
import type { Bundle, Player } from '@/lib/types';
import { GameLine, playoffRoundLabel, rankTeams, rosterOf, teamName } from '@/app/ui';

export const metadata: Metadata = { title: 'My events', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');

  const owned = await query<{ slug: string }>('SELECT slug FROM events WHERE owner_user_id = $1 ORDER BY id DESC', [user.id]);
  const playing = await query<{ slug: string }>(
    `SELECT DISTINCT e.slug, e.id FROM events e
       LEFT JOIN players p ON p.event_id = e.id AND p.user_id = $1
       LEFT JOIN teams t ON t.event_id = e.id AND t.captain_user_id = $1
     WHERE p.id IS NOT NULL OR t.id IS NOT NULL
     ORDER BY e.id DESC`,
    [user.id],
  );

  const ownedBundles = await Promise.all(owned.map(async (r) => getBundle((await getEventBySlug(r.slug))!)));
  const playingBundles = await Promise.all(playing.map(async (r) => getBundle((await getEventBySlug(r.slug))!)));

  return (
    <>
      <p className="eyebrow">Hi, {user.name || user.email}</p>
      <h1>My events</h1>

      <section>
        <h2>Playing in</h2>
        {playingBundles.length ? (
          playingBundles.map((b) => <PlayingCard key={b.event.id} bundle={b} userId={user.id} />)
        ) : (
          <div className="card">
            <p className="muted">
              You haven’t signed up for an event with <b>{user.email}</b> yet. When an organizer shares a sign-up link, sign up
              while you’re logged in and it will show here.
            </p>
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="btn-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Organizing</h2>
          <Link href="/new" className="btn small">Create an event</Link>
        </div>
        <div style={{ marginTop: 12 }}>
          {ownedBundles.length ? (
            ownedBundles.map((b) => (
              <div key={b.event.id} className="card">
                <h3>{b.event.name}</h3>
                <div className="meta">
                  {b.event.event_date && <span>📅 {b.event.event_date}</span>}
                  <span>👥 {b.players.length} signed up</span>
                  <span className={`pill ${b.event.signups_open ? 'good' : 'warn'}`}>{b.event.signups_open ? 'Sign-ups open' : 'Sign-ups closed'}</span>
                </div>
                <div className="btn-row">
                  <Link className="btn small" href={`/manage/${b.event.slug}`}>Manage</Link>
                  <Link className="btn small secondary" href={`/e/${b.event.slug}`}>Public page</Link>
                </div>
              </div>
            ))
          ) : (
            <div className="card"><p className="muted">You’re not organizing any events yet.</p></div>
          )}
        </div>
      </section>
    </>
  );
}

function PlayingCard({ bundle, userId }: { bundle: Bundle; userId: number }) {
  const { event, teams, players, games } = bundle;
  const me: Player[] = players.filter((p) => p.user_id === userId);
  const captainOf = teams.filter((t) => t.captain_user_id === userId);
  const teamIds = [...new Set([...me.map((p) => p.team_id), ...captainOf.map((t) => t.id)].filter((x): x is number => x !== null))];
  const positionOrder = event.positions.map((p) => p.name);

  // Paid: a solo player's own flag, or the team's flag for registered teams.
  const paid = me.some((p) => p.paid) || teams.some((t) => teamIds.includes(t.id) && t.origin === 'registered' && t.paid);
  const champ = champion(games);

  return (
    <div className="card">
      <h3>
        <Link href={`/e/${event.slug}`}>{event.name}</Link>
      </h3>
      <div className="meta">
        {event.event_date && <span>📅 {event.event_date}</span>}
        {event.location && <span>📍 {event.location}</span>}
      </div>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <span className={`pill ${paid ? 'good' : 'warn'}`}>{paid ? 'Paid' : 'Not marked paid yet'}</span>
        {!paid && event.payment_url && (
          <a className="btn small" href={event.payment_url} target="_blank" rel="noopener noreferrer">Pay entry fee</a>
        )}
      </div>

      {teamIds.length === 0 && <p className="muted">Your team hasn’t been set yet. Check back after the organizer balances teams.</p>}

      {teamIds.map((tid) => {
        const roster = rosterOf(players, tid, positionOrder);
        const myGames = games
          .filter((g) => g.home_team_id === tid || g.away_team_id === tid)
          .sort((a, b) => (a.stage === b.stage ? a.round - b.round : a.stage === 'pool' ? -1 : 1));
        const rank = event.kind === 'leaderboard' ? rankTeams(bundle).findIndex((t) => t.id === tid) : -1;
        return (
          <div key={tid} style={{ marginTop: 8 }}>
            <h3>
              Your team: {teamName(teams, tid)}
              {champ === tid && ' 🏆'}
            </h3>
            {rank >= 0 && <p>Current place: <b>#{rank + 1}</b></p>}
            <details>
              <summary>Teammates ({roster.length})</summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {roster.map((p) => (
                  <li key={p.id}>
                    {p.name}
                    {p.position && <span className="small muted"> · {p.position}</span>}
                  </li>
                ))}
              </ul>
            </details>
            {event.kind === 'bracket' && (
              <div style={{ marginTop: 10 }}>
                <b className="small">Your games</b>
                {myGames.length ? (
                  myGames.map((g) => (
                    <div key={g.id}>
                      <div className="small muted" style={{ marginTop: 6 }}>
                        {g.stage === 'pool' ? `Round ${g.round}` : playoffRoundLabel(games, g.round)}
                      </div>
                      <GameLine game={g} teams={teams} />
                    </div>
                  ))
                ) : (
                  <p className="small muted">The schedule isn’t out yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {event.kind === 'pledge' &&
        me.map((p) => (
          <p key={p.id} style={{ marginTop: 8 }}>
            Raised: <b>{money(p.raised)}</b>
            {p.goal > 0 && <> of {money(p.goal)}</>}
            {p.distance !== null && <> · {p.distance} {event.pledge_unit}</>}
          </p>
        ))}
    </div>
  );
}
