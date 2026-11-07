import Link from 'next/link';
import { champion, roundName, standings, winnerOf } from '@/lib/bracket';
import { money } from '@/lib/format';
import { pledgeTotals } from '@/lib/pledges';
import type { Bundle, Game, Player, Team } from '@/lib/types';

export function teamName(teams: Team[], id: number | null): string {
  return teams.find((t) => t.id === id)?.name ?? 'TBD';
}

/** Roster sorted by the event's position order (e.g. Goalie, Defense, Forward), then name. */
export function rosterOf(players: Player[], teamId: number, positionOrder: string[] = []): Player[] {
  const idx = (p: Player) => {
    const i = positionOrder.findIndex((n) => n.toLowerCase() === p.position.toLowerCase());
    return i === -1 ? positionOrder.length : i;
  };
  return players.filter((p) => p.team_id === teamId).sort((a, b) => idx(a) - idx(b) || a.name.localeCompare(b.name));
}

/** Teams that have players, plus organizer-set teams (which may still be empty). */
export function activeTeams(b: Bundle): Team[] {
  return b.teams.filter((t) => t.origin === 'set' || b.players.some((p) => p.team_id === t.id));
}

export function Rosters({ bundle }: { bundle: Bundle }) {
  const teams = activeTeams(bundle);
  const unplaced = bundle.players.filter((p) => p.team_id === null);
  if (!teams.length && !unplaced.length) return <p className="muted">No one has signed up yet.</p>;
  return (
    <div className="rosters">
      {teams.map((t) => {
        const roster = rosterOf(bundle.players, t.id, bundle.event.positions.map((x) => x.name));
        return (
          <div key={t.id} className="roster">
            <h3>
              {t.name}
              <span className="pill">{roster.length}{bundle.event.team_size ? ` / ${bundle.event.team_size}` : ''}</span>
            </h3>
            {roster.length ? (
              <ul>
                {roster.map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.name}
                      {p.honoring && <span className="small muted"> · for {p.honoring}</span>}
                    </span>
                    {p.position && <span className="small muted">{p.position}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Open spots</p>
            )}
          </div>
        );
      })}
      {unplaced.length > 0 && (
        <div className="roster">
          <h3>
            {bundle.event.kind === 'pledge' ? 'Going solo' : 'Waiting for a team'}{' '}
            <span className={`pill${bundle.event.kind === 'pledge' ? '' : ' warn'}`}>{unplaced.length}</span>
          </h3>
          <ul>
            {unplaced.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                {p.position && <span className="small muted">{p.position}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function StandingsTable({ bundle }: { bundle: Bundle }) {
  const pool = bundle.games.filter((g) => g.stage === 'pool');
  if (!pool.length) return null;
  const ids = [...new Set(pool.flatMap((g) => [g.home_team_id!, g.away_team_id!]))];
  const rows = standings(ids, bundle.games);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th className="num">GP</th>
            <th className="num">W</th>
            <th className="num">L</th>
            <th className="num">T</th>
            <th className="num">Pts</th>
            <th className="num">+/−</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId}>
              <td>{i + 1}</td>
              <td>{teamName(bundle.teams, r.teamId)}</td>
              <td className="num">{r.played}</td>
              <td className="num">{r.wins}</td>
              <td className="num">{r.losses}</td>
              <td className="num">{r.ties}</td>
              <td className="num"><b>{r.points}</b></td>
              <td className="num">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">2 points for a win, 1 for a tie. Ties broken by goal difference, then goals scored.</p>
    </div>
  );
}

export function GameLine({ game, teams, children }: { game: Game; teams: Team[]; children?: React.ReactNode }) {
  const w = winnerOf(game);
  const hasScore = game.home_score !== null && game.away_score !== null;
  const live = game.status === 'live';
  return (
    <div className="game">
      <span className={`team${w === game.home_team_id ? ' winner' : ''}`}>{teamName(teams, game.home_team_id)}</span>
      {children ?? (
        <span className="score">
          {hasScore && game.status !== 'scheduled' ? `${game.home_score} – ${game.away_score}` : 'vs'}
        </span>
      )}
      <span className={`team right${w === game.away_team_id ? ' winner' : ''}`}>{teamName(teams, game.away_team_id)}</span>
      {(live || game.starts_at || game.rink || game.stream_url || game.status === 'final') && (
        <span className="game-meta">
          {live && <span className="pill live"><span className="live-dot" aria-hidden="true" />LIVE</span>}
          {game.status === 'final' && <span className="pill">Final</span>}
          {game.starts_at && <span>🕒 {game.starts_at}</span>}
          {game.rink && <span>📍 {game.rink}</span>}
          {game.stream_url && (
            <a href={game.stream_url} target="_blank" rel="noopener noreferrer">
              Watch this game
            </a>
          )}
        </span>
      )}
    </div>
  );
}

export function groupRounds(games: Game[], stage: 'pool' | 'playoff'): [number, Game[]][] {
  const map = new Map<number, Game[]>();
  for (const g of games.filter((x) => x.stage === stage)) {
    if (!map.has(g.round)) map.set(g.round, []);
    map.get(g.round)!.push(g);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export function playoffRoundLabel(games: Game[], round: number): string {
  const first = games.filter((g) => g.stage === 'playoff' && g.round === 1).length;
  const total = first ? Math.log2(first) + 1 : round;
  return roundName(round, total);
}

export function ChampionBanner({ bundle }: { bundle: Bundle }) {
  const c = champion(bundle.games);
  return c ? <div className="champion">🏆 Champions: {teamName(bundle.teams, c)}</div> : null;
}

export function Schedule({ bundle }: { bundle: Bundle }) {
  const pool = groupRounds(bundle.games, 'pool');
  const playoff = groupRounds(bundle.games, 'playoff');
  if (!pool.length && !playoff.length) return <p className="muted">The schedule will show here once it’s set.</p>;
  return (
    <>
      {playoff.length > 0 &&
        [...playoff].reverse().map(([round, games]) => (
          <div key={`p${round}`} className="card">
            <h3>{playoffRoundLabel(bundle.games, round)}</h3>
            {games.map((g) => <GameLine key={g.id} game={g} teams={bundle.teams} />)}
          </div>
        ))}
      {pool.map(([round, games]) => (
        <div key={round} className="card">
          <h3>Round {round}</h3>
          {games.map((g) => <GameLine key={g.id} game={g} teams={bundle.teams} />)}
        </div>
      ))}
    </>
  );
}

export function rankTeams(bundle: Bundle): Team[] {
  const dir = bundle.event.score_order === 'low' ? 1 : -1;
  return activeTeams(bundle)
    .filter((t) => t.score !== null)
    .sort((a, b) => dir * ((a.score ?? 0) - (b.score ?? 0)) || a.name.localeCompare(b.name));
}

export function Leaderboard({ bundle }: { bundle: Bundle }) {
  const ranked = rankTeams(bundle);
  const unscored = activeTeams(bundle).filter((t) => t.score === null);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th className="num">{bundle.event.score_label}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((t, i) => (
            <tr key={t.id} className={i === 0 ? 'top' : undefined}>
              <td>{i === 0 ? '🏆' : i + 1}</td>
              <td>{t.name}</td>
              <td className="num">{t.score}</td>
            </tr>
          ))}
          {unscored.map((t) => (
            <tr key={t.id}>
              <td>–</td>
              <td>{t.name}</td>
              <td className="num muted">—</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">{bundle.event.score_order === 'low' ? 'Lowest' : 'Highest'} {bundle.event.score_label.toLowerCase()} wins.</p>
    </div>
  );
}

export function teamRaised(bundle: Bundle, t: Team): number {
  return t.raised + rosterOf(bundle.players, t.id).reduce((s, p) => s + p.raised, 0);
}

/** Everything marked as raised: team + personal money, paid goal pledges, and paid auction items. */
export function totalRaised(bundle: Bundle): number {
  const people = bundle.teams.reduce((s, t) => s + t.raised, 0) + bundle.players.reduce((s, p) => s + p.raised, 0);
  const pledges = pledgeTotals(bundle).paid;
  const auction = bundle.auction.filter((i) => i.paid && i.high_bid).reduce((s, i) => s + (i.high_bid ?? 0), 0);
  return people + pledges + auction + (bundle.onlineGeneral ?? 0);
}

export function PledgeBoard({ bundle }: { bundle: Bundle }) {
  const people = [...bundle.players].sort((a, b) => b.raised - a.raised || a.name.localeCompare(b.name));
  const teams = activeTeams(bundle)
    .map((t) => ({ t, raised: teamRaised(bundle, t) }))
    .sort((a, b) => b.raised - a.raised);
  const miles = bundle.players.reduce((s, p) => s + (p.distance ?? 0), 0);
  return (
    <>
      <div className="stats card">
        <div className="stat"><span className="muted small">Raised so far</span><b>{money(totalRaised(bundle))}</b></div>
        <div className="stat"><span className="muted small">People</span><b>{bundle.players.length}</b></div>
        <div className="stat"><span className="muted small">Total {bundle.event.pledge_unit}</span><b>{Math.round(miles * 10) / 10}</b></div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h3>Top fundraisers</h3>
          {people.length ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {people.slice(0, 25).map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td>
                        <Link href={`/e/${bundle.event.slug}/p/${p.id}`}>{p.name}</Link>
                        {p.goal > 0 && (
                          <div className="progress" aria-label={`${Math.round((p.raised / p.goal) * 100)}% of goal`}>
                            <span style={{ width: `${Math.min(100, (p.raised / p.goal) * 100)}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="num">
                        {money(p.raised)}
                        {p.goal > 0 && <div className="small muted">of {money(p.goal)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No one yet — be the first!</p>
          )}
        </div>
        <div className="card">
          <h3>Teams</h3>
          {teams.length ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {teams.map(({ t, raised }, i) => (
                    <tr key={t.id}>
                      <td>{i + 1}</td>
                      <td><Link href={`/e/${bundle.event.slug}/t/${t.id}`}>{t.name}</Link></td>
                      <td className="num">{money(raised)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No teams yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

/** Team fundraising race for tournaments and leaderboards (pledge events use PledgeBoard). */
export function TeamMoneyRace({ bundle }: { bundle: Bundle }) {
  const rows = activeTeams(bundle)
    .map((t) => ({ t, sum: teamRaised(bundle, t) }))
    .sort((a, b) => b.sum - a.sum);
  const any = rows.some((r) => r.sum > 0 || r.t.goal > 0);
  if (!any) return null;
  const top = Math.max(1, ...rows.map((r) => Math.max(r.sum, r.t.goal)));
  return (
    <section className="card">
      <h2>Team fundraising</h2>
      {rows.map(({ t, sum }, i) => (
        <div key={t.id} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <Link href={`/e/${bundle.event.slug}/t/${t.id}`}><b>{i === 0 && sum > 0 ? '🏆 ' : ''}{t.name}</b></Link>
            <span>{money(sum)}{t.goal > 0 && <span className="small muted"> of {money(t.goal)}</span>}</span>
          </div>
          <div className="thermo" aria-hidden="true" style={{ height: 10 }}>
            <span style={{ width: `${Math.min(100, (sum / (t.goal || top)) * 100)}%` }} />
          </div>
        </div>
      ))}
    </section>
  );
}
