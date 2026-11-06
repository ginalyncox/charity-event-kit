import type { Bundle, Game, GoalPledge } from './types';

/** Goals each team has scored so far (live and final games). */
export function goalsByTeam(games: Game[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const g of games) {
    if (g.status === 'scheduled') continue;
    if (g.home_team_id) m.set(g.home_team_id, (m.get(g.home_team_id) ?? 0) + (g.home_score ?? 0));
    if (g.away_team_id) m.set(g.away_team_id, (m.get(g.away_team_id) ?? 0) + (g.away_score ?? 0));
  }
  return m;
}

/** What a pledge comes to right now (cents), respecting the pledger's cap. */
export function pledgeOwed(p: GoalPledge, goals: Map<number, number>): number {
  const total = (p.team_id ? goals.get(p.team_id) ?? 0 : [...goals.values()].reduce((a, b) => a + b, 0)) * p.per_goal;
  return p.max_total > 0 ? Math.min(total, p.max_total) : total;
}

export function pledgeTotals(b: Bundle) {
  const goals = goalsByTeam(b.games);
  let owed = 0;
  let paid = 0;
  let perGoal = 0;
  for (const p of b.pledges) {
    const o = pledgeOwed(p, goals);
    owed += o;
    if (p.paid) paid += o;
    perGoal += p.per_goal;
  }
  return { owed, paid, perGoal, goals };
}

/** Next allowed bid for an auction item (cents). */
export function nextBid(item: { start_bid: number; increment: number; high_bid: number | null }): number {
  return item.high_bid === null ? Math.max(item.start_bid, 100) : item.high_bid + Math.max(item.increment, 100);
}
