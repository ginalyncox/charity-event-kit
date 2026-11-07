'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { canManage } from './access';
import { currentUser } from './auth';
import { one, query } from './db';
import { getEventBySlug } from './data';
import { money, text, toCents, toInt } from './format';
import { siteOrigin } from './mail';
import { allow, clientIp } from './ratelimit';
import { MAX_GIFT, MIN_GIFT, stripe, stripeConfigured } from './stripe';
import type { EventRow } from './types';

function manageMoney(e: EventRow, msg: string): string {
  return `/manage/${e.slug}?${new URLSearchParams({ key: e.admin_key, tab: 'money', msg }).toString()}`;
}

async function organizer(fd: FormData): Promise<EventRow> {
  const event = await getEventBySlug(text(fd.get('slug'), 100));
  if (!event || !(await canManage(event, text(fd.get('key'), 100)))) {
    throw new Error('You don’t have organizer access to this event.');
  }
  return event;
}

/* ---------- organizer: connect Stripe ---------- */

/** Starts (or resumes) Stripe setup for this event's organizer. */
export async function connectStripe(fd: FormData) {
  const event = await organizer(fd);
  if (!stripeConfigured()) redirect(manageMoney(event, 'Card payments aren’t switched on yet.'));
  const user = await currentUser();
  const saved = user ? await one<{ stripe_account_id: string }>('SELECT stripe_account_id FROM users WHERE id=$1', [user.id]) : null;

  let accountId = event.stripe_account_id || saved?.stripe_account_id || '';
  let url = '';
  try {
    if (!accountId) {
      const account = await stripe().accounts.create({
        type: 'standard',
        email: user?.email || event.contact_email || undefined,
        business_profile: { name: event.charity || event.name },
        metadata: { event_slug: event.slug },
      });
      accountId = account.id;
    }
    await query('UPDATE events SET stripe_account_id=$1 WHERE id=$2', [accountId, event.id]);
    if (user && !saved?.stripe_account_id) {
      await query('UPDATE users SET stripe_account_id=$1 WHERE id=$2', [accountId, user.id]);
    }
    const account = await stripe().accounts.retrieve(accountId);
    if (account.charges_enabled) {
      await query('UPDATE events SET stripe_ready=TRUE WHERE id=$1', [event.id]);
    } else {
      const origin = await siteOrigin();
      const back = `${origin}/manage/${event.slug}?key=${encodeURIComponent(event.admin_key)}&tab=money&stripe=back`;
      const link = await stripe().accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        refresh_url: back,
        return_url: back,
      });
      url = link.url;
    }
  } catch (e) {
    console.error('connectStripe', e);
    redirect(manageMoney(event, 'Stripe didn’t respond. Please try again in a minute.'));
  }
  revalidatePath(`/e/${event.slug}`);
  redirect(url || manageMoney(event, 'Card payments are on.'));
}

/** Stops card payments for this event. The Stripe account itself stays the organizer's. */
export async function disconnectStripe(fd: FormData) {
  const event = await organizer(fd);
  await query(`UPDATE events SET stripe_account_id='', stripe_ready=FALSE WHERE id=$1`, [event.id]);
  revalidatePath(`/e/${event.slug}`);
  redirect(manageMoney(event, 'Card payments turned off for this event.'));
}

/* ---------- public: pay and give ---------- */

async function checkout(
  event: EventRow,
  opts: { kind: 'entry' | 'donation'; amount: number; label: string; teamId?: number | null; playerId?: number | null; donor?: string; back: string },
): Promise<string> {
  const origin = await siteOrigin();
  const meta = {
    kind: opts.kind,
    event_id: String(event.id),
    team_id: opts.teamId ? String(opts.teamId) : '',
    player_id: opts.playerId ? String(opts.playerId) : '',
    donor_name: (opts.donor ?? '').slice(0, 80),
  };
  const session = await stripe().checkout.sessions.create(
    {
      mode: 'payment',
      submit_type: opts.kind === 'donation' ? 'donate' : 'pay',
      line_items: [
        {
          quantity: 1,
          price_data: { currency: 'usd', unit_amount: opts.amount, product_data: { name: opts.label.slice(0, 250) } },
        },
      ],
      metadata: meta,
      payment_intent_data: { description: `${opts.label} · ${event.name}`.slice(0, 500), metadata: meta },
      success_url: `${origin}${opts.back}${opts.back.includes('?') ? '&' : '?'}paid=${opts.kind}`,
      cancel_url: `${origin}${opts.back}`,
    },
    { stripeAccount: event.stripe_account_id },
  );
  return session.url!;
}

