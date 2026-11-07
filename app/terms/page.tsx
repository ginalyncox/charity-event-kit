import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDraftNote from '@/app/LegalDraftNote';

export const metadata: Metadata = { title: 'Terms of use' };

export default function TermsPage() {
  return (
    <article className="legal">
      <h1>Terms of use</h1>
      <LegalDraftNote updated="November 7, 2026" />
      <p>
        These terms apply to Charity Event Kit, made by Gina Makes LLC, Altoona, Iowa. By using the app, you agree to them.
      </p>
      <h2>What the app does</h2>
      <p>
        Charity Event Kit is a tool that helps organizers run events: sign-ups, teams, schedules, scores, and fundraising
        tracking. <b>We are not the organizer of any event</b> and are not responsible for how events are run, for prizes, or
        for injuries.
      </p>
      <h2>Money</h2>
      <p>
        We never collect, hold, or move money. Entry fees, gifts, pledges, and auction payments go directly between people and
        the organizer, using the organizer’s own payment page. Organizers are responsible for their own fundraising, receipts,
        tax rules, raffle or auction rules, and refunds.
      </p>
      <h2>Organizers</h2>
      <ul>
        <li>You’re responsible for the accuracy of your event, any waiver you add, and following the laws that apply to it.</li>
        <li>Use attendees’ information only to run your event.</li>
        <li>Don’t post links or content that are misleading, harmful, or that you don’t have the right to share.</li>
      </ul>
      <h2>Everyone</h2>
      <ul>
        <li>Give accurate information and keep your password private.</li>
        <li>Don’t spam, cheat votes or bids, or try to access accounts or events that aren’t yours.</li>
        <li>We may remove content or accounts that break these terms.</li>
      </ul>
      <h2>No guarantees</h2>
      <p>
        The app is provided “as is.” We work to keep it running and accurate, but we can’t promise it will always be available
        or error-free. To the extent the law allows, Gina Makes LLC isn’t liable for indirect losses from using the app.
      </p>
      <h2>Licensing</h2>
      <p>Charity Event Kit is free to try during beta. Licensing for organizations is coming soon.</p>
      <h2>Contact</h2>
      <p>Questions? See <Link href="/support">Support</Link>. These terms are governed by the laws of Iowa.</p>
      <p className="small muted">© 2026 Gina Makes LLC</p>
    </article>
  );
}
