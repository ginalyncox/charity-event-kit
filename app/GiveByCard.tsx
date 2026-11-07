import { giveByCard } from '@/lib/pay-actions';

/** "Give by card" box: picks an amount and opens Stripe's secure checkout. */
export default function GiveByCard({
  slug,
  back,
  teamId,
  playerId,
  label = 'Give by card',
}: {
  slug: string;
  back: string;
  teamId?: number;
  playerId?: number;
  label?: string;
}) {
  return (
    <form action={giveByCard} className="give-card">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="back" value={back} />
      {teamId ? <input type="hidden" name="team_id" value={teamId} /> : null}
      {playerId ? <input type="hidden" name="player_id" value={playerId} /> : null}
      <div className="btn-row" role="group" aria-label="Amount">
        {[25, 50, 100].map((n) => (
          <label key={n} className="chip">
            <input type="radio" name="amount" value={n} defaultChecked={n === 50} /> ${n}
          </label>
        ))}
        <label className="chip">
          Other $<input name="amount_other" inputMode="decimal" placeholder="" aria-label="Other amount in dollars" style={{ width: 70 }} />
        </label>
      </div>
      <label className="small">
        Your name (optional)
        <input name="donor" maxLength={80} autoComplete="name" />
      </label>
      <button className="btn">{label}</button>
      <p className="small muted" style={{ margin: '6px 0 0' }}>Secure checkout by Stripe. Money goes straight to the organizer.</p>
    </form>
  );
}
