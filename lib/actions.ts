'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { one, query } from './db';
import { getBundle, getEventBySlug } from './data';
import { parsePositions, presetById, type EventKind, type TeamMode } from './presets';
import { randomToken, safeUrl, slugify, text, toCents, toInt, toNum } from './format';
import { balanceTeams } from './balance';
import { firstPlayoffRound, nextPlayoffRound, playoffSize, roundRobin, standings } from './bracket';
import type { EventRow } from './types';
import { currentUser, normalizeEmail } from './auth';
import { canManage } from './access';

/* ---------- helpers ---------- */

async function organizerEvent(fd: FormData): Promise<EventRow> {
  const event = await getEventBySlug(text(fd.get('slug'), 100));
  if (!event || !(await canManage(event, text(fd.get('key'), 100)))) {
    throw new Error('You don’t have organizer access to this event.');
  }
  return event;
}

function manageUrl(e: EventRow, msg?: string, tab?: string): string {
  const params = new URLSearchParams({ key: e.admin_key });
  if (msg) params.set('msg', msg);
  if (tab) params.set('tab', tab);
  return `/manage/${e.slug}?${params.toString()}`;
}

function refresh(e: EventRow) {
  revalidatePath(`/e/${e.slug}`);
  revalidatePath(`/manage/${e.slug}`);
}

const KINDS: EventKind[] = ['bracket', 'leaderboard', 'pledge'];

/* ---------- create event ---------- */

export async function createEvent(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/new');
  const name = text(fd.get('name'), 120);
  if (!name) throw new Error('Event name is required.');

  const preset = presetById(text(fd.get('sport'), 50));
  const kindIn = text(fd.get('kind'), 20) as EventKind;
  const kind: EventKind = KINDS.includes(kindIn) ? kindIn : preset?.kind ?? 'bracket';
  const teamMode: TeamMode = text(fd.get('team_mode'), 10) === 'set' ? 'set' : 'open';
  const teamChoices = text(fd.get('team_choices'), 2000)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 64);

  if (teamMode === 'set' && teamChoices.length < 1) {
    throw new Error('List at least one team name, or let teams sign up on their own.');
  }

  const allowTeams = fd.get('allow_teams') === 'on';
  const allowSolo = fd.get('allow_solo') === 'on';

  const slug = `${slugify(name)}-${randomToken(2)}`;
  const adminKey = randomToken(16);

  const ev = await one<{ id: number }>(
    `INSERT INTO events (slug, admin_key, name, charity, description, event_date, location, contact_email,
       kind, sport, team_mode, team_size, positions, team_fee, solo_fee, payment_url,
       allow_teams, allow_solo, games_per_team, playoff_teams, score_label, score_order, pledge_unit, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING id`,
    [
      slug,
      adminKey,
      name,
      text(fd.get('charity'), 200),
      text(fd.get('description'), 2000),
      text(fd.get('event_date'), 100),
      text(fd.get('location'), 200),
      text(fd.get('contact_email'), 200),
      kind,
      preset?.id ?? 'custom',
      teamMode,
      toInt(fd.get('team_size'), 0, 0, 200),
      JSON.stringify(parsePositions(text(fd.get('positions'), 500))),
      toCents(fd.get('team_fee')),
      toCents(fd.get('solo_fee')),
      safeUrl(fd.get('payment_url')),
      // In "set teams" mode, only solo sign-ups make sense.
      teamMode === 'set' ? false : allowTeams || !allowSolo,
      allowSolo || teamMode === 'set',
      toInt(fd.get('games_per_team'), 3, 1, 20),
      toInt(fd.get('playoff_teams'), 4, 0, 32),
      text(fd.get('score_label'), 50) || 'Score',
      text(fd.get('score_order'), 5) === 'low' ? 'low' : 'high',
      text(fd.get('pledge_unit'), 30) || 'miles',
      user.id,
    ],
  );

  if (teamMode === 'set') {
    let i = 0;
    for (const t of teamChoices) {
      await query(`INSERT INTO teams (event_id, name, origin, sort_order) VALUES ($1,$2,'set',$3)`, [ev!.id, t, i++]);
    }
  }

  redirect(`/manage/${slug}?key=${adminKey}&msg=created`);
}

