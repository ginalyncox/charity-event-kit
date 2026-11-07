// Bump SCHEMA_VERSION whenever SCHEMA changes so existing databases upgrade.
export const SCHEMA_VERSION = '9';

// Each statement runs separately (Neon's HTTP driver takes one statement per call).
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS events (
    id            SERIAL PRIMARY KEY,
    slug          TEXT UNIQUE NOT NULL,
    admin_key     TEXT NOT NULL,
    name          TEXT NOT NULL,
    charity       TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    event_date    TEXT NOT NULL DEFAULT '',
    location      TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    kind          TEXT NOT NULL CHECK (kind IN ('bracket','leaderboard','pledge')),
    sport         TEXT NOT NULL DEFAULT 'custom',
    team_mode     TEXT NOT NULL CHECK (team_mode IN ('set','open')),
    team_size     INTEGER NOT NULL DEFAULT 0,
    positions     JSONB NOT NULL DEFAULT '[]',
    team_fee      INTEGER NOT NULL DEFAULT 0,
    solo_fee      INTEGER NOT NULL DEFAULT 0,
    payment_url   TEXT NOT NULL DEFAULT '',
    allow_teams   BOOLEAN NOT NULL DEFAULT TRUE,
    allow_solo    BOOLEAN NOT NULL DEFAULT TRUE,
    games_per_team INTEGER NOT NULL DEFAULT 3,
    playoff_teams INTEGER NOT NULL DEFAULT 4,
    score_label   TEXT NOT NULL DEFAULT 'Score',
    score_order   TEXT NOT NULL DEFAULT 'high' CHECK (score_order IN ('high','low')),
    pledge_unit   TEXT NOT NULL DEFAULT 'miles',
    signups_open  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS teams (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    captain_name  TEXT NOT NULL DEFAULT '',
    captain_email TEXT NOT NULL DEFAULT '',
    origin        TEXT NOT NULL DEFAULT 'set' CHECK (origin IN ('set','registered','free_agent')),
    paid          BOOLEAN NOT NULL DEFAULT FALSE,
    score         NUMERIC,
    raised        INTEGER NOT NULL DEFAULT 0,
    goal          INTEGER NOT NULL DEFAULT 0,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS players (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL DEFAULT '',
    position      TEXT NOT NULL DEFAULT '',
    skill         INTEGER NOT NULL DEFAULT 3,
    choice        TEXT NOT NULL DEFAULT '',
    honoring      TEXT NOT NULL DEFAULT '',
    is_solo       BOOLEAN NOT NULL DEFAULT TRUE,
    locked        BOOLEAN NOT NULL DEFAULT FALSE,
    paid          BOOLEAN NOT NULL DEFAULT FALSE,
    raised        INTEGER NOT NULL DEFAULT 0,
    goal          INTEGER NOT NULL DEFAULT 0,
    distance      NUMERIC,
    score         NUMERIC,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS games (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    stage         TEXT NOT NULL CHECK (stage IN ('pool','playoff')),
    round         INTEGER NOT NULL,
    slot          INTEGER NOT NULL DEFAULT 0,
    home_team_id  INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id  INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    home_score    INTEGER,
    away_score    INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS teams_event_idx ON teams(event_id)`,
  `CREATE INDEX IF NOT EXISTS players_event_idx ON players(event_id)`,
  `CREATE INDEX IF NOT EXISTS games_event_idx ON games(event_id)`,
  `CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash    TEXT PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE teams ADD COLUMN IF NOT EXISTS captain_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS events_owner_idx ON events(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS players_user_idx ON players(user_id)`,
  `CREATE INDEX IF NOT EXISTS players_email_idx ON players(lower(email))`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,
  // v3: safety, game day, organizer tools, fundraising
  `CREATE TABLE IF NOT EXISTS password_resets (
    token_hash    TEXT PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at    TIMESTAMPTZ NOT NULL,
    used          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS rate_hits (
    id            SERIAL PRIMARY KEY,
    bucket        TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS rate_hits_bucket_idx ON rate_hits(bucket, created_at)`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS stream_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS fundraising_goal INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS sponsors TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS waiver_text TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS start_at TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE games ADD COLUMN IF NOT EXISTS stream_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE games ADD COLUMN IF NOT EXISTS starts_at TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE games ADD COLUMN IF NOT EXISTS rink TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_in BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS waiver_agreed_at TIMESTAMPTZ`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS waiver_name TEXT NOT NULL DEFAULT ''`,
  // v4: live game status
  `ALTER TABLE games ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled'`,
  `UPDATE games SET status = 'final' WHERE status = 'scheduled' AND home_score IS NOT NULL AND away_score IS NOT NULL`,
  // v5: personal and team pay links
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS pay_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE teams ADD COLUMN IF NOT EXISTS pay_url TEXT NOT NULL DEFAULT ''`,
  // v6: co-organizers, pledges, auction, jerseys, volunteers, awards, push alerts
  `CREATE TABLE IF NOT EXISTS event_admins (
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    email         TEXT NOT NULL,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, email)
  )`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS jersey_sizes TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS pledges_open BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS copied_from INTEGER`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS jersey_size TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS jersey_number TEXT NOT NULL DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS goal_pledges (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id       INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL DEFAULT '',
    per_goal      INTEGER NOT NULL,
    max_total     INTEGER NOT NULL DEFAULT 0,
    paid          BOOLEAN NOT NULL DEFAULT FALSE,
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS auction_items (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    donor         TEXT NOT NULL DEFAULT '',
    start_bid     INTEGER NOT NULL DEFAULT 0,
    increment     INTEGER NOT NULL DEFAULT 500,
    closed        BOOLEAN NOT NULL DEFAULT FALSE,
    paid          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS auction_bids (
    id            SERIAL PRIMARY KEY,
    item_id       INTEGER NOT NULL REFERENCES auction_items(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount        INTEGER NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS auction_bids_item_idx ON auction_bids(item_id, amount DESC)`,
  `CREATE TABLE IF NOT EXISTS shifts (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    role          TEXT NOT NULL,
    when_text     TEXT NOT NULL DEFAULT '',
    slots         INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS shift_signups (
    id            SERIAL PRIMARY KEY,
    shift_id      INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL DEFAULT '',
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS awards (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    choice_type   TEXT NOT NULL DEFAULT 'player',
    open          BOOLEAN NOT NULL DEFAULT TRUE,
    published     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS award_votes (
    award_id      INTEGER NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
    voter         TEXT NOT NULL,
    choice        TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (award_id, voter)
  )`,
  `CREATE TABLE IF NOT EXISTS push_subs (
    endpoint      TEXT PRIMARY KEY,
    p256dh        TEXT NOT NULL,
    auth          TEXT NOT NULL,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id       INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS push_subs_event_idx ON push_subs(event_id)`,
  // v7: a phone can follow several events
  `ALTER TABLE push_subs DROP CONSTRAINT IF EXISTS push_subs_pkey`,
  `CREATE UNIQUE INDEX IF NOT EXISTS push_subs_endpoint_event_idx ON push_subs(endpoint, event_id)`,
  // v8: browse, calendar, near me, email verification, native push
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS end_at TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS geo_for TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS email_tokens (
    token_hash    TEXT PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS apns_tokens (
    token         TEXT PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id       INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS events_visibility_idx ON events(visibility, start_at)`,
  // v9: one iPhone can follow several events
  `ALTER TABLE apns_tokens DROP CONSTRAINT IF EXISTS apns_tokens_pkey`,
  `CREATE UNIQUE INDEX IF NOT EXISTS apns_tokens_token_event_idx ON apns_tokens(token, event_id)`,
];
