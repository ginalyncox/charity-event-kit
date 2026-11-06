import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canManage, sameKey } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getBundle, getEventBySlug } from '@/lib/data';
import {
  addTeam,
  advancePlayoffs,
  balanceAction,
  makeSchedule,
  movePlayer,
  removePlayer,
  removeTeam,
  renameTeam,
  savePlayerResult,
  saveScore,
  saveTeamResult,
  startPlayoffs,
  togglePaid,
  toggleSignups,
  unlockPlayer,
  updateSettings,
} from '@/lib/actions';
import { rosterWarnings } from '@/lib/balance';
import { champion, nextPlayoffRound } from '@/lib/bracket';
import { money } from '@/lib/format';
import type { Bundle, EventRow } from '@/lib/types';
import {
  activeTeams,
  ChampionBanner,
  GameLine,
  groupRounds,
  Leaderboard,
  playoffRoundLabel,
  rosterOf,
  StandingsTable,
  teamRaised,
  totalRaised,
} from '@/app/ui';

export const metadata: Metadata = { title: 'Organizer', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

function Auth({ e }: { e: EventRow }) {
  return (
    <>
      <input type="hidden" name="slug" value={e.slug} />
      <input type="hidden" name="key" value={e.admin_key} />
    </>
  );
}

export default async function ManagePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event || !(await canManage(event, sp.key))) notFound();

  // Someone logged in with a valid organizer link for an event with no owner
  // (made before accounts existed) becomes its owner.
  const user = await currentUser();
  if (user && event.owner_user_id === null && sp.key && sameKey(event.admin_key, sp.key)) {
    await query('UPDATE events SET owner_user_id = $1 WHERE id = $2 AND owner_user_id IS NULL', [user.id, event.id]);
    event.owner_user_id = user.id;
  }
  const bundle = await getBundle(event);

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;
  const publicUrl = `${origin}/e/${event.slug}`;
  const manageUrl = `${origin}/manage/${event.slug}?key=${event.admin_key}`;

  const resultsTab = event.kind === 'bracket' ? { id: 'games', label: 'Games' } : { id: 'results', label: 'Results' };
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'people', label: 'People & payments' },
    { id: 'teams', label: 'Teams' },
    resultsTab,
    { id: 'settings', label: 'Settings' },
  ];
  const tab = tabs.some((t) => t.id === sp.tab) ? sp.tab! : 'overview';
  const link = (id: string) => `/manage/${event.slug}?key=${event.admin_key}&tab=${id}`;

  return (
    <>
      <p className="eyebrow">Organizer</p>
      <h1>{event.name}</h1>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <Link className="btn secondary small" href={`/e/${event.slug}`}>View public page</Link>
        <span className={`pill ${event.signups_open ? 'good' : 'warn'}`}>{event.signups_open ? 'Sign-ups open' : 'Sign-ups closed'}</span>
      </div>

      {sp.msg === 'created' ? (
        <div className="notice good">
          <b>Your event is ready.</b> You can always get back here from <Link href="/account">My events</Link> when you’re logged
          in. Want a co-organizer? Send them this private link — anyone with it can make changes, so don’t post it publicly.
          <div className="copy small" style={{ marginTop: 6 }}><code>{manageUrl}</code></div>
        </div>
      ) : (
        sp.msg && <div className="notice good" role="status">{sp.msg}</div>
      )}

      <nav className="tabs" aria-label="Organizer sections">
        {tabs.map((t) => (
          <Link key={t.id} href={link(t.id)} aria-current={t.id === tab ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && <Overview bundle={bundle} publicUrl={publicUrl} />}
      {tab === 'people' && <People bundle={bundle} />}
      {tab === 'teams' && <Teams bundle={bundle} />}
      {tab === 'games' && <Games bundle={bundle} />}
      {tab === 'results' && <Results bundle={bundle} />}
      {tab === 'settings' && <Settings bundle={bundle} />}
    </>
  );
}

/* ---------------- Overview ---------------- */

function Overview({ bundle, publicUrl }: { bundle: Bundle; publicUrl: string }) {
  const { event, players, teams } = bundle;
  const teamsWithPlayers = activeTeams(bundle);
  const solo = players.filter((p) => p.is_solo);
  const paidPlayers = solo.filter((p) => p.paid).length;
  const registered = teams.filter((t) => t.origin === 'registered');
  const paidTeams = registered.filter((t) => t.paid).length;
  const warnings = rosterWarnings(teamsWithPlayers, players, event.team_size, event.positions);
  const waiting = event.kind === 'pledge' ? 0 : players.filter((p) => p.team_id === null).length;

  return (
    <>
      <div className="card">
        <h2>Share this sign-up link</h2>
        <p className="copy"><a href={publicUrl}>{publicUrl}</a></p>
        <p className="small muted">Post it, text it, or print it. This page is safe to share.</p>
      </div>
      <div className="stats card">
        <div className="stat"><span className="small muted">People signed up</span><b>{players.length}</b></div>
        <div className="stat"><span className="small muted">Teams</span><b>{teamsWithPlayers.length}</b></div>
        {solo.length > 0 && <div className="stat"><span className="small muted">Solo players paid</span><b>{paidPlayers}/{solo.length}</b></div>}
        {registered.length > 0 && <div className="stat"><span className="small muted">Teams paid</span><b>{paidTeams}/{registered.length}</b></div>}
        {event.kind === 'pledge' && <div className="stat"><span className="small muted">Raised</span><b>{money(totalRaised(bundle))}</b></div>}
      </div>
      {(warnings.length > 0 || waiting > 0) && (
        <div className="notice warn">
          <b>Check your teams:</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {waiting > 0 && <li>{waiting} {waiting === 1 ? 'person is' : 'people are'} waiting for a team.</li>}
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
      <div className="card">
        <h2>Next steps</h2>
        <ol className="steps">
          <li><div>Share the sign-up link.</div></li>
          <li><div>Mark people paid on <b>People &amp; payments</b> as money comes in.</div></li>
          <li><div>When sign-ups slow down, tap <b>Balance teams</b> on the Teams tab, then fix anything by hand.</div></li>
          <li>
            <div>
              {event.kind === 'bracket'
                ? 'Make the schedule on the Games tab and enter scores on game day.'
                : event.kind === 'leaderboard'
                  ? 'Enter each team’s score on the Results tab.'
                  : 'Update money raised and distance on the Results tab.'}
            </div>
          </li>
        </ol>
      </div>
    </>
  );
}

/* ---------------- People & payments ---------------- */

function People({ bundle }: { bundle: Bundle }) {
  const { event, players, teams } = bundle;
  const registered = teams.filter((t) => t.origin === 'registered');
  const solo = players.filter((p) => p.is_solo);
  return (
    <>
      {registered.length > 0 && (
        <div className="card">
          <h2>Registered teams</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Team</th><th>Captain</th><th className="num">Players</th><th>Paid</th></tr>
              </thead>
              <tbody>
                {registered.map((t) => (
                  <tr key={t.id}>
                    <td><b>{t.name}</b></td>
                    <td>
                      {t.captain_name}
                      {t.captain_email && <div className="small"><a href={`mailto:${t.captain_email}`}>{t.captain_email}</a></div>}
                    </td>
                    <td className="num">{rosterOf(players, t.id).length}</td>
                    <td>
                      <form action={togglePaid}>
                        <Auth e={event} />
                        <input type="hidden" name="what" value="team" />
                        <input type="hidden" name="id" value={t.id} />
                        <button className={`btn small ${t.paid ? 'secondary' : ''}`}>{t.paid ? '✓ Paid' : 'Mark paid'}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="card">
        <h2>{event.kind === 'pledge' ? 'People' : 'Solo players'}</h2>
        {solo.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Team</th>{event.kind !== 'pledge' && <th className="num">Skill</th>}<th>Paid</th><th></th></tr>
              </thead>
              <tbody>
                {solo.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b>
                      {p.position && <span className="small muted"> · {p.position}</span>}
                      {p.email && <div className="small"><a href={`mailto:${p.email}`}>{p.email}</a></div>}
                      {p.honoring && <div className="small muted">For {p.honoring}</div>}
                    </td>
                    <td className="small">
                      {teams.find((t) => t.id === p.team_id)?.name ?? <span className="pill warn">Waiting</span>}
                      {p.choice && <div className="muted">Picked: {p.choice}</div>}
                    </td>
                    {event.kind !== 'pledge' && <td className="num">{p.skill}</td>}
                    <td>
                      <form action={togglePaid}>
                        <Auth e={event} />
                        <input type="hidden" name="what" value="player" />
                        <input type="hidden" name="id" value={p.id} />
                        <button className={`btn small ${p.paid ? 'secondary' : ''}`}>{p.paid ? '✓ Paid' : 'Mark paid'}</button>
                      </form>
                    </td>
                    <td>
                      <form action={removePlayer}>
                        <Auth e={event} />
                        <input type="hidden" name="player_id" value={p.id} />
                        <button className="btn small danger" aria-label={`Remove ${p.name}`}>Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No solo sign-ups yet.</p>
        )}
      </div>
    </>
  );
}

/* ---------------- Teams ---------------- */

function Teams({ bundle }: { bundle: Bundle }) {
  const { event, players, teams } = bundle;
  const shown = activeTeams(bundle);
  const warnings = rosterWarnings(shown, players, event.team_size, event.positions);
  const waiting = players.filter((p) => p.team_id === null);

  const MoveSelect = ({ playerId, current }: { playerId: number; current: number | null }) => (
    <form action={movePlayer} className="btn-row" style={{ gap: 6 }}>
      <Auth e={event} />
      <input type="hidden" name="player_id" value={playerId} />
      <select name="team_id" defaultValue={current ?? ''} aria-label="Move to team" style={{ minHeight: 34, padding: '4px 8px', width: 'auto' }}>
        <option value="">— No team —</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button className="btn small secondary">Move</button>
    </form>
  );

  return (
    <>
      <div className="card">
        <h2>Balance teams</h2>
        <p className="small muted">
          Places everyone who said “put me where I’m needed.” Key positions like goalies are spread out first, then players by
          skill so teams come out even. People who picked a team, came with a team, or that you moved by hand (🔒) stay put.
        </p>
        <form action={balanceAction}>
          <Auth e={event} />
          <button className="btn">Balance teams</button>
        </form>
      </div>

      {warnings.length > 0 && (
        <div className="notice warn">
          <ul style={{ margin: 0, paddingLeft: 20 }}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      {waiting.length > 0 && (
        <div className="card">
          <h3>Waiting for a team ({waiting.length})</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {waiting.map((p) => (
              <li key={p.id} style={{ padding: '6px 0', borderTop: '1px dashed var(--line)' }}>
                <b>{p.name}</b> <span className="small muted">{p.position} · skill {p.skill}</span>
                <MoveSelect playerId={p.id} current={null} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rosters">
        {shown.map((t) => {
          const roster = rosterOf(players, t.id, event.positions.map((x) => x.name));
          const avg = roster.length ? (roster.reduce((s, p) => s + p.skill, 0) / roster.length).toFixed(1) : '–';
          return (
            <div key={t.id} className="roster">
              <h3>
                {t.name}
                <span className="pill">{roster.length}{event.team_size ? ` / ${event.team_size}` : ''} · avg {avg}</span>
              </h3>
              <ul>
                {roster.map((p) => (
                  <li key={p.id} style={{ display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>
                        {p.locked && p.is_solo ? '🔒 ' : ''}
                        {p.name}
                      </span>
                      <span className="small muted">{p.position}{p.is_solo ? ` · ${p.skill}` : ''}</span>
                    </div>
                    {p.is_solo && (
                      <div className="btn-row" style={{ gap: 6, marginTop: 4 }}>
                        <MoveSelect playerId={p.id} current={p.team_id} />
                        {p.locked && (
                          <form action={unlockPlayer}>
                            <Auth e={event} />
                            <input type="hidden" name="player_id" value={p.id} />
                            <button className="btn small secondary">Unlock</button>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <details style={{ marginTop: 8 }}>
                <summary className="small">Edit team</summary>
                <form action={renameTeam} className="btn-row" style={{ marginTop: 8, gap: 6 }}>
                  <Auth e={event} />
                  <input type="hidden" name="team_id" value={t.id} />
                  <input name="team_name" defaultValue={t.name} aria-label="Team name" style={{ flex: 1, minHeight: 34 }} />
                  <button className="btn small secondary">Rename</button>
                </form>
                <form action={removeTeam} style={{ marginTop: 8 }}>
                  <Auth e={event} />
                  <input type="hidden" name="team_id" value={t.id} />
                  <button className="btn small danger">Remove team</button>
                  <span className="small muted"> Solo players go back to “waiting.”</span>
                </form>
              </details>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Add a team</h3>
        <form action={addTeam} className="btn-row">
          <Auth e={event} />
          <input name="team_name" placeholder="Team name" required maxLength={80} style={{ flex: 1 }} />
          <button className="btn secondary">Add team</button>
        </form>
      </div>
    </>
  );
}

/* ---------------- Games (bracket) ---------------- */

function ScoreForm({ e, gameId, home, away }: { e: EventRow; gameId: number; home: number | null; away: number | null }) {
  return (
    <form action={saveScore} className="score-form">
      <Auth e={e} />
      <input type="hidden" name="game_id" value={gameId} />
      <input name="home_score" inputMode="numeric" defaultValue={home ?? ''} aria-label="Home score" />
      <input name="away_score" inputMode="numeric" defaultValue={away ?? ''} aria-label="Away score" />
      <button className="btn small secondary">Save</button>
    </form>
  );
}

function Games({ bundle }: { bundle: Bundle }) {
  const { event, games, teams } = bundle;
  const pool = groupRounds(games, 'pool');
  const playoff = groupRounds(games, 'playoff');
  const next = nextPlayoffRound(games);
  const done = champion(games) !== null;
  const teamCount = activeTeams(bundle).length;

  return (
    <>
      <ChampionBanner bundle={bundle} />
      <div className="card">
        <h2>Schedule</h2>
        <p className="small muted">
          Each team gets {event.games_per_team} game{event.games_per_team === 1 ? '' : 's'} against different opponents
          {teamCount % 2 === 1 ? ' (with an odd number of teams, one team may get one fewer)' : ''}. Making a new schedule
          erases all games and scores.
        </p>
        <div className="btn-row">
          <form action={makeSchedule}>
            <Auth e={event} />
            <button className={`btn ${pool.length ? 'secondary' : ''}`}>{pool.length ? 'Remake schedule' : 'Make schedule'}</button>
          </form>
          {pool.length > 0 && event.playoff_teams > 1 && (
            <form action={startPlayoffs}>
              <Auth e={event} />
              <button className={`btn ${playoff.length ? 'secondary' : 'navy'}`}>{playoff.length ? 'Restart playoffs' : 'Start playoffs'}</button>
            </form>
          )}
          {playoff.length > 0 && next && !done && (
            <form action={advancePlayoffs}>
              <Auth e={event} />
              <button className="btn navy">Next playoff round</button>
            </form>
          )}
        </div>
      </div>

      {[...playoff].reverse().map(([round, gs]) => (
        <div key={`p${round}`} className="card">
          <h3>{playoffRoundLabel(games, round)}</h3>
          {gs.map((g) => (
            <GameLine key={g.id} game={g} teams={teams}>
              <ScoreForm e={event} gameId={g.id} home={g.home_score} away={g.away_score} />
            </GameLine>
          ))}
        </div>
      ))}

      {pool.length > 0 && (
        <div className="card">
          <h2>Standings</h2>
          <StandingsTable bundle={bundle} />
        </div>
      )}

      {pool.map(([round, gs]) => (
        <div key={round} className="card">
          <h3>Round {round}</h3>
          {gs.map((g) => (
            <GameLine key={g.id} game={g} teams={teams}>
              <ScoreForm e={event} gameId={g.id} home={g.home_score} away={g.away_score} />
            </GameLine>
          ))}
        </div>
      ))}
    </>
  );
}

/* ---------------- Results (leaderboard & pledge) ---------------- */

function Results({ bundle }: { bundle: Bundle }) {
  const { event, players } = bundle;
  const teams = activeTeams(bundle);

  if (event.kind === 'leaderboard') {
    return (
      <>
        <div className="card">
          <h2>Enter scores</h2>
          {teams.length ? (
            teams.map((t) => (
              <form key={t.id} action={saveTeamResult} className="btn-row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                <Auth e={event} />
                <input type="hidden" name="team_id" value={t.id} />
                <b style={{ flex: 1, minWidth: 140 }}>{t.name}</b>
                <input name="score" inputMode="decimal" defaultValue={t.score ?? ''} aria-label={`${t.name} ${event.score_label}`} placeholder={event.score_label} style={{ width: 140 }} />
                <button className="btn small secondary">Save</button>
              </form>
            ))
          ) : (
            <p className="muted">No teams yet.</p>
          )}
        </div>
        <div className="card">
          <h2>Leaderboard</h2>
          <Leaderboard bundle={bundle} />
        </div>
      </>
    );
  }

  // Pledge
  return (
    <>
      <div className="stats card">
        <div className="stat"><span className="small muted">Raised so far</span><b>{money(totalRaised(bundle))}</b></div>
      </div>
      <div className="card">
        <h2>People</h2>
        <p className="small muted">Enter what each person has raised and how far they went. Totals update on the public page.</p>
        {players.length ? (
          players.map((p) => (
            <form key={p.id} action={savePlayerResult} className="btn-row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <Auth e={event} />
              <input type="hidden" name="player_id" value={p.id} />
              <b style={{ flex: 1, minWidth: 140 }}>
                {p.name}
                {p.goal > 0 && <span className="small muted"> · goal {money(p.goal)}</span>}
              </b>
              <input name="raised" inputMode="decimal" defaultValue={p.raised ? (p.raised / 100).toString() : ''} placeholder="$ raised" aria-label={`${p.name} raised`} style={{ width: 110 }} />
              <input name="distance" inputMode="decimal" defaultValue={p.distance ?? ''} placeholder={event.pledge_unit} aria-label={`${p.name} ${event.pledge_unit}`} style={{ width: 90 }} />
              <button className="btn small secondary">Save</button>
            </form>
          ))
        ) : (
          <p className="muted">No one has signed up yet.</p>
        )}
      </div>
      {teams.length > 0 && (
        <div className="card">
          <h2>Team extras</h2>
          <p className="small muted">Money given to a team as a whole (not to one person). Team totals add this to members’ totals.</p>
          {teams.map((t) => (
            <form key={t.id} action={saveTeamResult} className="btn-row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <Auth e={event} />
              <input type="hidden" name="team_id" value={t.id} />
              <b style={{ flex: 1, minWidth: 140 }}>{t.name} <span className="small muted">· total {money(teamRaised(bundle, t))}</span></b>
              <input name="raised" inputMode="decimal" defaultValue={t.raised ? (t.raised / 100).toString() : ''} placeholder="$ to team" aria-label={`${t.name} team amount`} style={{ width: 120 }} />
              <button className="btn small secondary">Save</button>
            </form>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Settings ---------------- */

function Settings({ bundle }: { bundle: Bundle }) {
  const { event } = bundle;
  const dollars = (c: number) => (c ? (c / 100).toString() : '');
  return (
    <>
      <div className="card">
        <h2>Sign-ups</h2>
        <form action={toggleSignups} className="btn-row">
          <Auth e={event} />
          <span>Sign-ups are <b>{event.signups_open ? 'open' : 'closed'}</b>.</span>
          <button className="btn secondary small">{event.signups_open ? 'Close sign-ups' : 'Reopen sign-ups'}</button>
        </form>
      </div>
      <div className="card">
        <h2>Event details</h2>
        <form action={updateSettings} className="stack">
          <Auth e={event} />
          <label>Event name<input name="name" defaultValue={event.name} maxLength={120} required /></label>
          <label>Raising money for<input name="charity" defaultValue={event.charity} maxLength={200} /></label>
          <div className="row-2">
            <label>Date<input name="event_date" defaultValue={event.event_date} maxLength={100} /></label>
            <label>Location<input name="location" defaultValue={event.location} maxLength={200} /></label>
          </div>
          <label>Organizer email<input name="contact_email" type="email" defaultValue={event.contact_email} maxLength={200} /></label>
          <label>Description<textarea name="description" defaultValue={event.description} maxLength={2000} /></label>
          <div className="row-2">
            <label>Fee per team ($)<input name="team_fee" inputMode="decimal" defaultValue={dollars(event.team_fee)} /></label>
            <label>Fee per player ($)<input name="solo_fee" inputMode="decimal" defaultValue={dollars(event.solo_fee)} /></label>
          </div>
          <label>Payment link<input name="payment_url" defaultValue={event.payment_url} /></label>
          <label>Max players per team <span className="hint">0 = no limit</span><input name="team_size" inputMode="numeric" defaultValue={event.team_size} /></label>
          {event.kind === 'bracket' && (
            <div className="row-2">
              <label>Guaranteed games per team<input name="games_per_team" inputMode="numeric" defaultValue={event.games_per_team} /></label>
              <label>Teams in the playoffs<input name="playoff_teams" inputMode="numeric" defaultValue={event.playoff_teams} /></label>
            </div>
          )}
          {event.kind === 'leaderboard' && (
            <div className="row-2">
              <label>What gets scored<input name="score_label" defaultValue={event.score_label} /></label>
              <label>
                Who wins
                <select name="score_order" defaultValue={event.score_order}>
                  <option value="high">Highest score wins</option>
                  <option value="low">Lowest score wins</option>
                </select>
              </label>
            </div>
          )}
          {event.kind === 'pledge' && <label>Distance unit<input name="pledge_unit" defaultValue={event.pledge_unit} /></label>}
          <button className="btn">Save settings</button>
        </form>
      </div>
    </>
  );
}
