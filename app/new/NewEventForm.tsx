'use client';

import { useState } from 'react';
import { createEvent } from '@/lib/actions';
import { PRESETS, KIND_LABEL, formatPositions, presetById, type EventKind } from '@/lib/presets';

const BRANCHES = 'Army, Navy, Air Force, Marines, Coast Guard, Space Force';

export default function NewEventForm() {
  const first = presetById('hockey')!;
  const [sport, setSport] = useState(first.id);
  const [kind, setKind] = useState<EventKind>(first.kind);
  const [teamMode, setTeamMode] = useState(first.teamMode);
  const [teamChoices, setTeamChoices] = useState(first.teamChoices);
  const [teamSize, setTeamSize] = useState(String(first.teamSize || ''));
  const [positions, setPositions] = useState(formatPositions(first.positions));
  const [gamesPerTeam, setGamesPerTeam] = useState(String(first.gamesPerTeam));
  const [playoffTeams, setPlayoffTeams] = useState(String(first.playoffTeams));
  const [scoreLabel, setScoreLabel] = useState(first.scoreLabel);
  const [scoreOrder, setScoreOrder] = useState(first.scoreOrder);
  const [pledgeUnit, setPledgeUnit] = useState(first.pledgeUnit);
  const [allowTeams, setAllowTeams] = useState(first.allowTeams);
  const [allowSolo, setAllowSolo] = useState(first.allowSolo);

  function applyPreset(id: string) {
    const p = presetById(id);
    setSport(id);
    if (!p) return;
    setKind(p.kind);
    setTeamMode(p.teamMode);
    setTeamChoices(p.teamChoices);
    setTeamSize(String(p.teamSize || ''));
    setPositions(formatPositions(p.positions));
    setGamesPerTeam(String(p.gamesPerTeam));
    setPlayoffTeams(String(p.playoffTeams));
    setScoreLabel(p.scoreLabel);
    setScoreOrder(p.scoreOrder);
    setPledgeUnit(p.pledgeUnit);
    setAllowTeams(p.allowTeams);
    setAllowSolo(p.allowSolo);
  }

  return (
    <form action={createEvent} className="stack">
      <fieldset>
        <legend>1. The basics</legend>
        <label>
          Event name
          <input name="name" required maxLength={120} placeholder="Iowa Salutes Heroes Tournament 2027" />
        </label>
        <label>
          Who it raises money for <span className="hint">Shown on the sign-up page.</span>
          <input name="charity" maxLength={200} placeholder="Veteran organizations through the VFW" />
        </label>
        <div className="row-2">
          <label>
            Date
            <input name="event_date" maxLength={100} placeholder="May 21–23, 2027" />
          </label>
          <label>
            Location
            <input name="location" maxLength={200} placeholder="Rink name, city" />
          </label>
        </div>
        <label>
          Organizer email <span className="hint">So players can reach you. Shown publicly.</span>
          <input name="contact_email" type="email" maxLength={200} />
        </label>
        <label>
          Description <span className="hint">Format, what’s included, anything players should know.</span>
          <textarea name="description" maxLength={2000} placeholder="3 guaranteed games, then a 4-team playoff. Jerseys are yours to keep. All skill levels welcome." />
        </label>
      </fieldset>

      <fieldset>
        <legend>2. Sport or activity</legend>
        <label>
          Start from
          <select name="sport" value={sport} onChange={(e) => applyPreset(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Event type
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
            {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>3. Teams</legend>
        <label>
          How are teams made?
          <select name="team_mode" value={teamMode} onChange={(e) => setTeamMode(e.target.value as 'set' | 'open')}>
            <option value="set">I set the team list (for example, by branch of service)</option>
            <option value="open">Teams sign up on their own (solo players get placed)</option>
          </select>
        </label>

        {teamMode === 'set' && (
          <label>
            Team names <span className="hint">Separate with commas. Solo players can pick one of these.</span>
            <textarea name="team_choices" value={teamChoices} onChange={(e) => setTeamChoices(e.target.value)} rows={3} />
            <span>
              <button type="button" className="btn secondary small" onClick={() => setTeamChoices(BRANCHES)}>
                Use branches of service
              </button>
            </span>
          </label>
        )}

        <div className="row-2">
          <label>
            Max players per team <span className="hint">Leave blank for no limit.</span>
            <input name="team_size" inputMode="numeric" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} />
          </label>
          <label>
            Positions <span className="hint">Name:how many per team. Example: Goalie:1, Forward</span>
            <input name="positions" value={positions} onChange={(e) => setPositions(e.target.value)} />
          </label>
        </div>

        {teamMode === 'open' && (
          <div className="grid">
            <label className="check">
              <input type="checkbox" name="allow_teams" checked={allowTeams} onChange={(e) => setAllowTeams(e.target.checked)} />
              Whole teams can register together
            </label>
            <label className="check">
              <input type="checkbox" name="allow_solo" checked={allowSolo} onChange={(e) => setAllowSolo(e.target.checked)} />
              Solo players can sign up and get placed on a team
            </label>
          </div>
        )}
        {teamMode === 'set' && <input type="hidden" name="allow_solo" value="on" />}
      </fieldset>

      {kind === 'bracket' && (
        <fieldset>
          <legend>4. Games</legend>
          <div className="row-2">
            <label>
              Guaranteed games per team
              <input name="games_per_team" inputMode="numeric" value={gamesPerTeam} onChange={(e) => setGamesPerTeam(e.target.value)} />
            </label>
            <label>
              Teams in the playoffs <span className="hint">2, 4, or 8. Use 0 for no playoffs.</span>
              <input name="playoff_teams" inputMode="numeric" value={playoffTeams} onChange={(e) => setPlayoffTeams(e.target.value)} />
            </label>
          </div>
        </fieldset>
      )}

      {kind === 'leaderboard' && (
        <fieldset>
          <legend>4. Scoring</legend>
          <div className="row-2">
            <label>
              What gets scored
              <input name="score_label" value={scoreLabel} onChange={(e) => setScoreLabel(e.target.value)} />
            </label>
            <label>
              Who wins
              <select name="score_order" value={scoreOrder} onChange={(e) => setScoreOrder(e.target.value as 'high' | 'low')}>
                <option value="high">Highest score wins</option>
                <option value="low">Lowest score wins (golf)</option>
              </select>
            </label>
          </div>
        </fieldset>
      )}

      {kind === 'pledge' && (
        <fieldset>
          <legend>4. Distance</legend>
          <label>
            Distance unit <span className="hint">Shown next to each person’s distance.</span>
            <input name="pledge_unit" value={pledgeUnit} onChange={(e) => setPledgeUnit(e.target.value)} />
          </label>
        </fieldset>
      )}

      <fieldset>
        <legend>5. Entry fees</legend>
        <p className="small muted">
          People pay on your own payment page (Zeffy, RegFox, Givebutter, and so on). Charity Event Kit never holds money —
          you mark who has paid.
        </p>
        <div className="row-2">
          <label>
            Fee per team ($)
            <input name="team_fee" inputMode="decimal" placeholder="0" />
          </label>
          <label>
            Fee per player ($)
            <input name="solo_fee" inputMode="decimal" placeholder="0" />
          </label>
        </div>
        <label>
          Payment link
          <input name="payment_url" inputMode="url" placeholder="https://www.zeffy.com/..." />
        </label>
      </fieldset>

      <div className="btn-row">
        <button type="submit" className="btn">Create event</button>
        <span className="small muted">You’ll get a private organizer link. Save it.</span>
      </div>
    </form>
  );
}
