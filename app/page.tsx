import Link from 'next/link';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      {sp.deleted && <div className="notice good">Your account was deleted.</div>}
      <section className="hero">
        <p className="eyebrow">For charity tournaments, rides, and walks</p>
        <h1>Run your charity event without the spreadsheet.</h1>
        <p className="lead">
          One page for sign-ups, fair teams, game schedules, scoreboards, and fundraising totals. Players sign up on their
          phone. You run the day from yours.
        </p>
        <div className="btn-row">
          <Link href="/new" className="btn">Create an event</Link>
          <Link href="/events" className="btn secondary">Browse events</Link>
          <a href="#how" className="btn secondary">How it works</a>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginTop: 24 }}>
        <div className="card type-card">
          <h3>🏒 Bracket</h3>
          <p className="muted">Teams play each other: hockey, cornhole, softball, basketball, kickball.</p>
          <p className="small">Guaranteed games, live standings, and playoffs that build themselves.</p>
        </div>
        <div className="card type-card">
          <h3>⛳ Leaderboard</h3>
          <p className="muted">Teams post a score: golf scrambles, fishing, bowling, trivia nights.</p>
          <p className="small">Lowest strokes or biggest catch — you pick which way wins.</p>
        </div>
        <div className="card type-card">
          <h3>🚴 Pledge</h3>
          <p className="muted">People raise money: bike rides, walks, runs.</p>
          <p className="small">Personal goals, team totals, and miles, all on one board.</p>
        </div>
      </section>

      <section id="how" className="card">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <div>
              <b>Create your event.</b> Pick the sport or activity and it fills in sensible settings.
            </div>
          </li>
          <li>
            <div>
              <b>Share the sign-up link.</b> Whole teams register together, or people sign up solo and pick a team — like
              their branch of service — or say “put me where I’m needed.”
            </div>
          </li>
          <li>
            <div>
              <b>Balance teams in one tap.</b> Goalies and other key positions are spread out first, then players by skill so
              teams come out even. Move anyone by hand.
            </div>
          </li>
          <li>
            <div>
              <b>Run the day.</b> Enter scores from your phone. Standings, playoffs, and leaderboards update for everyone.
            </div>
          </li>
        </ol>
      </section>

      <section className="card">
        <h2>Your money stays yours</h2>
        <p className="muted">
          Entry fees go straight to the payment page you already use — Zeffy, RegFox, Givebutter, or your own. Charity Event
          Kit never holds or touches the money. You just tap “Mark paid.”
        </p>
      </section>
    </>
  );
}