/* ---------- public sign-ups ---------- */

async function openEvent(fd: FormData): Promise<EventRow> {
  const event = await getEventBySlug(text(fd.get('slug'), 100));
  if (!event) throw new Error('Event not found.');
  if (!event.signups_open) redirect(`/e/${event.slug}?closed=1`);
  return event;
}

export async function registerTeam(fd: FormData) {
  const event = await openEvent(fd);
  if (!event.allow_teams) throw new Error('This event takes solo sign-ups only.');

  const user = await currentUser();
  const teamName = text(fd.get('team_name'), 80);
  const captain = text(fd.get('captain_name'), 80) || user?.name || '';
  const email = normalizeEmail(text(fd.get('captain_email'), 200) || user?.email || '');
  if (!teamName || !captain) throw new Error('Team name and captain name are required.');

  const members = text(fd.get('members'), 4000)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (!members.length) members.push(captain);
  if (event.team_size > 0 && members.length > event.team_size) {
    redirect(`/e/${event.slug}?err=${encodeURIComponent(`Teams can have up to ${event.team_size} people.`)}#join`);
  }

  const order = await one<{ n: number }>('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM teams WHERE event_id=$1', [event.id]);
  const team = await one<{ id: number }>(
    `INSERT INTO teams (event_id, name, captain_name, captain_email, captain_user_id, origin, goal, sort_order)
     VALUES ($1,$2,$3,$4,$5,'registered',$6,$7) RETURNING id`,
    [event.id, teamName, captain, email, user?.id ?? null, toCents(fd.get('goal')), Number(order?.n ?? 1)],
  );

  for (const line of members) {
    // "Name" or "Name, Position"
    const [pname, pos] = line.split(',').map((s) => s.trim());
    // The captain's own line is linked to their account (if logged in).
    const isCaptain = pname.toLowerCase() === captain.toLowerCase();
    await query(
      `INSERT INTO players (event_id, team_id, name, email, user_id, position, is_solo, locked)
       VALUES ($1,$2,$3,$4,$5,$6,FALSE,TRUE)`,
      [event.id, team!.id, pname.slice(0, 80), isCaptain ? email : '', isCaptain ? user?.id ?? null : null, (pos ?? '').slice(0, 40)],
    );
  }

  refresh(event);
  redirect(`/e/${event.slug}?joined=team&who=${encodeURIComponent(teamName)}`);
}

export async function registerSolo(fd: FormData) {
  const event = await openEvent(fd);
  if (!event.allow_solo) throw new Error('This event takes whole-team sign-ups only.');

  const user = await currentUser();
  const name = text(fd.get('name'), 80) || user?.name || '';
  if (!name) throw new Error('Your name is required.');

  await query(
    `INSERT INTO players (event_id, user_id, name, email, position, skill, choice, honoring, goal, is_solo, locked)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,FALSE)`,
    [
      event.id,
      user?.id ?? null,
      name,
      normalizeEmail(text(fd.get('email'), 200) || user?.email || ''),
      text(fd.get('position'), 40),
      toInt(fd.get('skill'), 3, 1, 5),
      text(fd.get('choice'), 80),
      text(fd.get('honoring'), 120),
      toCents(fd.get('goal')),
    ],
  );

  // Place just the new player now; everyone already on a team stays put.
  await runBalance(event, true);

  refresh(event);
  redirect(`/e/${event.slug}?joined=solo&who=${encodeURIComponent(name)}`);
}

/* ---------- organizer: balancing & rosters ---------- */

