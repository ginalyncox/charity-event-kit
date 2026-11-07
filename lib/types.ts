import type { EventKind, Position, TeamMode } from './presets';

export type EventRow = {
  id: number;
  slug: string;
  admin_key: string;
  name: string;
  charity: string;
  description: string;
  event_date: string;
  location: string;
  contact_email: string;
  kind: EventKind;
  sport: string;
  team_mode: TeamMode;
  team_size: number;
  positions: Position[];
  team_fee: number;
  solo_fee: number;
  payment_url: string;
  allow_teams: boolean;
  allow_solo: boolean;
  games_per_team: number;
  playoff_teams: number;
  score_label: string;
  score_order: 'high' | 'low';
  pledge_unit: string;
  signups_open: boolean;
  owner_user_id: number | null;
  stream_url: string;
  fundraising_goal: number;
  sponsors: string;
  waiver_text: string;
  start_at: string;
  jersey_sizes: string;
  pledges_open: boolean;
  copied_from: number | null;
  visibility: 'public' | 'private';
  end_at: string;
  lat: number | null;
  lng: number | null;
  geo_for: string;
  stripe_account_id: string;
  /** True once the connected Stripe account can take cards. */
  stripe_ready: boolean;
};

/** The public view never includes the organizer key. */
export type PublicEvent = Omit<EventRow, 'admin_key'>;

export type Team = {
  id: number;
  event_id: number;
  name: string;
  captain_name: string;
  captain_email: string;
  origin: 'set' | 'registered' | 'free_agent';
  paid: boolean;
  score: number | null;
  raised: number;
  goal: number;
  sort_order: number;
  captain_user_id: number | null;
  pay_url: string;
};

export type Player = {
  id: number;
  event_id: number;
  team_id: number | null;
  name: string;
  email: string;
  position: string;
  skill: number;
  choice: string;
  honoring: string;
  is_solo: boolean;
  locked: boolean;
  paid: boolean;
  raised: number;
  goal: number;
  distance: number | null;
  score: number | null;
  user_id: number | null;
  checked_in: boolean;
  waiver_agreed_at: string | null;
  waiver_name: string;
  pay_url: string;
  jersey_size: string;
  jersey_number: string;
};

export type Game = {
  id: number;
  event_id: number;
  stage: 'pool' | 'playoff';
  round: number;
  slot: number;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  stream_url: string;
  starts_at: string;
  rink: string;
  status: 'scheduled' | 'live' | 'final';
};

export type GoalPledge = {
  id: number;
  event_id: number;
  team_id: number | null;
  name: string;
  email: string;
  per_goal: number;
  max_total: number;
  paid: boolean;
  user_id: number | null;
};

export type AuctionItem = {
  id: number;
  event_id: number;
  title: string;
  description: string;
  donor: string;
  start_bid: number;
  increment: number;
  closed: boolean;
  paid: boolean;
  high_bid: number | null;
  high_user_id: number | null;
  high_name: string | null;
  high_email: string | null;
  bid_count: number;
};

export type Bundle = {
  event: EventRow;
  teams: Team[];
  players: Player[];
  games: Game[];
  pledges: GoalPledge[];
  auction: AuctionItem[];
  /** Card gifts to the event as a whole (not to a team or person), in cents. */
  onlineGeneral: number;
};
