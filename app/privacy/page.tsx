import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDraftNote from '@/app/LegalDraftNote';

export const metadata: Metadata = { title: 'Privacy policy' };

const SUPPORT = 'support@ginamakes.app';

export default function PrivacyPage() {
  return (
    <article className="legal">
      <h1>Privacy policy</h1>
      <LegalDraftNote updated="November 7, 2026" />
      <p>
        Charity Event Kit (“the app”) is made by Gina Makes LLC, Altoona, Iowa (“we”). This policy explains what we collect,
        why, and the choices you have. It covers the website at eventkit.ginamakes.app and the Event Kit iPhone app.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your name, email, and password. Passwords are stored only as a secure hash — we can’t see them.</li>
        <li><b>Sign-up details you give an event:</b> name, email, position, skill level, team choice, jersey size and number, who you’re playing in honor of, fundraising goal, and your own fundraising link.</li>
        <li><b>Event activity:</b> teams, scores, check-in, whether an organizer marked you paid, money raised (as entered by you or the organizer), goal pledges, auction bids, volunteer shifts, and award votes.</li>
        <li><b>Waiver agreement:</b> if an event has a waiver, we record that you agreed and when.</li>
        <li><b>Alerts:</b> if you turn on game alerts, we store a notification address from your browser or iPhone so we can send them.</li>
        <li><b>Technical data:</b> your IP address, kept for about a day to stop spam and repeated password guessing.</li>
      </ul>
      <p>
        <b>What we don’t collect:</b> payment card or bank details. Entry fees and gifts are paid on the organizer’s own payment
        page (for example Zeffy or Givebutter), under that site’s privacy policy. “Near me” uses your location only on your
        device to sort events; it is never sent to us.
      </p>

      <h2>Who can see what</h2>
      <ul>
        <li><b>Everyone</b> can see an event’s public page, including names on team rosters, “playing in honor of” notes, scores, and fundraising totals.</li>
        <li><b>Event organizers</b> can see the details you give their event, including your email, skill level, waiver status, and payment status. Organizers may download their event’s roster.</li>
        <li><b>We</b> don’t sell your information or use it for advertising.</li>
      </ul>

      <h2>Services we use</h2>
      <p>
        Vercel (hosting), Neon (database), Resend (email), Apple and browser push services (alerts), and OpenStreetMap
        (turning an event’s location into map coordinates). Live streams are embedded from YouTube or Twitch, which have their
        own privacy policies.
      </p>

      <h2>Cookies</h2>
      <p>We use a sign-in cookie to keep you logged in and a cookie that keeps award voting to one vote per person. We don’t use advertising or tracking cookies.</p>

      <h2>Your choices</h2>
      <ul>
        <li><b>Change or cancel a sign-up</b> anytime in <Link href="/account">My events</Link>.</li>
        <li><b>Delete your account</b> in <Link href="/account/settings">Account settings</Link>. Your login is deleted right away. Your name may stay on rosters of events you joined (the organizer’s records), but your email is removed.</li>
        <li><b>Turn off alerts</b> on the event page or in your phone’s settings.</li>
        <li>For anything else, email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>.</li>
      </ul>

      <h2>Children</h2>
      <p>The app is not meant for children under 13, and we don’t knowingly collect their information. Organizers who sign up minors are responsible for having a parent or guardian’s permission.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we’ll update the date above and, for big changes, let account holders know.</p>
      <p className="small muted">© 2026 Gina Makes LLC</p>
    </article>
  );
}
