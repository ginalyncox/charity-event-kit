import 'server-only';
import { one, query } from './db';
import type { Bundle, EventRow, Game, Player, Team } from './types';

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function toEvent(r: any): EventRow {
  return {
    ...r,
    positions: typeof r.positions === 'string' ? JSON.parse(r.positions) : r.positions ?? [],
    team_size: Number(r.team_size),
    team_fee: Number(r.team_fee),
    solo_fee: Number(r.solo_fee),
    games_per_team: Number(r.games_per_team),
    playoff_teams: Number(r.playoff_teams),
  };
}

function toTeam(r: any): Team {
  return { ...r, score: num(r.score), raised: Number(r.raised), goal: Number(r.goal) };
}

function toPlayer(r: any): Player {
  return {
    ...r,
    team_id: num(r.team_id),
    skill: Number(r.skill),
    raised: Number(r.raised),
    goal: Number(r.goal),
    distance: num(r.distance),
    score: num(r.score),
  };
}

function toGame(r: any): Game {
  return {
    ...r,
    round: Number(r.round),
    slot: Number(r.slot),
    home_team_id: num(r.home_team_id),
    away_team_id: num(r.away_team_id),
    home_score: num(r.home_score),
    away_score: num(r.away_score),
  };
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const r = await one('SELECT * FROM events WHERE slug = $1', [slug]);
  return r ? toEvent(r) : null;
}

export async function getBundle(event: EventRow): Promise<Bundle> {
  const [teams, players, games] = await Promise.all([
    query('SELECT * FROM teams WHERE event_id = $1 ORDER BY sort_order, id', [event.id]),
    query('SELECT * FROM players WHERE event_id = $1 ORDER BY id', [event.id]),
    query('SELECT * FROM games WHERE event_id = $1 ORDER BY stage DESC, round, slot, id', [event.id]),
  ]);
  return {
    event,
    teams: teams.map(toTeam),
    players: players.map(toPlayer),
    games: games.map(toGame),
  };
}
