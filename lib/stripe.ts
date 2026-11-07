import 'server-only';
import Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { query } from './db';
import type { EventRow } from './types';

/**
 * Card payments through Stripe Connect.
 * Each organizer connects their own Stripe account; money goes straight to them.
 * Gina Makes never holds the money. Turns on when STRIPE_SECRET_KEY is set.
 */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Card payments aren’t switched on yet.');
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** True when the connected account can take card payments (Accounts v2). */
export async function cardsActive(accountId: string): Promise<boolean> {
  const account = await stripe().v2.core.accounts.retrieve(accountId, { include: ['configuration.merchant', 'requirements'] });
  return account.configuration?.merchant?.capabilities?.card_payments?.status === 'active';
}

/** Smallest and largest gift, in cents. */
export const MIN_GIFT = 100;
export const MAX_GIFT = 1_000_000;

/** Rechecks the account after the organizer comes back from Stripe. */
export async function refreshStripeStatus(event: EventRow): Promise<boolean> {
  if (!event.stripe_account_id || !stripeConfigured()) return false;
  try {
    const ready = await cardsActive(event.stripe_account_id);
    if (ready !== event.stripe_ready) {
      await query('UPDATE events SET stripe_ready=$1 WHERE id=$2', [ready, event.id]);
      revalidatePath(`/e/${event.slug}`);
    }
    return ready;
  } catch {
    return event.stripe_ready;
  }
}