async function runBalance(event: EventRow, onlyNew = false): Promise<{ placed: number; waitlist: number; created: number }> {
  let created = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { teams, players } = await getBundle(event);
    const result = balanceTeams(teams, players, event.team_size, event.positions, onlyNew);

    // Pledge events: solo people don't need a team, so never invent one.
    const makesTeams = event.team_mode === 'open' && event.kind !== 'pledge';
    const needMore = result.overflow.length > 0 && makesTeams;
    const noTeamsYet = teams.length === 0 && players.some((p) => p.is_solo) && makesTeams;
    if ((needMore || noTeamsYet) && attempt < 2) {
      const count = event.team_size > 0 ? Math.ceil(Math.max(1, result.overflow.length) / event.team_size) : 1;
      const existing = teams.filter((t) => t.origin === 'free_agent').length;
      const order = await one<{ n: number }>('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM teams WHERE event_id=$1', [event.id]);
      for (let i = 0; i < count; i++) {
        await query(`INSERT INTO teams (event_id, name, origin, sort_order) VALUES ($1,$2,'free_agent',$3)`, [
          event.id,
          `Free Agents ${existing + i + 1}`,
          Number(order?.n ?? 1) + i,
        ]);
        created++;
      }
      continue;
    }

    let placed = 0;
    for (const p of players) {
      const next = result.assignments.has(p.id) ? result.assignments.get(p.id)! : p.team_id;
      if (next !== p.team_id) {
        await query('UPDATE players SET team_id=$1 WHERE id=$2', [next, p.id]);
        placed++;
      }
    }
    return { placed, waitlist: result.overflow.length, created };
  }
  return { placed: 0, waitlist: 0, created };
}

export async function balanceAction(fd: FormData) {
  const event = await organizerEvent(fd);
  const { placed, waitlist, created } = await runBalance(event);
  refresh(event);
  const parts = [`Balanced: ${placed} player${placed === 1 ? '' : 's'} moved`];
  if (created) parts.push(`${created} free-agent team${created === 1 ? '' : 's'} added`);
  if (waitlist) parts.push(`${waitlist} on the waitlist (all teams full)`);
  redirect(manageUrl(event, parts.join(' · '), 'teams'));
}

export async function movePlayer(fd: FormData) {
  const event = await organizerEvent(fd);
  const playerId = toInt(fd.get('player_id'), 0, 0, 1e9);
  const teamRaw = text(fd.get('team_id'), 20);
  const teamId = teamRaw ? toInt(teamRaw, 0, 0, 1e9) : null;
  if (teamId !== null) {
    const ok = await one('SELECT id FROM teams WHERE id=$1 AND event_id=$2', [teamId, event.id]);
    if (!ok) throw new Error('Team not found.');
  }
  // A hand move is "locked" so the auto-balancer leaves it alone.
  await query('UPDATE players SET team_id=$1, locked=$2 WHERE id=$3 AND event_id=$4', [
    teamId,
    teamId !== null,
    playerId,
    event.id,
  ]);
  refresh(event);
  redirect(manageUrl(event, 'Player moved', 'teams'));
}

export async function unlockPlayer(fd: FormData) {
  const event = await organizerEvent(fd);
  await query('UPDATE players SET locked=FALSE WHERE id=$1 AND event_id=$2', [toInt(fd.get('player_id'), 0, 0, 1e9), event.id]);
  refresh(event);
  redirect(manageUrl(event, 'Player unlocked — the balancer can move them now', 'teams'));
}

export async function togglePaid(fd: FormData) {
  const event = await organizerEvent(fd);
  const table = text(fd.get('what'), 10) === 'team' ? 'teams' : 'players';
  await query(`UPDATE ${table} SET paid = NOT paid WHERE id=$1 AND event_id=$2`, [toInt(fd.get('id'), 0, 0, 1e9), event.id]);
  refresh(event);
  redirect(manageUrl(event, undefined, text(fd.get('tab'), 20) || 'people'));
}

export async function removePlayer(fd: FormData) {
  const event = await organizerEvent(fd);
  await query('DELETE FROM players WHERE id=$1 AND event_id=$2', [toInt(fd.get('player_id'), 0, 0, 1e9), event.id]);
  refresh(event);
  redirect(manageUrl(event, 'Player removed', 'people'));
}

