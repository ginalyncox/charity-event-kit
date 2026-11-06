import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { getBundle, getEventBySlug } from '@/lib/data';
import { champion, standings } from '@/lib/bracket';
import { money } from '@/lib/format';
import { parseSponsors } from '@/lib/sponsors';
import AutoRefresh from '@/app/AutoRefresh';
import { activeTeams, playoffRoundLabel, rankTeams, teamName, totalRaised } from '@/app/ui';

export const metadata: Metadata = { title: 'Scoreboard', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function TvPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  const bundle = await getBundle(event);
  const { games, teams, players } = bundle;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const publicUrl = `${proto}://${host}/e/${slug}`;
  const qr = await QRCode.toDataURL(publicUrl, { margin: 1, width: 360 });

  const raised = totalRaised(bundle);
  const goal = event.fundraising_goal;
  const sponsors = parseSponsors(event.sponsors);
  const champ = champion(games);

  const live = games.filter((g) => g.status === 'live');
  const upcoming = games.filter((g) => g.status === 'scheduled').slice(0, Math.max(0, 6 - live.length));
  const recent = games.filter((g) => g.status === 'final').slice(-4).reverse();
  const label = (g: (typeof games)[number]) => (g.stage === 'pool' ? `Round ${g.round}` : playoffRoundLabel(games, g.round));

  const poolIds = [...new Set(games.filter((g) => g.stage === 'pool').flatMap((g) => [g.home_team_id!, g.away_team_id!]))];
  const table = poolIds.length ? standings(poolIds, games) : [];

  return (
    <div className="tv">
      <AutoRefresh seconds={15} />
      <h1>{event.name}</h1>
      {event.charity && <p style={{ opacity: 0.8 }}>Raising money for {event.charity}</p>}
      {champ && <div className="champion" style={{ fontSize: '1.4em' }}>🏆 Champions: {teamName(teams, champ)}</div>}

      {(goal > 0 || raised > 0) && (
        <div style={{ maxWidth: 900 }}>
          <b style={{ fontSize: '1.6em' }}>{money(raised)}</b> raised{goal > 0 && <> of {money(goal)} goal</>}
          {goal > 0 && (
            <div className="thermo" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (raised / goal) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="tv-grid">
        <section>
          {event.kind === 'bracket' && (
            <>
              <h2>{live.length ? 'Now playing' : 'Up next'}</h2>
              {[...live, ...upcoming].map((g) => (
                <div key={g.id} className="tv-game">
                  <span>{teamName(teams, g.home_team_id)}</span>
                  <span className="tv-score">
                    {g.status === 'live' ? `${g.home_score ?? 0} – ${g.away_score ?? 0}` : 'vs'}
                  </span>
                  <span style={{ textAlign: 'right' }}>{teamName(teams, g.away_team_id)}</span>
                  <span style={{ gridColumn: '1 / -1', opacity: 0.7, fontSize: '0.75em' }}>
                    {g.status === 'live' ? '🔴 LIVE · ' : ''}
                    {label(g)}
                    {g.rink ? ` · ${g.rink}` : ''}
                    {g.starts_at ? ` · ${g.starts_at}` : ''}
                  </span>
                </div>
              ))}
              {!live.length && !upcoming.length && <p style={{ opacity: 0.7 }}>No games scheduled right now.</p>}
              {recent.length > 0 && (
                <>
                  <h2 style={{ marginTop: '1.5em' }}>Final scores</h2>
                  {recent.map((g) => (
                    <div key={g.id} className="tv-game">
                      <span>{teamName(teams, g.home_team_id)}</span>
                      <span className="tv-score">{g.home_score} – {g.away_score}</span>
                      <span style={{ textAlign: 'right' }}>{teamName(teams, g.away_team_id)}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          {event.kind === 'leaderboard' && (
            <>
              <h2>Leaderboard</h2>
              {rankTeams(bundle).slice(0, 10).map((t, i) => (
                <div key={t.id} className="tv-game">
                  <span>{i === 0 ? '🏆' : i + 1}. {t.name}</span>
                  <span />
                  <span className="tv-score" style={{ textAlign: 'right' }}>{t.score}</span>
                </div>
              ))}
            </>
          )}
          {event.kind === 'pledge' && (
            <>
              <h2>Top fundraisers</h2>
              {[...players].sort((a, b) => b.raised - a.raised).slice(0, 10).map((p, i) => (
                <div key={p.id} className="tv-game">
                  <span>{i + 1}. {p.name}</span>
                  <span />
                  <span className="tv-score" style={{ textAlign: 'right' }}>{money(p.raised)}</span>
                </div>
              ))}
            </>
          )}
        </section>

        <section>
          {table.length > 0 && (
            <>
              <h2>Standings</h2>
              <table>
                <thead>
                  <tr><th>Team</th><th className="num">W</th><th className="num">L</th><th className="num">T</th><th className="num">Pts</th></tr>
                </thead>
                <tbody>
                  {table.map((r) => (
                    <tr key={r.teamId}>
                      <td>{teamName(teams, r.teamId)}</td>
                      <td className="num">{r.wins}</td>
                      <td className="num">{r.losses}</td>
                      <td className="num">{r.ties}</td>
                      <td className="num"><b>{r.points}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {!table.length && event.kind !== 'bracket' && (
            <>
              <h2>Teams</h2>
              <p>{activeTeams(bundle).length} teams · {players.length} people</p>
            </>
          )}
        </section>
      </div>

      <div className="tv-foot">
        <div>
          {sponsors.length > 0 && (
            <>
              <h2>Thank you to our sponsors</h2>
              <p style={{ fontSize: '1.1em' }}>{sponsors.map((s) => s.name).join('  ·  ')}</p>
            </>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tv-qr" src={qr} alt={`QR code for ${publicUrl}`} />
          <div style={{ fontSize: '0.8em', marginTop: 6 }}>Scan to follow along{event.payment_url ? ' & give' : ''}</div>
        </div>
      </div>
    </div>
  );
}
