import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canManage, sameKey } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getBundle, getEventBySlug } from '@/lib/data';
import {
  addAuctionItem,
  addCoOrganizer,
  auctionItemAction,
  removePledge,
  togglePledgePaid,
  addTeam,
  copyEvent,
  removeCoOrganizer,
  advancePlayoffs,
  balanceAction,
  deleteEvent,
  makeSchedule,
  savePersonMoney,
  saveTeamMoney,
  messagePlayers,
  toggleCheckIn,
  saveGameDetails,
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
import { mailConfigured } from '@/lib/mail';
import { nextBid, pledgeOwed, pledgeTotals } from '@/lib/pledges';
import ConfirmButton from '@/app/ConfirmButton';
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
  const admins = await query<{ email: string; name: string | null }>(
    `SELECT a.email, u.name FROM event_admins a LEFT JOIN users u ON u.id = a.user_id WHERE a.event_id = $1 ORDER BY a.created_at`,
    [event.id],
  );

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
    { id: 'money', label: 'Fundraising' },
    { id: 'auction', label: 'Auction' },
    { id: 'checkin', label: 'Check-in' },
    { id: 'message', label: 'Message' },
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
      {tab === 'settings' && <Settings bundle={bundle} admins={admins} />}
      {tab === 'checkin' && <CheckIn bundle={bundle} q={sp.q ?? ''} />}
      {tab === 'money' && <Fundraising bundle={bundle} />}
      {tab === 'auction' && <Auction bundle={bundle} />}
      {tab === 'message' && <Message bundle={bundle} />}
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
        <p className="small"><Link href={`${publicUrl}/tv`} target="_blank">Open the TV scoreboard</Link> — show it on a big screen at the event.</p>
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
      {event.jersey_sizes && (
        <div className="card">
          <h2>Jersey order</h2>
          <div className="btn-row">
            {[...event.jersey_sizes.split(',').map((x) => x.trim()).filter(Boolean), ''].map((size) => {
              const n = players.filter((p) => p.jersey_size === size).length;
              return n || size ? <span key={size || 'none'} className="pill">{size || 'No size yet'}: {n}</span> : null;
            })}
          </div>
        </div>
      )}
      <div className="card">
        <h2>Download</h2>
        <p className="small muted">Everyone’s name, email, team, payment, check-in, and waiver status as a spreadsheet (opens in Excel or Google Sheets).</p>
        <a className="btn secondary" href={`/manage/${event.slug}/export?key=${event.admin_key}`}>Download roster (.csv)</a>
      </div>
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
                      {event.waiver_text && (
                        <div className="small">{p.waiver_agreed_at ? <span className="pill good">Waiver ✓</span> : <span className="pill warn">No waiver</span>}</div>
                      )}
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
                        <ConfirmButton className="btn small danger" message={`Remove ${p.name} from this event?`}>Remove</ConfirmButton>
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
                  <ConfirmButton className="btn small danger" message={`Remove ${t.name}? Teammates who registered with it are removed too.`}>Remove team</ConfirmButton>
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

function GameDetails({ e, game }: { e: EventRow; game: Bundle['games'][number] }) {
  return (
    <details style={{ margin: '0 0 8px' }}>
      <summary className="small">Time, rink, and stream</summary>
      <form action={saveGameDetails} className="row-2" style={{ marginTop: 8 }}>
        <Auth e={e} />
        <input type="hidden" name="game_id" value={game.id} />
        <label className="small">Start time<input name="starts_at" defaultValue={game.starts_at} placeholder="Sat 9:00 AM" /></label>
        <label className="small">Rink / field<input name="rink" defaultValue={game.rink} placeholder="Rink 2" /></label>
        <label className="small">Stream link for this game<input name="stream_url" defaultValue={game.stream_url} placeholder="https://youtube.com/live/..." /></label>
        <div style={{ alignSelf: 'end' }}><button className="btn small secondary">Save details</button></div>
      </form>
    </details>
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
      {pool.length > 0 && (
        <div className="card">
          <h2>Game day</h2>
          <div className="btn-row">
            <Link className="btn" href={`/manage/${event.slug}/score?key=${event.admin_key}`}>Open scorekeeper (big buttons)</Link>
            <Link className="btn secondary" href={`/e/${event.slug}/tv`} target="_blank">TV scoreboard</Link>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Open the TV scoreboard on a laptop hooked to a TV at the rink. It updates on its own.
          </p>
        </div>
      )}
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
            {pool.length ? (
              <ConfirmButton className="btn secondary" message="Remake the schedule? This erases ALL games and scores, including playoffs.">Remake schedule</ConfirmButton>
            ) : (
              <button className="btn">Make schedule</button>
            )}
          </form>
          {pool.length > 0 && event.playoff_teams > 1 && (
            <form action={startPlayoffs}>
              <Auth e={event} />
              {playoff.length ? (
                <ConfirmButton className="btn secondary" message="Restart the playoffs? This erases all playoff games and scores.">Restart playoffs</ConfirmButton>
              ) : (
                <ConfirmButton className="btn navy" message="Start playoffs now? Seeds come from the current standings.">Start playoffs</ConfirmButton>
              )}
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
            <div key={g.id}>
              <GameLine game={g} teams={teams}>
                <ScoreForm e={event} gameId={g.id} home={g.home_score} away={g.away_score} />
              </GameLine>
              <GameDetails e={event} game={g} />
            </div>
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
            <div key={g.id}>
              <GameLine game={g} teams={teams}>
                <ScoreForm e={event} gameId={g.id} home={g.home_score} away={g.away_score} />
              </GameLine>
              <GameDetails e={event} game={g} />
            </div>
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

function Settings({ bundle, admins }: { bundle: Bundle; admins: { email: string; name: string | null }[] }) {
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
            <label>Date (as shown)<input name="event_date" defaultValue={event.event_date} maxLength={100} /></label>
            <label>First day <span className="hint">For “Add to calendar.”</span><input name="start_at" type="date" defaultValue={event.start_at} /></label>
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
          <label>
            Live stream link <span className="hint">YouTube, Facebook Live, or Twitch. YouTube and Twitch play right on the page.</span>
            <input name="stream_url" defaultValue={event.stream_url} placeholder="https://youtube.com/live/..." />
          </label>
          <label>
            Fundraising goal ($) <span className="hint">Shows a progress bar on the public page.</span>
            <input name="fundraising_goal" inputMode="decimal" defaultValue={dollars(event.fundraising_goal)} />
          </label>
          <label>
            Sponsors <span className="hint">One per line: Name, or Name | https://their-site.com</span>
            <textarea name="sponsors" defaultValue={event.sponsors} rows={4} />
          </label>
          <input type="hidden" name="pledges_form" value="1" />
          {event.kind === 'bracket' && (
            <label className="check">
              <input type="checkbox" name="pledges_open" defaultChecked={event.pledges_open} />
              Let fans pledge money per goal scored
            </label>
          )}
          <label>
            Jersey sizes <span className="hint">Comma-separated, like: YS, YM, S, M, L, XL, 2XL. Leave blank to skip jerseys.</span>
            <input name="jersey_sizes" defaultValue={event.jersey_sizes} />
          </label>
          <label>
            Waiver <span className="hint">If filled in, everyone must check “I agree” to sign up. Have a professional review the wording.</span>
            <textarea name="waiver_text" defaultValue={event.waiver_text} rows={6} placeholder="I understand hockey involves risk of injury... I agree this event may be photographed and live streamed..." />
          </label>
          <button className="btn">Save settings</button>
        </form>
      </div>
      <div className="card">
        <h2>Co-organizers</h2>
        <p className="small muted">People who can manage this event from their own account. They need to sign up first.</p>
        {admins.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
            {admins.map((a) => (
              <li key={a.email} className="btn-row" style={{ justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                <span>{a.name ? <b>{a.name}</b> : null} <span className="small muted">{a.email}</span></span>
                <form action={removeCoOrganizer}>
                  <Auth e={event} />
                  <input type="hidden" name="email" value={a.email} />
                  <ConfirmButton className="btn small danger" message={`Remove ${a.email} as a co-organizer?`}>Remove</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addCoOrganizer} className="btn-row">
          <Auth e={event} />
          <input name="email" type="email" placeholder="their account email" required style={{ flex: 1, minWidth: 200 }} aria-label="Co-organizer email" />
          <button className="btn secondary">Add co-organizer</button>
        </form>
      </div>
      <div className="card">
        <h2>Copy for next year</h2>
        <p className="small muted">Makes a new event with the same settings, team list, waiver, sponsors, volunteer shifts, awards, and co-organizers — but no sign-ups or scores.</p>
        <form action={copyEvent}>
          <Auth e={event} />
          <button className="btn secondary">Copy this event</button>
        </form>
      </div>
      <div className="card">
        <h2>Delete this event</h2>
        <p className="small muted">This permanently removes the event, everyone’s sign-ups, teams, and scores. It can’t be undone.</p>
        <form action={deleteEvent} className="stack">
          <Auth e={event} />
          <label>
            Type the event name to confirm: <b>{event.name}</b>
            <input name="confirm_name" autoComplete="off" />
          </label>
          <ConfirmButton className="btn danger" message="Delete this event forever?">Delete event</ConfirmButton>
        </form>
      </div>
    </>
  );
}

/* ---------------- Check-in ---------------- */

function CheckIn({ bundle, q }: { bundle: Bundle; q: string }) {
  const { event, players, teams } = bundle;
  const needle = q.trim().toLowerCase();
  const list = players
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || (teams.find((t) => t.id === p.team_id)?.name ?? '').toLowerCase().includes(needle))
    .sort((a, b) => Number(a.checked_in) - Number(b.checked_in) || a.name.localeCompare(b.name));
  const done = players.filter((p) => p.checked_in).length;
  return (
    <>
      <div className="stats card">
        <div className="stat"><span className="small muted">Checked in</span><b>{done} / {players.length}</b></div>
      </div>
      <div className="card">
        <form method="get" className="btn-row">
          <input type="hidden" name="key" value={event.admin_key} />
          <input type="hidden" name="tab" value="checkin" />
          <input name="q" defaultValue={q} placeholder="Search name or team" aria-label="Search players" style={{ flex: 1, minWidth: 180 }} />
          <button className="btn secondary">Search</button>
        </form>
      </div>
      <div className="card">
        {list.length ? (
          list.map((p) => {
            const t = teams.find((x) => x.id === p.team_id);
            const paid = p.is_solo ? p.paid : Boolean(t?.paid);
            return (
              <form key={p.id} action={toggleCheckIn} className="btn-row" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                <Auth e={event} />
                <input type="hidden" name="player_id" value={p.id} />
                <input type="hidden" name="q" value={q} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <b>{p.name}</b>
                  <div className="small muted">
                    {t?.name ?? 'No team'}
                    {' · '}
                    {paid ? <span style={{ color: 'var(--good)' }}>Paid</span> : <span style={{ color: 'var(--warn)' }}>Not paid</span>}
                    {event.waiver_text && <> · {p.waiver_agreed_at ? 'Waiver ✓' : <span style={{ color: 'var(--warn)' }}>No waiver</span>}</>}
                  </div>
                </div>
                <button className={`btn ${p.checked_in ? 'secondary' : ''}`} style={{ minWidth: 130 }}>
                  {p.checked_in ? '✓ Checked in' : 'Check in'}
                </button>
              </form>
            );
          })
        ) : (
          <p className="muted">No one matches “{q}”.</p>
        )}
      </div>
    </>
  );
}

/* ---------------- Message ---------------- */

function Message({ bundle }: { bundle: Bundle }) {
  const { event, players, teams } = bundle;
  const emails = [...new Set([...players.map((p) => p.email), ...teams.map((t) => t.captain_email)].filter((e) => e.includes('@')))];
  const ready = mailConfigured();
  return (
    <>
      <div className="card">
        <h2>Message everyone</h2>
        {ready ? (
          <form action={messagePlayers} className="stack">
            <Auth e={event} />
            <label>
              Send to
              <select name="who" defaultValue="all">
                <option value="all">Everyone with an email ({emails.length})</option>
                <option value="unpaid">People not marked paid</option>
                <option value="captains">Team captains only</option>
              </select>
            </label>
            <label>Subject<input name="subject" required maxLength={150} placeholder="Schedule is posted!" /></label>
            <label>Message<textarea name="body" required maxLength={5000} rows={6} /></label>
            <p className="small muted">Replies go to {event.contact_email || 'no one — add an organizer email in Settings'}.</p>
            <button className="btn">Send message</button>
          </form>
        ) : (
          <p className="muted small">
            Sending from the app isn’t switched on yet. For now, copy the emails below into your own email (use BCC so people
            don’t see each other’s addresses).
          </p>
        )}
      </div>
      <div className="card">
        <h3>Copy emails</h3>
        <textarea readOnly value={emails.join(', ')} rows={4} aria-label="All emails" />
        {emails.length > 0 && (
          <a className="btn secondary small" style={{ marginTop: 8 }} href={`mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(event.name)}`}>
            Open in my email app (BCC)
          </a>
        )}
      </div>
    </>
  );
}

/* ---------------- Fundraising ---------------- */

function Fundraising({ bundle }: { bundle: Bundle }) {
  const { event, players } = bundle;
  const teams = activeTeams(bundle);
  const total = totalRaised(bundle);
  const goal = event.fundraising_goal;
  const dollars = (c: number) => (c ? (c / 100).toString() : '');
  const ranked = teams.map((t) => ({ t, sum: teamRaised(bundle, t) })).sort((a, b) => b.sum - a.sum);
  return (
    <>
      <div className="card">
        <h2>Event total</h2>
        <p style={{ margin: 0 }}>
          <b style={{ fontSize: '1.6rem' }}>{money(total)}</b>
          {goal > 0 ? <> raised of {money(goal)} goal</> : <> raised</>}
        </p>
        {goal > 0 && (
          <div className="thermo" aria-hidden="true"><span style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} /></div>
        )}
        <p className="small muted">
          Total = money given to teams + money each person raised. Entry fees aren’t counted unless you add them here. Set the
          event goal on the Settings tab.
        </p>
      </div>

      <div className="card">
        <h2>Teams</h2>
        <p className="small muted">
          Each team has its own shareable page. “Given to team” is money given to the team as a whole; the team total adds its
          members’ amounts. Teams and people can add their own pay links (like a personal Zeffy page) — their page’s Give
          button uses it, otherwise your event payment link. Money raised on those pages isn’t counted automatically; enter it
          here.
        </p>
        {ranked.map(({ t, sum }, i) => (
          <form key={t.id} action={saveTeamMoney} className="btn-row" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <Auth e={event} />
            <input type="hidden" name="team_id" value={t.id} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <b>{i + 1}. {t.name}</b>
              <div className="small muted">
                Total {money(sum)}{t.goal > 0 ? ` of ${money(t.goal)}` : ''} ·{' '}
                <Link href={`/e/${event.slug}/t/${t.id}`} target="_blank">Team page</Link>
              </div>
            </div>
            <input name="goal" inputMode="decimal" defaultValue={dollars(t.goal)} placeholder="Goal $" aria-label={`${t.name} goal`} style={{ width: 100 }} />
            <input name="raised" inputMode="decimal" defaultValue={dollars(t.raised)} placeholder="Given $" aria-label={`${t.name} given to team`} style={{ width: 100 }} />
            <input name="pay_url" defaultValue={t.pay_url} placeholder="Team pay link" aria-label={`${t.name} pay link`} style={{ width: 200 }} />
            <button className="btn small secondary">Save</button>
          </form>
        ))}
        {!ranked.length && <p className="muted">No teams yet.</p>}
      </div>

      <Pledges bundle={bundle} />
      <div className="card">
        <h2>People</h2>
        {players.map((p) => (
          <form key={p.id} action={savePersonMoney} className="btn-row" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <Auth e={event} />
            <input type="hidden" name="player_id" value={p.id} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <b>{p.name}</b>
              <div className="small muted">
                {money(p.raised)}{p.goal > 0 ? ` of ${money(p.goal)}` : ''} ·{' '}
                <Link href={`/e/${event.slug}/p/${p.id}`} target="_blank">Personal page</Link>
              </div>
            </div>
            <input name="goal" inputMode="decimal" defaultValue={dollars(p.goal)} placeholder="Goal $" aria-label={`${p.name} goal`} style={{ width: 100 }} />
            <input name="raised" inputMode="decimal" defaultValue={dollars(p.raised)} placeholder="Raised $" aria-label={`${p.name} raised`} style={{ width: 100 }} />
            <input name="pay_url" defaultValue={p.pay_url} placeholder="Personal pay link" aria-label={`${p.name} pay link`} style={{ width: 200 }} />
            <button className="btn small secondary">Save</button>
          </form>
        ))}
        {!players.length && <p className="muted">No one has signed up yet.</p>}
      </div>
    </>
  );
}

function Pledges({ bundle }: { bundle: Bundle }) {
  const { event, pledges, teams } = bundle;
  if (!pledges.length) return null;
  const { owed, paid, goals } = pledgeTotals(bundle);
  return (
    <div className="card">
      <h2>Goal pledges</h2>
      <p className="small muted">
        {money(owed)} pledged so far · {money(paid)} paid. Amounts grow as goals are scored. After the tournament, message
        pledgers their totals (Message tab → copy emails) and mark them paid here.
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Team</th><th className="num">Per goal</th><th className="num">Owes now</th><th></th><th></th></tr></thead>
          <tbody>
            {pledges.map((p) => (
              <tr key={p.id}>
                <td>{p.name}{p.email && <div className="small"><a href={`mailto:${p.email}`}>{p.email}</a></div>}</td>
                <td className="small">{p.team_id ? teams.find((t) => t.id === p.team_id)?.name : 'All teams'}</td>
                <td className="num">{money(p.per_goal)}{p.max_total > 0 && <div className="small muted">cap {money(p.max_total)}</div>}</td>
                <td className="num"><b>{money(pledgeOwed(p, goals))}</b></td>
                <td>
                  <form action={togglePledgePaid}>
                    <Auth e={event} />
                    <input type="hidden" name="id" value={p.id} />
                    <button className={`btn small ${p.paid ? 'secondary' : ''}`}>{p.paid ? '✓ Paid' : 'Mark paid'}</button>
                  </form>
                </td>
                <td>
                  <form action={removePledge}>
                    <Auth e={event} />
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton className="btn small danger" message={`Remove ${p.name}’s pledge?`}>Remove</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Auction ---------------- */

function Auction({ bundle }: { bundle: Bundle }) {
  const { event, auction } = bundle;
  const sold = auction.filter((i) => i.high_bid);
  return (
    <>
      <div className="notice info small">
        ⚠️ Auctions can have tax and reporting rules (for example, receipts for amounts above an item’s value). Check with a
        professional before you run one.
      </div>
      <div className="card">
        <h2>Add an item</h2>
        <form action={addAuctionItem} className="stack">
          <Auth e={event} />
          <label>Item<input name="title" required maxLength={120} placeholder="Signed jersey" /></label>
          <label>Description<textarea name="description" maxLength={1000} rows={3} /></label>
          <div className="row-2">
            <label>Donated by<input name="donor" maxLength={120} /></label>
            <label>Starting bid ($)<input name="start_bid" inputMode="decimal" placeholder="25" /></label>
          </div>
          <label>Bid steps ($) <span className="hint">Each new bid must beat the last by this much.</span><input name="increment" inputMode="decimal" placeholder="5" /></label>
          <button className="btn">Add item</button>
        </form>
      </div>
      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Items ({auction.length})</h2>
          <div className="btn-row">
            <Link className="btn small secondary" href={`/e/${event.slug}/auction`} target="_blank">Public auction page</Link>
            {auction.some((i) => !i.closed) && (
              <form action={auctionItemAction}>
                <Auth e={event} />
                <input type="hidden" name="item_id" value="0" />
                <input type="hidden" name="op" value="closeall" />
                <ConfirmButton className="btn small" message="Close bidding on every item now?">Close all bidding</ConfirmButton>
              </form>
            )}
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          {sold.length} with bids · {money(sold.reduce((s, i) => s + (i.high_bid ?? 0), 0))} in high bids. Paid items count
          toward the event total.
        </p>
        {auction.map((i) => (
          <div key={i.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <b>{i.title}</b> {i.closed && <span className="pill">Closed</span>}
                <div className="small muted">
                  {i.high_bid ? <>High bid {money(i.high_bid)} by {i.high_name} {i.high_email && <a href={`mailto:${i.high_email}`}>{i.high_email}</a>}</> : <>No bids · next {money(nextBid(i))}</>}
                </div>
              </div>
              <div className="btn-row">
                {(['close', 'paid', 'delete'] as const).map((op) => (
                  <form key={op} action={auctionItemAction}>
                    <Auth e={event} />
                    <input type="hidden" name="item_id" value={i.id} />
                    <input type="hidden" name="op" value={op} />
                    {op === 'delete' ? (
                      <ConfirmButton className="btn small danger" message={`Delete “${i.title}” and its bids?`}>Delete</ConfirmButton>
                    ) : (
                      <button className={`btn small ${op === 'paid' && i.paid ? '' : 'secondary'}`}>
                        {op === 'close' ? (i.closed ? 'Reopen' : 'Close bidding') : i.paid ? '✓ Paid' : 'Mark paid'}
                      </button>
                    )}
                  </form>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
