import { revalidatePath } from 'next/cache';
import type Stripe from 'stripe';
import { one, query } from '@/lib/db';
import { stripe, stripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Stripe tells us when a card payment on an organizer's connected account finishes.
 * Entry fees mark the person or team paid; gifts add to their raised total.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) return new Response('Not configured', { status: 503 });
  const body = await req.text();
  let evt: Stripe.Event;
  try {
    evt = stripe().webhooks.constructEvent(body, req.headers.get('stripe-signature') ?? '', secret);
  } catch {
    return new Response('Bad signature', { status: 400 });
  }

  if (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') {
    const s = evt.data.object as Stripe.Checkout.Session;
    if (s.payment_status === 'paid') await record(s, evt.account ?? '');
  } else if (evt.type === 'account.updated') {
    const a = evt.data.object as Stripe.Account;
    const rows = await query<{ slug: string }>('UPDATE events SET stripe_ready=$1 WHERE stripe_account_id=$2 RETURNING slug', [
      Boolean(a.charges_enabled),
      a.id,
    ]);
    for (const r of rows) revalidatePath(`/e/${r.slug}`);
  }
  return Response.json({ received: true });
}

async function record(s: Stripe.Checkout.Session, account: string) {
  const m = s.metadata ?? {};
  const eventId = Number(m.event_id);
  if (!eventId || (m.kind !== 'entry' && m.kind !== 'donation')) return;
  const event = await one<{ id: number; slug: string; stripe_account_id: string }>(
    'SELECT id, slug, stripe_account_id FROM events WHERE id=$1',
    [eventId],
  );
  // Only trust payments made on the account this event is connected to.
  if (!event || !account || event.stripe_account_id !== account) return;

  const teamId = Number(m.team_id) || null;
  const playerId = Number(m.player_id) || null;
  const amount = Number(s.amount_total ?? 0);
  // Stripe can send the same event twice; the session id makes this run once.
  const fresh = await one(
    `INSERT INTO online_payments (session_id, event_id, kind, team_id, player_id, amount, donor_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (session_id) DO NOTHING RETURNING session_id`,
    [s.id, event.id, m.kind, teamId, playerId, amount, String(m.donor_name ?? '').slice(0, 80)],
  );
  if (!fresh) return;

  if (m.kind === 'entry') {
    if (teamId) await query('UPDATE teams SET paid=TRUE WHERE id=$1 AND event_id=$2', [teamId, event.id]);
    if (playerId) await query('UPDATE players SET paid=TRUE WHERE id=$1 AND event_id=$2', [playerId, event.id]);
  } else if (playerId) {
    await query('UPDATE players SET raised = raised + $1 WHERE id=$2 AND event_id=$3', [amount, playerId, event.id]);
  } else if (teamId) {
    await query('UPDATE teams SET raised = raised + $1 WHERE id=$2 AND event_id=$3', [amount, teamId, event.id]);
  }
  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/manage/${event.slug}`);
}
