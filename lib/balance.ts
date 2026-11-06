import type { Position } from './presets';

/**
 * Team balancing.
 *
 * Who stays put:
 *   - players who came in on a registered team (not solo)
 *   - players the organizer moved by hand (locked)
 *   - solo players who picked a team by name (e.g. "Navy")
 * Everyone else ("put me where I'm needed") is placed:
 *   1. positions first — a team short a Goalie gets the next goalie
 *   2. then strongest players first, each to the team with the fewest
 *      players (ties: lowest total skill), so teams stay even
 * Teams at their size cap are skipped. Anyone left over is returned as
 * overflow (the caller makes free-agent teams or a waitlist).
 */

export type BalanceTeam = { id: number; name: string };
export type BalancePlayer = {
  id: number;
  team_id: number | null;
  position: string;
  skill: number;
  choice: string;
  is_solo: boolean;
  locked: boolean;
};

export type BalanceResult = {
  assignments: Map<number, number | null>;
  overflow: number[];
};

const norm = (s: string) => s.trim().toLowerCase();

export function balanceTeams(
  teams: BalanceTeam[],
  players: BalancePlayer[],
  teamSize: number,
  positions: Position[],
  onlyUnassigned = false,
): BalanceResult {
  const assignments = new Map<number, number | null>();
  const teamIds = new Set(teams.map((t) => t.id));
  const byName = new Map(teams.map((t) => [norm(t.name), t.id]));

  type Tally = { count: number; skill: number; pos: Map<string, number> };
  const tally = new Map<number, Tally>(teams.map((t) => [t.id, { count: 0, skill: 0, pos: new Map() }]));

  const place = (p: BalancePlayer, teamId: number) => {
    assignments.set(p.id, teamId);
    const t = tally.get(teamId)!;
    t.count += 1;
    t.skill += p.skill;
    const key = norm(p.position);
    if (key) t.pos.set(key, (t.pos.get(key) ?? 0) + 1);
  };

  const flexible: BalancePlayer[] = [];

  for (const p of players) {
    const keep = (onlyUnassigned || !p.is_solo || p.locked) && p.team_id !== null && teamIds.has(p.team_id);
    if (keep) {
      place(p, p.team_id!);
      continue;
    }
    const chosen = p.choice ? byName.get(norm(p.choice)) : undefined;
    if (chosen !== undefined) {
      place(p, chosen);
      continue;
    }
    flexible.push(p);
  }

  const hasRoom = (teamId: number) => teamSize <= 0 || tally.get(teamId)!.count < teamSize;
  const lighter = (a: number, b: number) => {
    const ta = tally.get(a)!;
    const tb = tally.get(b)!;
    return ta.count - tb.count || ta.skill - tb.skill || a - b;
  };

  // Strongest first, so the snake evens out.
  flexible.sort((a, b) => b.skill - a.skill || a.id - b.id);
  const remaining: BalancePlayer[] = [];

  // 1. Fill required positions.
  const required = positions.filter((pos) => pos.perTeam > 0);
  const handled = new Set<number>();
  for (const pos of required) {
    const key = norm(pos.name);
    for (const p of flexible) {
      if (handled.has(p.id) || norm(p.position) !== key) continue;
      const needy = teams
        .map((t) => t.id)
        .filter((id) => hasRoom(id) && (tally.get(id)!.pos.get(key) ?? 0) < pos.perTeam)
        // Lightest team first, so a team stacked by choices isn't topped up further.
        .sort(lighter);
      if (needy.length) {
        place(p, needy[0]);
        handled.add(p.id);
      }
    }
  }
  for (const p of flexible) if (!handled.has(p.id)) remaining.push(p);

  // 2. Everyone else, strongest first, to the lightest team with room.
  const overflow: number[] = [];
  for (const p of remaining) {
    const open = teams.map((t) => t.id).filter(hasRoom).sort(lighter);
    if (open.length) place(p, open[0]);
    else {
      assignments.set(p.id, null);
      overflow.push(p.id);
    }
  }

  // 3. Even out skill: swap two flexible players of the same position between
  //    the strongest and weakest teams while it narrows the gap.
  const movable = new Set(flexible.map((p) => p.id));
  const byId = new Map(players.map((p) => [p.id, p]));
  const sumOf = (teamId: number) => tally.get(teamId)!.skill;
  for (let pass = 0; pass < 200; pass++) {
    const ids = teams.map((t) => t.id).filter((id) => tally.get(id)!.count > 0);
    if (ids.length < 2) break;
    ids.sort((a, b) => sumOf(b) - sumOf(a));
    let best: { a: number; b: number; gain: number } | null = null;
    for (let hi = 0; hi < ids.length && !best; hi++) {
      for (let lo = ids.length - 1; lo > hi && !best; lo--) {
        const gap = sumOf(ids[hi]) - sumOf(ids[lo]);
        if (gap <= 1) continue;
        const strong = [...assignments].filter(([pid, tid]) => tid === ids[hi] && movable.has(pid)).map(([pid]) => byId.get(pid)!);
        const weak = [...assignments].filter(([pid, tid]) => tid === ids[lo] && movable.has(pid)).map(([pid]) => byId.get(pid)!);
        for (const x of strong) {
          for (const y of weak) {
            const d = x.skill - y.skill;
            if (d <= 0 || norm(x.position) !== norm(y.position)) continue;
            const gain = gap - Math.abs(gap - 2 * d);
            if (gain > 0 && (!best || gain > best.gain)) best = { a: x.id, b: y.id, gain };
          }
        }
        if (best) {
          const x = byId.get(best.a)!;
          const y = byId.get(best.b)!;
          assignments.set(x.id, ids[lo]);
          assignments.set(y.id, ids[hi]);
          tally.get(ids[hi])!.skill += y.skill - x.skill;
          tally.get(ids[lo])!.skill += x.skill - y.skill;
        }
      }
    }
    if (!best) break;
  }

  return { assignments, overflow };
}

/** Warnings for the organizer: missing positions, over-full teams, uneven skill. */
export function rosterWarnings(
  teams: BalanceTeam[],
  players: BalancePlayer[],
  teamSize: number,
  positions: Position[],
): string[] {
  const out: string[] = [];
  const required = positions.filter((p) => p.perTeam > 0 && p.perTeam <= 2);
  const counts: number[] = [];
  const avgs: number[] = [];
  for (const t of teams) {
    const roster = players.filter((p) => p.team_id === t.id);
    counts.push(roster.length);
    if (roster.length) avgs.push(roster.reduce((s, p) => s + p.skill, 0) / roster.length);
    if (teamSize > 0 && roster.length > teamSize) out.push(`${t.name} has ${roster.length} players (cap is ${teamSize}).`);
    for (const pos of required) {
      const have = roster.filter((p) => norm(p.position) === norm(pos.name)).length;
      if (have < pos.perTeam) out.push(`${t.name} needs ${pos.perTeam - have} more ${pos.name.toLowerCase()}.`);
    }
  }
  if (counts.length > 1) {
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    if (max - min >= 3) out.push(`Team sizes are uneven (${min} to ${max} players).`);
  }
  if (avgs.length > 1 && Math.max(...avgs) - Math.min(...avgs) >= 1) {
    out.push('Average skill differs by a full point or more between teams.');
  }
  return out;
}
