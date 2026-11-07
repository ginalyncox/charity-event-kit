import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Support' };

const SUPPORT = 'support@ginamakes.app';

export default function SupportPage() {
  return (
    <article className="legal">
      <h1>Support</h1>
      <p>Need help with Charity Event Kit? Email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> and we’ll get back to you.</p>
      <p className="small muted">Questions about a specific event — dates, refunds, teams — go to that event’s organizer. Their email is at the bottom of the event page.</p>

      <h2>Common questions</h2>
      <h3>I forgot my password</h3>
      <p>Use <Link href="/forgot">Forgot your password?</Link> on the log-in page.</p>
      <h3>How do I change or cancel my sign-up?</h3>
      <p>Log in, open <Link href="/account">My events</Link>, and tap “Change or cancel my sign-up.” If you paid, ask the organizer about a refund.</p>
      <h3>How do I pay?</h3>
      <p>Payments go straight to the organizer’s payment page — use the Pay or Give button on the event. Charity Event Kit never handles money.</p>
      <h3>How do I get game alerts?</h3>
      <p>Open a tournament’s page and tap “Get alerts.” On iPhone, add the site to your Home Screen first, or use the Event Kit app.</p>
      <h3>How do I delete my account?</h3>
      <p>Go to <Link href="/account/settings">Account settings</Link> and choose Delete my account.</p>
      <h3>I’m an organizer — how do I start?</h3>
      <p><Link href="/signup?next=/new">Create an account</Link>, then create your event. You can make it public on <Link href="/events">Browse events</Link> or keep it link-only.</p>

      <p><Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of use</Link></p>
      <p className="small muted">Charity Event Kit · A tool by Gina Makes · © 2026 Gina Makes LLC · Altoona, Iowa</p>
    </article>
  );
}