export async function addTeam(fd: FormData) {
  const event = await organizerEvent(fd);
  const name = text(fd.get('team_name'), 80);
  if (name) {
    const order = await one<{ n: number }>('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM teams WHERE event_id=$1', [event.id]);
    await query(`INSERT INTO teams (event_id, name, origin, sort_order) VALUES ($1,$2,'set',$3)`, [event.id, name, Number(order?.n ?? 1)]);
  }
  refresh(event);
  redirect(manageUrl(event, name ? `Added ${name}` : undefined, 'teams'));
}

export async function renameTeam(fd: FormData) {
  const event = await organizerEvent(fd);
  const name = text(fd.get('team_name'), 80);
  if (name) await query('UPDATE teams SET name=$1 WHERE id=$2 AND event_id=$3', [name, toInt(fd.get('team_id'), 0, 0, 1e9), event.id]);
  refresh(event);
  redirect(manageUrl(event, 'Team renamed', 'teams'));
}

export async function removeTeam(fd: FormData) {
  const event = await organizerEvent(fd);
  const teamId = toInt(fd.get('team_id'), 0, 0, 1e9);
  // Registered teammates go with the team; placed solo players return to the pool.
  await query('DELETE FROM players WHERE team_id=$1 AND event_id=$2 AND is_solo=FALSE', [teamId, event.id]);
  await query('UPDATE players SET team_id=NULL, locked=FALSE WHERE team_id=$1 AND event_id=$2', [teamId, event.id]);
  await query('DELETE FROM teams WHERE id=$1 AND event_id=$2', [teamId, event.id]);
  refresh(event);
  redirect(manageUrl(event, 'Team removed', 'teams'));
}

export async function toggleSignups(fd: FormData) {
  const event = await organizerEvent(fd);
  await query('UPDATE events SET signups_open = NOT signups_open WHERE id=$1', [event.id]);
  refresh(event);
  redirect(manageUrl(event, event.signups_open ? 'Sign-ups closed' : 'Sign-ups opened', 'settings'));
}

export async function updateSettings(fd: FormData) {
  const event = await organizerEvent(fd);
  await query(
    `UPDATE events SET name=$1, charity=$2, description=$3, event_date=$4, location=$5, contact_email=$6,
       team_fee=$7, solo_fee=$8, payment_url=$9, team_size=$10, games_per_team=$11, playoff_teams=$12,
       score_label=$13, score_order=$14, pledge_unit=$15
     WHERE id=$16`,
    [
      text(fd.get('name'), 120) || event.name,
      text(fd.get('charity'), 200),
      text(fd.get('description'), 2000),
      text(fd.get('event_date'), 100),
      text(fd.get('location'), 200),
      text(fd.get('contact_email'), 200),
      toCents(fd.get('team_fee')),
      toCents(fd.get('solo_fee')),
      safeUrl(fd.get('payment_url')),
      toInt(fd.get('team_size'), event.team_size, 0, 200),
      toInt(fd.get('games_per_team'), event.games_per_team, 1, 20),
      toInt(fd.get('playoff_teams'), event.playoff_teams, 0, 32),
      text(fd.get('score_label'), 50) || event.score_label,
      fd.has('score_order') ? (text(fd.get('score_order'), 5) === 'low' ? 'low' : 'high') : event.score_order,
      text(fd.get('pledge_unit'), 30) || event.pledge_unit,
      event.id,
    ],
  );
  refresh(event);
  redirect(manageUrl(event, 'Settings saved', 'settings'));
}

/* ---------- organizer: bracket ---------- */

export async function makeSchedule(fd: FormData) {
  const event = await organizerEvent(fd);
  const { teams, players } = await getBundle(event);
  const playing = teams.filter((t) => players.some((p) => p.team_id === t.id) || t.origin === 'set');
  if (playing.length < 2) redirect(manageUrl(event, 'You need at least 2 teams to make a schedule', 'games'));
  await query('DELETE FROM games WHERE event_id=$1', [event.id]);
  for (const g of roundRobin(playing.map((t) => t.id), event.games_per_team)) {
    await query(
      `INSERT INTO games (event_id, stage, round, slot, home_team_id, away_team_id) VALUES ($1,'pool',$2,$3,$4,$5)`,
      [event.id, g.round, g.slot, g.home, g.away],
    );
  }
  refresh(event);
  redirect(manageUrl(event, 'Schedule made', 'games'));
}

