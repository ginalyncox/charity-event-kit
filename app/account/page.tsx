import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getBundle, getEventBySlug } from '@/lib/data';
import { champion } from '@/lib/bracket';
import { money } from '@/lib/format';
import type { Bundle, Player } from '@/lib/types';
import ConfirmButton from '@/app/ConfirmButton';
import AutoRefresh from '@/app/AutoRefresh';
import { cancelMySignup, updateMySignup, updateMyTeam } from '@/lib/actions';
import { resendVerification } from '@/lib/auth-actions';
import { GameLine, playoffRoundLabel, rankTeams, rosterOf, teamName } from '@/app/ui';
import { payEntry } from '@/lib/pay-actions';
import { stripeConfigured } from '@/lib/stripe';

export const metadata: Metadata = { title: 'My events', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');

  const owned = await query<{ slug: string }>(
    `SELECT DISTINCT e.slug, e.id FROM events e LEFT JOIN event_admins a ON a.event_id = e.id AND a.user_id = $1
     WHERE e.owner_user_id = $1 OR a.user_id IS NOT NULL ORDER BY e.id DESC`,
    [user.id],
  );
  const playing = await query<{ slug: string }>(
    `SELECT DISTINCT e.slug, e.id FROM events e
       LEFT JOIN players p ON p.event_id = e.id AND p.user_id = $1
       LEFT JOIN teams t ON t.event_id = e.id AND t.captain_user_id = $1
     WHERE p.id IS NOT NULL OR t.id IS NOT NULL
     ORDER BY e.id DESC`,
    [user.id],
  );

  const vol = await query<{ n: number }>('SELECT COUNT(*)::int AS n FROM shift_signups WHERE user_id = $1', [user.id]);
  const ownedBundles = await Promise.all(owned.map(async (r) => getBundle((await getEventBySlug(r.slug))!)));
  const playingBundles = await Promise.all(playing.map(async (r) => getBundle((await getEventBySlug(r.slug))!)));

  return (
    <>
      <p className="eyebrow">Hi, {user.name || user.email}</p>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>My events</h1>
        <Link href="/account/settings" className="btn small secondary">Account settings</Link>
      </div>
      <AutoRefresh seconds={30} />
      {sp.msg && <div className="notice good" role="status">{sp.msg}</div>}
      {!user.verified && (
        <div className="notice info">
          <form action={resendVerification} className="btn-row" style={{ justifyContent: 'space-between' }}>
            <span>
              <b>Confirm your email</b> ({user.email}) to connect events you signed up for before you had an account.
            </span>
            <button className="btn small secondary">Send confirmation email</button>
          </form>
        </div>
      )}

      <History bundles={playingBundles} userId={user.id} volunteered={Number(vol[0]?.n ?? 0)} organized={ownedBundles.length} />

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
  const cardOn = stripeConfigured() && event.stripe_ready && Boolean(event.stripe_account_id);
  const payTeam = captainOf.find((t) => t.origin === 'registered' && !t.paid);
  const paySolo = me.find((p) => p.is_solo && !p.paid);

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
        {!paid && cardOn && payTeam && event.team_fee >= 50 ? (
          <form action={payEntry}>
            <input type="hidden" name="slug" value={event.slug} />
            <input type="hidden" name="what" value="team" />
            <input type="hidden" name="id" value={payTeam.id} />
            <button className="btn small">Pay {money(event.team_fee)} team fee by card</button>
          </form>
        ) : !paid && cardOn && paySolo && event.solo_fee >= 50 ? (
          <form action={payEntry}>
            <input type="hidden" name="slug" value={event.slug} />
            <input type="hidden" name="what" value="player" />
            <input type="hidden" name="id" value={paySolo.id} />
            <button className="btn small">Pay {money(event.solo_fee)} by card</button>
          </form>
        ) : (
          !paid &&
          event.payment_url && (
            <a className="btn small" href={event.payment_url} target="_blank" rel="noopener noreferrer">Pay entry fee</a>
          )
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

      {captainOf.map((t) => (
        <details key={`cap-${t.id}`} style={{ marginTop: 10 }}>
          <summary className="small">Team fundraising (you’re the captain of {t.name})</summary>
          <form action={updateMyTeam} className="stack" style={{ marginTop: 10 }}>
            <input type="hidden" name="team_id" value={t.id} />
            <label>Team goal ($)<input name="goal" inputMode="decimal" defaultValue={t.goal ? String(t.goal / 100) : ''} /></label>
            <label>
              Team fundraising link <span className="hint">Your team page’s Give button will use it.</span>
              <input name="pay_url" inputMode="url" defaultValue={t.pay_url} placeholder="https://..." />
            </label>
            <button className="btn small">Save team fundraising</button>
          </form>
        </details>
      ))}
      {me.map((p) => (
        <div key={p.id} style={{ marginTop: 10 }}>
          {event.kind === 'pledge' && (
            <p style={{ margin: '0 0 6px' }}>
              Raised: <b>{money(p.raised)}</b>
              {p.goal > 0 && <> of {money(p.goal)}</>}
              {p.distance !== null && <> · {p.distance} {event.pledge_unit}</>}
            </p>
          )}
          <div className="btn-row">
            <Link className="btn small secondary" href={`/e/${event.slug}/p/${p.id}`}>My fundraising page (share it!)</Link>
            {p.team_id && <Link className="btn small secondary" href={`/e/${event.slug}/t/${p.team_id}`}>My team’s page</Link>}
            {event.start_at && (
              <a className="btn small secondary" href={`/e/${event.slug}/calendar${p.team_id ? `?team=${p.team_id}` : ''}`}>Add to calendar</a>
            )}
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="small">Change or cancel my sign-up</summary>
            <form action={updateMySignup} className="stack" style={{ marginTop: 10 }}>
              <input type="hidden" name="player_id" value={p.id} />
              <label>Name on the roster<input name="name" defaultValue={p.name} maxLength={80} /></label>
              {event.positions.length > 0 && (
                <label>
                  Position
                  <select name="position" defaultValue={p.position}>
                    <option value="">Any / not sure</option>
                    {event.positions.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                  </select>
                </label>
              )}
              {event.positions.length === 0 && <input type="hidden" name="position" value={p.position} />}
              <label>Playing in honor of<input name="honoring" defaultValue={p.honoring} maxLength={120} /></label>
              {event.jersey_sizes && (
                <label>
                  Jersey size
                  <select name="jersey_size" defaultValue={p.jersey_size}>
                    <option value="">Choose a size</option>
                    {event.jersey_sizes.split(',').map((x) => x.trim()).filter(Boolean).map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
              )}
              <label>Fundraising goal ($)<input name="goal" inputMode="decimal" defaultValue={p.goal ? String(p.goal / 100) : ''} /></label>
              <label>
                My fundraising link <span className="hint">Your personal Zeffy, Givebutter, or GoFundMe page. Your page’s Give button will use it.</span>
                <input name="pay_url" inputMode="url" defaultValue={p.pay_url} placeholder="https://..." />
              </label>
              <button className="btn small">Save changes</button>
            </form>
            <form action={cancelMySignup} style={{ marginTop: 10 }}>
              <input type="hidden" name="player_id" value={p.id} />
              <ConfirmButton className="btn small danger" message={`Cancel your sign-up for ${event.name}? If you paid, contact the organizer about a refund.`}>
                Cancel my sign-up
              </ConfirmButton>
            </form>
          </details>
        </div>
      ))}
    </div>
  );
}

/** Lifetime stats and badges across every event. */
function History({ bundles, userId, volunteered, organized }: { bundles: Bundle[]; userId: number; volunteered: number; organized: number }) {
  const mine = bundles.flatMap((b) => b.players.filter((p) => p.user_id === userId).map((p) => ({ b, p })));
  const events = new Set(mine.map((x) => x.b.event.id)).size;
  const raised = mine.reduce((s, x) => s + x.p.raised, 0);
  const champs = mine.filter((x) => x.p.team_id !== null && champion(x.b.games) === x.p.team_id).length;
  const captain = bundles.some((b) => b.teams.some((t) => t.captain_user_id === userId));
  const honoring = mine.some((x) => x.p.honoring);
  const badges = [
    events >= 1 && { icon: '🎟️', label: 'First event' },
    events >= 3 && { icon: '🔁', label: `${events}-event regular` },
    raised >= 10000 && { icon: '💯', label: '$100 club' },
    raised >= 50000 && { icon: '⭐', label: '$500 club' },
    raised >= 100000 && { icon: '🌟', label: '$1,000 club' },
    champs > 0 && { icon: '🏆', label: champs > 1 ? `${champs}× champion` : 'Champion' },
    captain && { icon: '🧢', label: 'Team captain' },
    volunteered > 0 && { icon: '🙋', label: 'Volunteer' },
    organized > 0 && { icon: '📋', label: 'Organizer' },
    honoring && { icon: '🎖️', label: 'Played in honor' },
  ].filter(Boolean) as { icon: string; label: string }[];
  if (!events && !organized && !volunteered) return null;
  return (
    <section className="card">
      <h2>My history</h2>
      <div className="stats">
        <div className="stat"><span className="small muted">Events</span><b>{events}</b></div>
        <div className="stat"><span className="small muted">Raised</span><b>{money(raised)}</b></div>
        {volunteered > 0 && <div className="stat"><span className="small muted">Volunteer shifts</span><b>{volunteered}</b></div>}
      </div>
      {badges.length > 0 && (
        <div className="btn-row" style={{ marginTop: 12 }}>
          {badges.map((b) => <span key={b.label} className="pill accent" style={{ fontSize: 13 }}>{b.icon} {b.label}</span>)}
        </div>
      )}
    </section>
  );
}