async function payableEvent(fd: FormData): Promise<EventRow> {
  const event = await getEventBySlug(text(fd.get('slug'), 100));
  if (!event) throw new Error('Event not found.');
  if (!stripeConfigured() || !event.stripe_account_id || !event.stripe_ready) {
    redirect(`/e/${event.slug}?err=${encodeURIComponent('Card payments aren’t set up for this event.')}`);
  }
  if (!(await allow(`pay:${event.id}:${await clientIp()}`, 20, 10))) {
    redirect(`/e/${event.slug}?err=${encodeURIComponent('Too many tries. Please wait a few minutes.')}`);
  }
  return event;
}

/** Pays a solo player's or a registered team's entry fee by card. */
export async function payEntry(fd: FormData) {
  const event = await payableEvent(fd);
  const id = toInt(fd.get('id'), 0, 0, 1e9);
  const isTeam = text(fd.get('what'), 10) === 'team';
  const back = `/e/${event.slug}`;
  let amount = 0;
  let label = '';
  if (isTeam) {
    const t = await one<{ name: string; paid: boolean }>('SELECT name, paid FROM teams WHERE id=$1 AND event_id=$2', [id, event.id]);
    if (!t) throw new Error('Team not found.');
    if (t.paid) redirect(`${back}?paid=already`);
    amount = event.team_fee;
    label = `Team entry fee: ${t.name}`;
  } else {
    const p = await one<{ name: string; paid: boolean }>('SELECT name, paid FROM players WHERE id=$1 AND event_id=$2', [id, event.id]);
    if (!p) throw new Error('Player not found.');
    if (p.paid) redirect(`${back}?paid=already`);
    amount = event.solo_fee;
    label = `Entry fee: ${p.name}`;
  }
  if (amount < 50) redirect(`${back}?err=${encodeURIComponent('This event has no entry fee to pay.')}`);
  let url = '';
  try {
    url = await checkout(event, { kind: 'entry', amount, label, teamId: isTeam ? id : null, playerId: isTeam ? null : id, back });
  } catch (e) {
    console.error('payEntry', e);
    redirect(`${back}?err=${encodeURIComponent('Card payment couldn’t start. Please try again.')}`);
  }
  redirect(url);
}

/** A gift to the event, a team, or one person. */
export async function giveByCard(fd: FormData) {
  const event = await payableEvent(fd);
  const amount = toCents(fd.get('amount_other')) || toCents(fd.get('amount'));
  const back = text(fd.get('back'), 200);
  const safeBack = back.startsWith(`/e/${event.slug}`) ? back : `/e/${event.slug}`;
  if (amount < MIN_GIFT || amount > MAX_GIFT) {
    redirect(`${safeBack}${safeBack.includes('?') ? '&' : '?'}err=${encodeURIComponent(`Please give between ${money(MIN_GIFT)} and ${money(MAX_GIFT)}.`)}`);
  }
  let teamId: number | null = toInt(fd.get('team_id'), 0, 0, 1e9) || null;
  let playerId: number | null = toInt(fd.get('player_id'), 0, 0, 1e9) || null;
  let label = `Gift to ${event.charity || event.name}`;
  if (playerId) {
    const p = await one<{ name: string }>('SELECT name FROM players WHERE id=$1 AND event_id=$2', [playerId, event.id]);
    if (!p) playerId = null;
    else label = `Gift supporting ${p.name}`;
    teamId = null;
  } else if (teamId) {
    const t = await one<{ name: string }>('SELECT name FROM teams WHERE id=$1 AND event_id=$2', [teamId, event.id]);
    if (!t) teamId = null;
    else label = `Gift supporting ${t.name}`;
  }
  let url = '';
  try {
    url = await checkout(event, { kind: 'donation', amount, label, teamId, playerId, donor: text(fd.get('donor'), 80), back: safeBack });
  } catch (e) {
    console.error('giveByCard', e);
    redirect(`${safeBack}${safeBack.includes('?') ? '&' : '?'}err=${encodeURIComponent('Card payment couldn’t start. Please try again.')}`);
  }
  redirect(url);
}
