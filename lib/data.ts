import 'server-only';
import { one, query } from './db';
import type { AuctionItem, Bundle, EventRow, Game, GoalPledge, Player, Team } from './types';

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
    owner_user_id: num(r.owner_user_id),
    fundraising_goal: Number(r.fundraising_goal ?? 0),
    copied_from: num(r.copied_from),
  };
}

function toTeam(r: any): Team {
  return { ...r, score: num(r.score), raised: Number(r.raised), goal: Number(r.goal), captain_user_id: num(r.captain_user_id) };
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
    user_id: num(r.user_id),
    waiver_agreed_at: r.waiver_agreed_at ? new Date(r.waiver_agreed_at).toISOString() : null,
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
  const [teams, players, games, pledges, auction] = await Promise.all([
    query('SELECT * FROM teams WHERE event_id = $1 ORDER BY sort_order, id', [event.id]),
    query('SELECT * FROM players WHERE event_id = $1 ORDER BY id', [event.id]),
    query('SELECT * FROM games WHERE event_id = $1 ORDER BY stage DESC, round, slot, id', [event.id]),
    query('SELECT * FROM goal_pledges WHERE event_id = $1 ORDER BY id', [event.id]),
    query(
      `SELECT i.*, b.amount AS high_bid, b.user_id AS high_user_id, u.name AS high_name, u.email AS high_email,
         (SELECT COUNT(*)::int FROM auction_bids x WHERE x.item_id = i.id) AS bid_count
       FROM auction_items i
       LEFT JOIN LATERAL (SELECT amount, user_id FROM auction_bids WHERE item_id = i.id ORDER BY amount DESC, id ASC LIMIT 1) b ON TRUE
       LEFT JOIN users u ON u.id = b.user_id
       WHERE i.event_id = $1 ORDER BY i.id`,
      [event.id],
    ),
  ]);
  return {
    event,
    teams: teams.map(toTeam),
    players: players.map(toPlayer),
    games: games.map(toGame),
    pledges: pledges.map(
      (r: any): GoalPledge => ({ ...r, team_id: num(r.team_id), per_goal: Number(r.per_goal), max_total: Number(r.max_total), user_id: num(r.user_id) }),
    ),
    auction: auction.map(
      (r: any): AuctionItem => ({
        ...r,
        start_bid: Number(r.start_bid),
        increment: Number(r.increment),
        high_bid: num(r.high_bid),
        high_user_id: num(r.high_user_id),
        bid_count: Number(r.bid_count),
      }),
    ),
  };
}
