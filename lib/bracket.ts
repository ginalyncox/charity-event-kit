import type { Game } from './types';

export type Pairing = { round: number; slot: number; home: number; away: number };

/**
 * Round-robin "circle" schedule. Each round every team plays once
 * (one team sits out per round when the count is odd). If more games are
 * wanted than there are opponents, the cycle repeats with home/away swapped.
 */
export function roundRobin(teamIds: number[], gamesPerTeam: number): Pairing[] {
  if (teamIds.length < 2 || gamesPerTeam < 1) return [];
  const ids: (number | null)[] = [...teamIds];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const roundsInCycle = n - 1;
  const totalRounds = teamIds.length % 2 === 1 ? Math.ceil((gamesPerTeam * n) / (n - 1)) : gamesPerTeam;

  const out: Pairing[] = [];
  let arr = [...ids];
  for (let r = 0; r < totalRounds; r++) {
    const cycle = Math.floor(r / roundsInCycle);
    let slot = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      const swap = (r + cycle) % 2 === 1;
      out.push({ round: r + 1, slot: slot++, home: swap ? b : a, away: swap ? a : b });
    }
    // rotate all but the first
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  // With an odd team count, trim so nobody plays more than asked.
  if (teamIds.length % 2 === 1) {
    const played = new Map<number, number>();
    return out.filter((p) => {
      const h = played.get(p.home) ?? 0;
      const a = played.get(p.away) ?? 0;
      if (h >= gamesPerTeam || a >= gamesPerTeam) return false;
      played.set(p.home, h + 1);
      played.set(p.away, a + 1);
      return true;
    });
  }
  return out;
}

export type Standing = {
  teamId: number;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  scored: number;
  allowed: number;
  diff: number;
};

export function standings(teamIds: number[], games: Game[]): Standing[] {
  const map = new Map<number, Standing>(
    teamIds.map((id) => [id, { teamId: id, played: 0, wins: 0, losses: 0, ties: 0, points: 0, scored: 0, allowed: 0, diff: 0 }]),
  );
  for (const g of games) {
    if (g.stage !== 'pool' || g.status !== 'final' || g.home_score === null || g.away_score === null) continue;
    const h = map.get(g.home_team_id ?? -1);
    const a = map.get(g.away_team_id ?? -1);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.scored += g.home_score;
    h.allowed += g.away_score;
    a.scored += g.away_score;
    a.allowed += g.home_score;
    if (g.home_score > g.away_score) {
      h.wins++;
      a.losses++;
      h.points += 2;
    } else if (g.home_score < g.away_score) {
      a.wins++;
      h.losses++;
      a.points += 2;
    } else {
      h.ties++;
      a.ties++;
      h.points++;
      a.points++;
    }
  }
  return [...map.values()]
    .map((s) => ({ ...s, diff: s.scored - s.allowed }))
    .sort((x, y) => y.points - x.points || y.diff - x.diff || y.scored - x.scored || x.teamId - y.teamId);
}

/** Largest power of two that fits both the setting and the team count. */
export function playoffSize(wanted: number, teamCount: number): number {
  const cap = Math.min(wanted, teamCount);
  if (cap < 2) return 0;
  return 2 ** Math.floor(Math.log2(cap));
}

/** Seeds 1 v N, 2 v N-1, ... using the order given. */
export function firstPlayoffRound(seeded: number[], size: number): Pairing[] {
  const top = seeded.slice(0, size);
  const out: Pairing[] = [];
  // Standard bracket order keeps 1 and 2 on opposite sides.
  const order = bracketOrder(size);
  for (let i = 0; i < order.length; i += 2) {
    out.push({ round: 1, slot: i / 2, home: top[order[i]], away: top[order[i + 1]] });
  }
  return out;
}

function bracketOrder(size: number): number[] {
  let order = [0, 1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n - 1 - s]);
  }
  return order;
}

export function winnerOf(g: Game): number | null {
  if (g.status !== 'final') return null;
  if (g.home_score === null || g.away_score === null || g.home_score === g.away_score) return null;
  return g.home_score > g.away_score ? g.home_team_id : g.away_team_id;
}

/** Next playoff round from the latest one, or null if not ready / already done. */
export function nextPlayoffRound(games: Game[]): { pairings: Pairing[]; problem?: string } | null {
  const playoff = games.filter((g) => g.stage === 'playoff');
  if (!playoff.length) return null;
  const last = Math.max(...playoff.map((g) => g.round));
  const current = playoff.filter((g) => g.round === last).sort((a, b) => a.slot - b.slot);
  if (current.length === 1) return null; // final already exists
  const winners = current.map(winnerOf);
  if (winners.some((w) => w === null)) {
    return { pairings: [], problem: 'Every game in this round needs a final score with a winner (no ties).' };
  }
  const pairings: Pairing[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    pairings.push({ round: last + 1, slot: i / 2, home: winners[i]!, away: winners[i + 1]! });
  }
  return { pairings };
}

export function champion(games: Game[]): number | null {
  const playoff = games.filter((g) => g.stage === 'playoff');
  if (!playoff.length) return null;
  const last = Math.max(...playoff.map((g) => g.round));
  const finals = playoff.filter((g) => g.round === last);
  return finals.length === 1 ? winnerOf(finals[0]) : null;
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Championship';
  if (fromEnd === 1) return 'Semifinals';
  if (fromEnd === 2) return 'Quarterfinals';
  return `Playoff round ${round}`;
}
