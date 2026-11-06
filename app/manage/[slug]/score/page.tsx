import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canManage } from '@/lib/access';
import { getBundle, getEventBySlug } from '@/lib/data';
import { teamName, playoffRoundLabel } from '@/app/ui';
import { ScoreCard, type SkGame } from './Scorekeeper';

export const metadata: Metadata = { title: 'Scorekeeper', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ScorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event || !(await canManage(event, sp.key))) notFound();
  const { games, teams } = await getBundle(event);

  const order = { live: 0, scheduled: 1, final: 2 } as const;
  const list = [...games]
    .filter((g) => g.home_team_id && g.away_team_id)
    .sort((a, b) => order[a.status] - order[b.status] || (a.stage === b.stage ? a.round - b.round || a.slot - b.slot : a.stage === 'playoff' ? -1 : 1));
  const showFinal = sp.all === '1';
  const shown = list.filter((g) => showFinal || g.status !== 'final');

  const toSk = (g: (typeof games)[number]): SkGame => ({
    id: g.id,
    label: g.stage === 'pool' ? `Round ${g.round}${g.rink ? ` · ${g.rink}` : ''}${g.starts_at ? ` · ${g.starts_at}` : ''}` : playoffRoundLabel(games, g.round),
    home: teamName(teams, g.home_team_id),
    away: teamName(teams, g.away_team_id),
    homeScore: g.home_score ?? 0,
    awayScore: g.away_score ?? 0,
    status: g.status,
    playoff: g.stage === 'playoff',
  });
  const keyQs = `key=${event.admin_key}`;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <p className="eyebrow">Scorekeeper</p>
      <h1>{event.name}</h1>
      <p className="small muted">
        Tap + and − as goals happen. Every tap saves, and the public page and TV screen update within about 20 seconds.
      </p>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <Link className="btn secondary small" href={`/manage/${slug}?${keyQs}&tab=games`}>Back to Games</Link>
        <Link className="btn secondary small" href={`/manage/${slug}/score?${keyQs}${showFinal ? '' : '&all=1'}`}>
          {showFinal ? 'Hide finished games' : 'Show finished games'}
        </Link>
      </div>
      {shown.length ? (
        shown.map((g) => <ScoreCard key={`${g.id}-${g.status}`} slug={slug} adminKey={event.admin_key} game={toSk(g)} />)
      ) : (
        <div className="card">
          <p className="muted">{list.length ? 'All games are final. 🎉' : 'No games yet. Make the schedule on the Games tab first.'}</p>
        </div>
      )}
    </div>
  );
}