export async function saveScore(fd: FormData) {
  const event = await organizerEvent(fd);
  const home = toNum(fd.get('home_score'));
  const away = toNum(fd.get('away_score'));
  await query('UPDATE games SET home_score=$1, away_score=$2 WHERE id=$3 AND event_id=$4', [
    home === null ? null : Math.max(0, Math.round(home)),
    away === null ? null : Math.max(0, Math.round(away)),
    toInt(fd.get('game_id'), 0, 0, 1e9),
    event.id,
  ]);
  refresh(event);
  redirect(manageUrl(event, 'Score saved', 'games'));
}

export async function startPlayoffs(fd: FormData) {
  const event = await organizerEvent(fd);
  const { teams, games } = await getBundle(event);
  const poolIds = [...new Set(games.filter((g) => g.stage === 'pool').flatMap((g) => [g.home_team_id!, g.away_team_id!]))];
  const ids = poolIds.length ? poolIds : teams.map((t) => t.id);
  const size = playoffSize(event.playoff_teams, ids.length);
  if (!size) redirect(manageUrl(event, 'Not enough teams for playoffs', 'games'));
  const seeded = standings(ids, games).map((s) => s.teamId);
  await query(`DELETE FROM games WHERE event_id=$1 AND stage='playoff'`, [event.id]);
  for (const g of firstPlayoffRound(seeded, size)) {
    await query(
      `INSERT INTO games (event_id, stage, round, slot, home_team_id, away_team_id) VALUES ($1,'playoff',$2,$3,$4,$5)`,
      [event.id, g.round, g.slot, g.home, g.away],
    );
  }
  refresh(event);
  redirect(manageUrl(event, `Playoffs started with the top ${size}`, 'games'));
}

export async function advancePlayoffs(fd: FormData) {
  const event = await organizerEvent(fd);
  const { games } = await getBundle(event);
  const next = nextPlayoffRound(games);
  if (!next) redirect(manageUrl(event, 'The championship is already set', 'games'));
  if (next.problem) redirect(manageUrl(event, next.problem, 'games'));
  for (const g of next.pairings) {
    await query(
      `INSERT INTO games (event_id, stage, round, slot, home_team_id, away_team_id) VALUES ($1,'playoff',$2,$3,$4,$5)`,
      [event.id, g.round, g.slot, g.home, g.away],
    );
  }
  refresh(event);
  redirect(manageUrl(event, 'Next round set', 'games'));
}

/* ---------- organizer: leaderboard & pledge ---------- */

export async function saveTeamResult(fd: FormData) {
  const event = await organizerEvent(fd);
  const score = toNum(fd.get('score'));
  const raisedIn = text(fd.get('raised'), 30);
  const teamId = toInt(fd.get('team_id'), 0, 0, 1e9);
  await query('UPDATE teams SET score=$1 WHERE id=$2 AND event_id=$3', [score, teamId, event.id]);
  if (raisedIn) await query('UPDATE teams SET raised=$1 WHERE id=$2 AND event_id=$3', [toCents(raisedIn), teamId, event.id]);
  refresh(event);
  redirect(manageUrl(event, 'Saved', 'results'));
}

export async function savePlayerResult(fd: FormData) {
  const event = await organizerEvent(fd);
  const playerId = toInt(fd.get('player_id'), 0, 0, 1e9);
  await query('UPDATE players SET raised=$1, distance=$2, score=$3 WHERE id=$4 AND event_id=$5', [
    toCents(fd.get('raised')),
    toNum(fd.get('distance')),
    toNum(fd.get('score')),
    playerId,
    event.id,
  ]);
  refresh(event);
  redirect(manageUrl(event, 'Saved', 'results'));
}
