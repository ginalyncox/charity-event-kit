import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBundle, getEventBySlug } from '@/lib/data';
import { registerSolo, registerTeam } from '@/lib/actions';
import { feeLabel } from '@/lib/format';
import { currentUser } from '@/lib/auth';
import Link from 'next/link';
import { ChampionBanner, Leaderboard, PledgeBoard, Rosters, Schedule, StandingsTable } from '@/app/ui';

/** Hidden spam trap plus the waiver checkbox, shared by both sign-up forms. */
function FormExtras({ waiver, who }: { waiver: string; who: string }) {
  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {waiver && (
        <div className="waiver">
          <details>
            <summary>Read the event waiver</summary>
            <p className="small" style={{ whiteSpace: 'pre-line', marginTop: 8 }}>{waiver}</p>
          </details>
          <label className="check">
            <input type="checkbox" name="waiver" required />
            {who}
          </label>
        </div>
      )}
    </>
  );
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  return e ? { title: e.name, description: e.charity ? `Raising money for ${e.charity}.` : undefined } : { title: 'Event not found' };
}

export default async function EventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  const bundle = await getBundle(event);
  const user = await currentUser();
  const mine = user ? bundle.players.filter((p) => p.user_id === user.id) : [];
  const fees = feeLabel(event);
  const isPledge = event.kind === 'pledge';

  // Team choices for solo players.
  const choices =
    event.team_mode === 'set'
      ? bundle.teams.map((t) => t.name)
      : bundle.teams.filter((t) => t.origin === 'registered').map((t) => t.name);

  return (
    <>
      <p className="eyebrow">{event.kind === 'bracket' ? 'Tournament' : event.kind === 'leaderboard' ? 'Competition' : 'Fundraiser'}</p>
      <h1>{event.name}</h1>
      <div className="meta">
        {event.event_date && <span>📅 {event.event_date}</span>}
        {event.location && <span>📍 {event.location}</span>}
        {fees && <span>🎟️ {fees}</span>}
      </div>
      {event.charity && (
        <p>
          <b>Raising money for:</b> {event.charity}
        </p>
      )}
      {event.description && <p className="muted" style={{ whiteSpace: 'pre-line' }}>{event.description}</p>}

      {sp.joined && (
        <div className="notice good" role="status">
          <p style={{ margin: 0 }}>
            <b>You’re in{sp.who ? `, ${sp.who}` : ''}!</b>{' '}
            {sp.joined === 'solo' ? 'Your team is shown below.' : 'Your team is on the list below.'}
          </p>
          {event.payment_url && (
            <p style={{ margin: '8px 0 0' }}>
              <a className="btn" href={event.payment_url} target="_blank" rel="noopener noreferrer">
                {isPledge ? 'Give or pay your entry' : 'Pay your entry fee'}
              </a>
            </p>
          )}
        </div>
      )}
      {sp.err && <div className="notice warn">{sp.err}</div>}

      {mine.length > 0 && !sp.joined && (
        <div className="notice info">
          You’re signed up
          {mine.map((p) => {
            const t = bundle.teams.find((x) => x.id === p.team_id);
            return <span key={p.id}>{t ? <> on <b>{t.name}</b></> : ' (team coming soon)'}</span>;
          })}
          . See your games and teammates in <Link href="/account">My events</Link>.
        </div>
      )}
      {!user && event.signups_open && (
        <p className="small muted">
          Have an account? <Link href={`/login?next=/e/${event.slug}`}>Log in</Link> so this event shows up in My events. You can
          also sign up without one.
        </p>
      )}

      <ChampionBanner bundle={bundle} />

      <section id="join">
        {!event.signups_open || sp.closed ? (
          <div className="notice info">Sign-ups are closed. {event.contact_email && <>Questions? <a href={`mailto:${event.contact_email}`}>{event.contact_email}</a></>}</div>
        ) : (
          <div className={`grid${event.allow_teams && event.allow_solo ? ' grid-2' : ''}`}>
            {event.allow_solo && (
              <div className="card">
                <h2>Sign up {isPledge ? '' : 'solo'}</h2>
                <form action={registerSolo} className="stack">
                  <input type="hidden" name="slug" value={event.slug} />
                  <label>
                    Your name
                    <input name="name" required maxLength={80} autoComplete="name" defaultValue={user?.name ?? ''} />
                  </label>
                  <label>
                    Email <span className="hint">Only the organizer sees this.</span>
                    <input name="email" type="email" maxLength={200} autoComplete="email" defaultValue={user?.email ?? ''} />
                  </label>
                  {event.positions.length > 0 && (
                    <label>
                      Position
                      <select name="position" defaultValue="">
                        <option value="">Any / not sure</option>
                        {event.positions.map((p) => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {!isPledge && (
                    <label>
                      Skill level <span className="hint">Helps make fair teams. Only the organizer sees this.</span>
                      <select name="skill" defaultValue="3">
                        <option value="1">1 — Brand new</option>
                        <option value="2">2 — Beginner</option>
                        <option value="3">3 — Average</option>
                        <option value="4">4 — Strong</option>
                        <option value="5">5 — Very experienced</option>
                      </select>
                    </label>
                  )}
                  {choices.length > 0 && (
                    <label>
                      {event.team_mode === 'set' ? 'Which team?' : 'Join a team?'}
                      <select name="choice" defaultValue="">
                        <option value="">Put me where I’m needed</option>
                        {choices.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Playing in honor of <span className="hint">Optional. Shown on the roster, like “Dad, Navy.”</span>
                    <input name="honoring" maxLength={120} />
                  </label>
                  {isPledge && (
                    <label>
                      Your fundraising goal ($) <span className="hint">Optional.</span>
                      <input name="goal" inputMode="decimal" placeholder="100" />
                    </label>
                  )}
                  <FormExtras waiver={event.waiver_text} who="I have read and agree to the event waiver." />
                  <button type="submit" className="btn">Sign me up</button>
                </form>
              </div>
            )}
            {event.allow_teams && (
              <div className="card">
                <h2>Sign up a whole team</h2>
                <form action={registerTeam} className="stack">
                  <input type="hidden" name="slug" value={event.slug} />
                  <label>
                    Team name
                    <input name="team_name" required maxLength={80} />
                  </label>
                  <div className="row-2">
                    <label>
                      Captain name
                      <input name="captain_name" required maxLength={80} defaultValue={user?.name ?? ''} />
                    </label>
                    <label>
                      Captain email <span className="hint">Only the organizer sees this.</span>
                      <input name="captain_email" type="email" maxLength={200} defaultValue={user?.email ?? ''} />
                    </label>
                  </div>
                  <label>
                    Team members{' '}
                    <span className="hint">
                      One per line, include yourself.{event.positions.length ? ' Add a position after a comma: “Sam Lee, Goalie”.' : ''}
                      {event.team_size ? ` Up to ${event.team_size}.` : ''}
                    </span>
                    <textarea name="members" rows={5} />
                  </label>
                  {isPledge && (
                    <label>
                      Team fundraising goal ($) <span className="hint">Optional.</span>
                      <input name="goal" inputMode="decimal" />
                    </label>
                  )}
                  <FormExtras waiver={event.waiver_text} who="As captain, I agree to the waiver and will share it with my team." />
                  <button type="submit" className="btn">Register our team</button>
                </form>
              </div>
            )}
          </div>
        )}
      </section>

      {event.kind === 'bracket' && (
        <section style={{ marginTop: 8 }}>
          {bundle.games.some((g) => g.stage === 'pool') && (
            <div className="card">
              <h2>Standings</h2>
              <StandingsTable bundle={bundle} />
            </div>
          )}
          <h2>Schedule</h2>
          <Schedule bundle={bundle} />
        </section>
      )}

      {event.kind === 'leaderboard' && (
        <section className="card">
          <h2>Leaderboard</h2>
          <Leaderboard bundle={bundle} />
        </section>
      )}

      {isPledge && (
        <section>
          <h2>Fundraising</h2>
          <PledgeBoard bundle={bundle} />
        </section>
      )}

      <section style={{ marginTop: 8 }}>
        <h2>Teams</h2>
        <Rosters bundle={bundle} />
      </section>

      {event.contact_email && (
        <p className="small muted" style={{ marginTop: 24 }}>
          Questions? Email the organizer: <a href={`mailto:${event.contact_email}`}>{event.contact_email}</a>
        </p>
      )}
    </>
  );
}
