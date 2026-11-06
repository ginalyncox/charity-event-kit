'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setGameStatus, setLiveScore } from '@/lib/actions';

export type SkGame = {
  id: number;
  label: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'live' | 'final';
  playoff: boolean;
};

/** One game with big +/- buttons. Each tap saves right away. */
export function ScoreCard({ slug, adminKey, game }: { slug: string; adminKey: string; game: SkGame }) {
  const router = useRouter();
  const [home, setHome] = useState(game.homeScore);
  const [away, setAway] = useState(game.awayScore);
  const [status, setStatus] = useState(game.status);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const save = (h: number, a: number) => {
    setHome(h);
    setAway(a);
    if (status === 'scheduled') setStatus('live');
    start(async () => {
      try {
        await setLiveScore(slug, adminKey, game.id, h, a);
        setError('');
      } catch {
        setError('Didn’t save — check your connection and tap again.');
      }
    });
  };

  const changeStatus = (s: SkGame['status']) => {
    setStatus(s);
    start(async () => {
      try {
        await setGameStatus(slug, adminKey, game.id, s);
        setError('');
        router.refresh();
      } catch {
        setError('Didn’t save — check your connection and try again.');
      }
    });
  };

  const final = status === 'final';
  const Row = ({ name, n, set }: { name: string; n: number; set: (v: number) => void }) => (
    <div className="sk-row">
      <span className="sk-team">{name}</span>
      <span className="sk-ctl">
        <button type="button" aria-label={`${name} minus one`} disabled={final || n === 0} onClick={() => set(Math.max(0, n - 1))}>
          −
        </button>
        <span className="n" aria-live="polite">{n}</span>
        <button type="button" className="plus" aria-label={`${name} plus one`} disabled={final} onClick={() => set(n + 1)}>
          +
        </button>
      </span>
    </div>
  );

  return (
    <div className="sk-game">
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <b className="small muted">{game.label}</b>
        <span className={`pill ${status === 'live' ? 'live' : status === 'final' ? 'good' : ''}`}>
          {status === 'live' ? 'LIVE' : status === 'final' ? 'Final' : 'Not started'}
          {pending ? ' · saving…' : ''}
        </span>
      </div>
      <Row name={game.home} n={home} set={(v) => save(v, away)} />
      <Row name={game.away} n={away} set={(v) => save(home, v)} />
      {error && <div className="notice warn small" role="alert">{error}</div>}
      <div className="btn-row" style={{ marginTop: 8 }}>
        {status === 'scheduled' && (
          <button type="button" className="btn navy" onClick={() => changeStatus('live')}>Start game</button>
        )}
        {status === 'live' && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (home === away && game.playoff && !window.confirm('Playoff games need a winner. End as a tie anyway?')) return;
              if (window.confirm(`End game? Final: ${game.home} ${home} – ${away} ${game.away}`)) changeStatus('final');
            }}
          >
            End game (final)
          </button>
        )}
        {status === 'final' && (
          <button type="button" className="btn secondary small" onClick={() => changeStatus('live')}>Reopen to fix score</button>
        )}
      </div>
    </div>
  );
}
