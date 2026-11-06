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

## Organizer access

Each event gets a private organizer link with a secret key. Anyone with that
link can manage the event, so it should not be shared publicly. (Accounts and
logins are a future step.)

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
4. Add the custom domain (an `appname.ginamakes.app` subdomain) when ready.

## Status

Version 0.1 — a working first version. Terms of use and a privacy policy have
not been written or reviewed yet; get a professional review before collecting
real sign-ups.

© 2026 Gina Makes LLC · Altoona, Iowa. All rights reserved.
