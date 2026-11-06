export type EventKind = 'bracket' | 'leaderboard' | 'pledge';
export type TeamMode = 'set' | 'open';

export type Position = { name: string; perTeam: number };

export type Preset = {
  id: string;
  label: string;
  kind: EventKind;
  teamMode: TeamMode;
  teamSize: number; // 0 = no cap
  positions: Position[];
  gamesPerTeam: number;
  playoffTeams: number;
  scoreLabel: string;
  scoreOrder: 'high' | 'low';
  pledgeUnit: string;
  allowTeams: boolean;
  allowSolo: boolean;
  teamChoices: string; // comma-separated, used when teamMode = 'set'
};

const base: Omit<Preset, 'id' | 'label' | 'kind'> = {
  teamMode: 'open',
  teamSize: 0,
  positions: [],
  gamesPerTeam: 3,
  playoffTeams: 4,
  scoreLabel: 'Score',
  scoreOrder: 'high',
  pledgeUnit: 'miles',
  allowTeams: true,
  allowSolo: true,
  teamChoices: '',
};

export const PRESETS: Preset[] = [
  {
    ...base,
    id: 'hockey',
    label: 'Hockey',
    kind: 'bracket',
    teamMode: 'set',
    // Matches Iowa Salutes Heroes: 6 branch teams, 96 players, 3 games + 4-team playoff.
    teamSize: 16,
    positions: [
      { name: 'Goalie', perTeam: 1 },
      { name: 'Defense', perTeam: 5 },
      { name: 'Forward', perTeam: 10 },
    ],
    gamesPerTeam: 3,
    playoffTeams: 4,
    allowTeams: false,
    teamChoices: 'Army, Navy, Air Force, Marines, Coast Guard, Space Force',
  },
  { ...base, id: 'cornhole', label: 'Cornhole', kind: 'bracket', teamSize: 2, gamesPerTeam: 3, playoffTeams: 8 },
  {
    ...base,
    id: 'softball',
    label: 'Softball',
    kind: 'bracket',
    teamSize: 12,
    positions: [{ name: 'Pitcher', perTeam: 1 }, { name: 'Catcher', perTeam: 1 }, { name: 'Fielder', perTeam: 10 }],
    gamesPerTeam: 2,
  },
  { ...base, id: 'basketball', label: 'Basketball', kind: 'bracket', teamSize: 8, gamesPerTeam: 3 },
  { ...base, id: 'volleyball', label: 'Volleyball', kind: 'bracket', teamSize: 8, gamesPerTeam: 3 },
  { ...base, id: 'kickball', label: 'Kickball', kind: 'bracket', teamSize: 12, gamesPerTeam: 2 },
  {
    ...base,
    id: 'golf',
    label: 'Golf scramble',
    kind: 'leaderboard',
    teamSize: 4,
    scoreLabel: 'Strokes',
    scoreOrder: 'low',
  },
  { ...base, id: 'fishing', label: 'Fishing', kind: 'leaderboard', teamSize: 2, scoreLabel: 'Total weight (lb)' },
  { ...base, id: 'bowling', label: 'Bowling', kind: 'leaderboard', teamSize: 4, scoreLabel: 'Total pins' },
  { ...base, id: 'trivia', label: 'Trivia night', kind: 'leaderboard', teamSize: 6, scoreLabel: 'Points' },
  { ...base, id: 'bike', label: 'Bike ride', kind: 'pledge', pledgeUnit: 'miles' },
  { ...base, id: 'walk', label: 'Walk / run', kind: 'pledge', pledgeUnit: 'miles' },
  { ...base, id: 'custom-bracket', label: 'Other — teams play each other', kind: 'bracket', teamSize: 0 },
  { ...base, id: 'custom-leaderboard', label: 'Other — teams post scores', kind: 'leaderboard' },
  { ...base, id: 'custom-pledge', label: 'Other — raise money per person', kind: 'pledge' },
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export const KIND_LABEL: Record<EventKind, string> = {
  bracket: 'Bracket — teams play each other',
  leaderboard: 'Leaderboard — teams post scores',
  pledge: 'Pledge — raise money per person or per mile',
};

/** Parses "Goalie:1, Defense:4, Forward" into positions. */
export function parsePositions(text: string): Position[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, n] = s.split(':').map((x) => x.trim());
      const perTeam = Number.parseInt(n ?? '', 10);
      return { name, perTeam: Number.isFinite(perTeam) && perTeam > 0 ? perTeam : 0 };
    })
    .filter((p) => p.name);
}

export function formatPositions(positions: Position[]): string {
  return positions.map((p) => (p.perTeam ? `${p.name}:${p.perTeam}` : p.name)).join(', ');
}
