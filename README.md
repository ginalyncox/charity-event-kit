# Charity Event Kit

Sign-ups, fair teams, brackets, leaderboards, and pledge tracking for charity events.
A tool by **Gina Makes** — Games, tools, and curious creations.

## Event types

| Type | For | What you get |
|---|---|---|
| **Bracket** | Hockey, cornhole, softball, basketball, kickball | Guaranteed games, live standings, automatic playoffs |
| **Leaderboard** | Golf scrambles, fishing, bowling, trivia | Team scores ranked high-to-low or low-to-high |
| **Pledge** | Bike rides, walks, runs | Personal goals, money raised, distance, team totals |

## How sign-ups work

- **Whole teams** register together (captain + member list).
- **Solo players** pick a team (for example, a branch of service) or choose
  “Put me where I’m needed.”
- **Balance teams** places flexible players: key positions (like goalies) are
  spread out first, then players by skill so teams come out even. Players who
  picked a team, came with a team, or were moved by hand (🔒) stay put.

## Money

Charity Event Kit never holds money. Organizers paste their own payment link
(Zeffy, RegFox, Givebutter, and so on) and tap **Mark paid**.

## Accounts

- **Organizers** create an account (email + password) to make events. Their
  events appear under **My events** with a Manage button.
- **Players** can sign up for events with or without an account. With an
  account, **My events** shows their team, teammates, games, and payment status.
  Earlier sign-ups made with the same email are linked automatically.
- Each event also has a private organizer link for co-organizers. Anyone with
  that link can manage the event, so don't post it publicly.
- Passwords are hashed with scrypt; sessions are httpOnly cookies (30 days).

## Features

- **Events:** bracket, leaderboard, and pledge types; copy last year's event in one tap; co-organizers.
- **Sign-ups:** solo or whole team, team choice (like branch of service), positions, skill, jersey size and number, waiver, spam guards.
- **Game day:** big-button scorekeeper, live/final games, auto-updating pages, TV scoreboard with QR code, live stream embeds.
- **Fundraising:** event goal, team and personal pages with their own pay links, pledge per goal, silent auction, sponsors.
- **Organizer tools:** roster download, check-in, message everyone, volunteer shifts, awards voting, printable impact report.
- **Players:** My events, edit or cancel sign-up, add to calendar, history and badges, game alerts.
- **Accounts:** email + password, password reset (needs email set up), login limits, delete my account.
- **Installable app:** home-screen app with push alerts for game starts, goals, and finals.

## Settings (Vercel environment variables)

| Name | What it does |
|---|---|
| `DATABASE_URL` | Neon Postgres connection (required) |
| `RESEND_API_KEY`, `MAIL_FROM` | Turns on password reset and organizer messages |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Turns on push alerts |
| `SITE_URL` | Optional: the public address used in emails |

Not built yet: email verification.

## Run locally

```bash
npm install
npm run dev
```

With no `DATABASE_URL`, the app uses an embedded database stored in `./.data/`.

## Deploy (Vercel + Neon)

1. Import this repo into Vercel.
2. Add `DATABASE_URL` (a Neon Postgres connection string) as an environment variable.
3. Deploy. Tables are created automatically on first request.
4. Live at https://eventkit.ginamakes.app (CNAME `eventkit` in Squarespace DNS → Vercel).

## Status

Version 0.1 — a working first version. Terms of use and a privacy policy have
not been written or reviewed yet; get a professional review before collecting
real sign-ups.

© 2026 Gina Makes LLC · Altoona, Iowa. All rights reserved.
