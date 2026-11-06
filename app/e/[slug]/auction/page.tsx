import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { placeBid } from '@/lib/actions';
import { getBundle, getEventBySlug } from '@/lib/data';
import { money } from '@/lib/format';
import { nextBid } from '@/lib/pledges';
import AutoRefresh from '@/app/AutoRefresh';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  return { title: e ? `Silent auction · ${e.name}` : 'Not found' };
}

export default async function AuctionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  const { auction } = await getBundle(event);
  const user = await currentUser();

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <AutoRefresh seconds={15} />
      <p className="eyebrow">{event.name}</p>
      <h1>Silent auction</h1>
      <p className="muted">
        Highest bid wins when the organizer closes bidding. Winners pay the organizer directly.
        {!user && (
          <>
            {' '}
            <Link href={`/login?next=/e/${slug}/auction`}>Log in</Link> or <Link href={`/signup?next=/e/${slug}/auction`}>sign up</Link> to bid.
          </>
        )}
      </p>
      {sp.msg && <div className="notice info" role="status">{sp.msg}</div>}
      {auction.length === 0 && <div className="card"><p className="muted">No items yet. Check back soon.</p></div>}
      <div className="grid grid-2">
        {auction.map((i) => {
          const min = nextBid(i);
          const mine = user && i.high_user_id === user.id;
          return (
            <div key={i.id} id={`item-${i.id}`} className="card">
              <h3>{i.title}</h3>
              {i.donor && <p className="small muted">Donated by {i.donor}</p>}
              {i.description && <p className="small" style={{ whiteSpace: 'pre-line' }}>{i.description}</p>}
              <p style={{ margin: '8px 0' }}>
                {i.high_bid ? (
                  <>
                    {i.closed ? 'Sold for' : 'High bid'} <b style={{ fontSize: '1.3rem' }}>{money(i.high_bid)}</b>{' '}
                    <span className="small muted">({i.bid_count} bid{i.bid_count === 1 ? '' : 's'})</span>
                  </>
                ) : (
                  <>Starting bid <b>{money(Math.max(i.start_bid, 100))}</b></>
                )}
              </p>
              {mine && <p><span className="pill good">{i.closed ? 'You won!' : 'You’re the high bidder'}</span></p>}
              {i.closed ? (
                <span className="pill">Bidding closed</span>
              ) : user ? (
                <form action={placeBid} className="btn-row">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="item_id" value={i.id} />
                  <input name="amount" inputMode="decimal" defaultValue={(min / 100).toString()} aria-label={`Bid on ${i.title}`} style={{ width: 110 }} />
                  <button className="btn small">Bid</button>
                  <span className="small muted">Min {money(min)}</span>
                </form>
              ) : (
                <Link className="btn small secondary" href={`/login?next=/e/${slug}/auction`}>Log in to bid</Link>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 16 }}><Link href={`/e/${slug}`}>← Back to the event</Link></p>
    </div>
  );
}
