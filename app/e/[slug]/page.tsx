import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBundle, getEventBySlug } from '@/lib/data';
import { castVote, makeGoalPledge, registerSolo, registerTeam, volunteer } from '@/lib/actions';
import { getAwards, getShifts } from '@/lib/extras';
import { pledgeOwed, pledgeTotals } from '@/lib/pledges';
import { feeLabel } from '@/lib/format';
import { currentUser } from '@/lib/auth';
import Link from 'next/link';
import AutoRefresh from '@/app/AutoRefresh';
import AlertsButton from '@/app/AlertsButton';
import StreamBox from '@/app/StreamBox';
import GiveByCard from '@/app/GiveByCard';
import { payEntry } from '@/lib/pay-actions';
import { stripeConfigured } from '@/lib/stripe';
import { money } from '@/lib/format';
import { parseSponsors } from '@/lib/sponsors';
import { ChampionBanner, Leaderboard, PledgeBoard, Rosters, Schedule, StandingsTable, TeamMoneyRace, totalRaised } from '@/app/ui';

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

function PledgePerGoal({ bundle, userName, userEmail, done }: { bundle: Awaited<ReturnType<typeof getBundle>>; userName: string; userEmail: string; done: boolean }) {
  const { event, teams } = bundle;
  const { owed, perGoal, goals } = pledgeTotals(bundle);
  const byTeam = teams
    .map((t) => ({ t, per: bundle.pledges.filter((p) => p.team_id === t.id).reduce((s, p) => s + p.per_goal, 0) }))
    .filter((x) => x.per > 0)
    .sort((a, b) => b.per - a.per);
  return (
    <section id="pledge" className="card">
      <h2>🥅 Pledge per goal</h2>
      <p className="muted">
        Pick a team and pledge an amount for every goal they score this tournament. Set a cap if you like. Pay when it’s over.
      </p>
      {perGoal > 0 && (
        <div className="stats" style={{ marginBottom: 12 }}>
          <div className="stat"><span className="small muted">Riding on every goal</span><b>{money(perGoal)}</b></div>
          <div className="stat"><span className="small muted">Pledged so far</span><b>{money(owed)}</b></div>
        </div>
      )}
      {byTeam.length > 0 && (
        <p className="small">
          {byTeam.map(({ t, per }) => (
            <span key={t.id} className="pill" style={{ marginRight: 6 }}>{t.name}: {money(per)}/goal · {goals.get(t.id) ?? 0} goals</span>
          ))}
        </p>
      )}
      {done && <div className="notice good">Thank you! Your pledge is in. The organizer will share how to pay after the tournament.</div>}
      <form action={makeGoalPledge} className="stack">
        <input type="hidden" name="slug" value={event.slug} />
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <input name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="row-2">
          <label>
            Team
            <select name="team_id" defaultValue="">
              <option value="">Every goal by every team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label>
            $ per goal
            <input name="per_goal" inputMode="decimal" required placeholder="5" />
          </label>
        </div>
        <div className="row-2">
          <label>Your name<input name="name" required maxLength={80} defaultValue={userName} /></label>
          <label>Email <span className="hint">So the organizer can send your total.</span><input name="email" type="email" defaultValue={userEmail} /></label>
        </div>
        <label>
          Most I’ll give ($) <span className="hint">Optional cap.</span>
          <input name="max_total" inputMode="decimal" placeholder="100" />
        </label>
        <button className="btn">Make my pledge</button>
      </form>
    </section>
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
  const [shifts, awards] = await Promise.all([getShifts(event.id), getAwards(event.id)]);
  const mine = user ? bundle.players.filter((p) => p.user_id === user.id) : [];
  const fees = feeLabel(event);
  const raised = totalRaised(bundle);
  const sponsors = parseSponsors(event.sponsors);
  // A game with its own stream that's live right now wins over the event stream.
  const liveGame = bundle.games.find((g) => g.status === 'live' && g.stream_url);
  const streamUrl = liveGame?.stream_url || event.stream_url;
  const streamTitle = liveGame
    ? `${bundle.teams.find((t) => t.id === liveGame.home_team_id)?.name ?? ''} vs ${bundle.teams.find((t) => t.id === liveGame.away_team_id)?.name ?? ''}`
    : '';
  const isPledge = event.kind === 'pledge';
  const cardOn = stripeConfigured() && event.stripe_ready && Boolean(event.stripe_account_id);
  // After sign-up: who to pay for, and how much.
  const joinedTeamId = sp.joined === 'team' ? Number(sp.tid) || 0 : 0;
  const joinedPlayerId = sp.joined === 'solo' ? Number(sp.pid) || 0 : 0;
  const entryFee = joinedTeamId ? event.team_fee : joinedPlayerId ? event.solo_fee : 0;

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
      {event.start_at && (
        <p>
          <a className="btn small secondary" href={`/e/${event.slug}/calendar`}>📅 Add to calendar</a>
        </p>
      )}
      {event.description && <p className="muted" style={{ whiteSpace: 'pre-line' }}>{event.description}</p>}

      {sp.joined && (
        <div className="notice good" role="status">
          <p style={{ margin: 0 }}>
            <b>You’re in{sp.who ? `, ${sp.who}` : ''}!</b>{' '}
            {sp.joined === 'solo' ? 'Your team is shown below.' : 'Your team is on the list below.'}
          </p>
          {cardOn && entryFee >= 50 ? (
            <form action={payEntry} style={{ margin: '8px 0 0' }}>
              <input type="hidden" name="slug" value={event.slug} />
              <input type="hidden" name="what" value={joinedTeamId ? 'team' : 'player'} />
              <input type="hidden" name="id" value={joinedTeamId || joinedPlayerId} />
              <button className="btn">Pay {money(entryFee)} entry fee by card</button>
            </form>
          ) : (
            event.payment_url && (
              <p style={{ margin: '8px 0 0' }}>
                <a className="btn" href={event.payment_url} target="_blank" rel="noopener noreferrer">
                  {isPledge ? 'Give or pay your entry' : 'Pay your entry fee'}
                </a>
              </p>
            )
          )}
        </div>
      )}
      {sp.paid && (
        <div className="notice good" role="status">
          {sp.paid === 'already'
            ? 'That entry fee is already paid. Thank you!'
            : sp.paid === 'entry'
              ? 'Thank you! Your entry fee went through. It shows as paid within a minute.'
              : 'Thank you for your gift! It shows in the totals within a minute.'}
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

      <AutoRefresh seconds={20} />
      <ChampionBanner bundle={bundle} />

      {streamUrl && <StreamBox url={streamUrl} title={streamTitle} giveUrl={event.payment_url || undefined} />}

      {event.fundraising_goal > 0 && (
        <div className="card">
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <span><b style={{ fontSize: '1.4rem' }}>{money(raised)}</b> raised of {money(event.fundraising_goal)}</span>
            <span className="small muted">{Math.min(100, Math.round((raised / event.fundraising_goal) * 100))}% to goal</span>
          </div>
          <div className="thermo" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((raised / event.fundraising_goal) * 100))} aria-label="Fundraising progress">
            <span style={{ width: `${Math.min(100, (raised / event.fundraising_goal) * 100)}%` }} />
          </div>
          {cardOn ? (
            <GiveByCard slug={event.slug} back={`/e/${event.slug}`} label="Give to the cause" />
          ) : (
            event.payment_url && (
              <a className="btn small" href={event.payment_url} target="_blank" rel="noopener noreferrer">Give to the cause</a>
            )
          )}
        </div>
      )}
      {cardOn && !(event.fundraising_goal > 0) && (
        <div className="card">
          <h2>Give to the cause</h2>
          {event.charity && <p className="muted">Every dollar goes to {event.charity}.</p>}
          <GiveByCard slug={event.slug} back={`/e/${event.slug}`} />
        </div>
      )}

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
                  {event.jersey_sizes && (
                    <div className="row-2">
                      <label>
                        Jersey size
                        <select name="jersey_size" defaultValue="">
                          <option value="">Choose a size</option>
                          {event.jersey_sizes.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (
                            <option key={x} value={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Jersey number <span className="hint">Request, if you have one.</span>
                        <input name="jersey_number" inputMode="numeric" maxLength={3} />
                      </label>
                    </div>
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
                  <label>
                    Your own fundraising link <span className="hint">Optional. A personal Zeffy, Givebutter, or GoFundMe page. You can add it later in My events.</span>
                    <input name="pay_url" inputMode="url" placeholder="https://..." />
                  </label>
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
                  <label>
                    Team fundraising goal ($) <span className="hint">Optional.</span>
                    <input name="goal" inputMode="decimal" />
                  </label>
                  <label>
                    Team fundraising link <span className="hint">Optional. Your team’s own Zeffy, Givebutter, or GoFundMe page.</span>
                    <input name="pay_url" inputMode="url" placeholder="https://..." />
                  </label>
                  <FormExtras waiver={event.waiver_text} who="As captain, I agree to the waiver and will share it with my team." />
                  <button type="submit" className="btn">Register our team</button>
                </form>
              </div>
            )}
          </div>
        )}
      </section>

      {event.kind === 'bracket' && process.env.VAPID_PUBLIC_KEY && (
        <AlertsButton slug={event.slug} teams={bundle.teams.map((t) => ({ id: t.id, name: t.name }))} publicKey={process.env.VAPID_PUBLIC_KEY} />
      )}

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

      {bundle.auction.length > 0 && (
        <section className="card">
          <h2>🏷️ Silent auction</h2>
          <p className="muted">
            {bundle.auction.filter((i) => !i.closed).length} item{bundle.auction.filter((i) => !i.closed).length === 1 ? '' : 's'} open for bids.
          </p>
          <Link className="btn" href={`/e/${event.slug}/auction`}>See items and bid</Link>
        </section>
      )}

      {event.pledges_open && event.kind === 'bracket' && <PledgePerGoal bundle={bundle} userName={user?.name ?? ''} userEmail={user?.email ?? ''} done={!!sp.pledged} />}

      {!isPledge && <TeamMoneyRace bundle={bundle} />}

      {awards.some((a) => a.open || a.published) && (
        <section id="awards" className="card">
          <h2>🏅 Awards</h2>
          {sp.vote && <div className="notice info">{sp.vote}</div>}
          {awards.filter((a) => a.published && a.tally.length).map((a) => (
            <p key={`w${a.id}`}><b>{a.title}:</b> 🏆 {a.tally[0].choice}</p>
          ))}
          {awards.filter((a) => a.open).map((a) => {
            const options = a.choice_type === 'team' ? bundle.teams.map((t) => t.name) : [...new Set(bundle.players.map((p) => p.name))].sort();
            return (
              <form key={a.id} action={castVote} className="btn-row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                <input type="hidden" name="slug" value={event.slug} />
                <input type="hidden" name="award_id" value={a.id} />
                <b style={{ minWidth: 140 }}>{a.title}</b>
                <select name="choice" defaultValue="" aria-label={`Vote for ${a.title}`} style={{ flex: 1, minWidth: 160 }}>
                  <option value="">Choose…</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <button className="btn small">Vote</button>
              </form>
            );
          })}
        </section>
      )}

      {shifts.length > 0 && (
        <section id="volunteer" className="card">
          <h2>🙋 Volunteer</h2>
          <p className="muted">Help make the day happen. Pick a shift with open spots.</p>
          {sp.vol && <div className="notice info">{sp.vol}</div>}
          {shifts.map((s2) => {
            const left = s2.slots - s2.signups.length;
            return (
              <form key={s2.id} action={volunteer} className="btn-row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                <input type="hidden" name="slug" value={event.slug} />
                <input type="hidden" name="shift_id" value={s2.id} />
                <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <b>{s2.role}</b>
                  <div className="small muted">{s2.when_text}{s2.when_text ? ' · ' : ''}{left > 0 ? `${left} of ${s2.slots} spots open` : 'Full'}</div>
                </div>
                {left > 0 && (
                  <>
                    <input name="name" placeholder="Your name" required defaultValue={user?.name ?? ''} aria-label="Your name" style={{ width: 150 }} />
                    <input name="email" type="email" placeholder="Email" defaultValue={user?.email ?? ''} aria-label="Your email" style={{ width: 170 }} />
                    <button className="btn small">Sign up</button>
                  </>
                )}
              </form>
            );
          })}
        </section>
      )}

      <section style={{ marginTop: 8 }}>
        <h2>Teams</h2>
        <Rosters bundle={bundle} />
      </section>

      {sponsors.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Thank you to our sponsors</h2>
          <div className="sponsors">
            {sponsors.map((sp2) =>
              sp2.url ? (
                <a key={sp2.name} href={sp2.url} target="_blank" rel="noopener noreferrer sponsored">{sp2.name}</a>
              ) : (
                <span key={sp2.name}>{sp2.name}</span>
              ),
            )}
          </div>
        </section>
      )}

      {event.contact_email && (
        <p className="small muted" style={{ marginTop: 24 }}>
          Questions? Email the organizer: <a href={`mailto:${event.contact_email}`}>{event.contact_email}</a>
        </p>
      )}
    </>
  );
}
