import { headers } from 'next/headers';
import { streamInfo } from '@/lib/stream';

/** "Watch live" box: plays YouTube/Twitch on the page, links out for others. */
export default async function StreamBox({ url, title, giveUrl }: { url: string; title: string; giveUrl?: string }) {
  const h = await headers();
  const info = streamInfo(url, h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost');
  if (!info) return null;
  return (
    <div className="card stream">
      <h2>
        <span className="live-dot" aria-hidden="true" /> Watch live{title ? `: ${title}` : ''}
      </h2>
      {info.embed ? (
        <div className="video">
          <iframe
            src={info.embed}
            title={`Live stream${title ? `: ${title}` : ''}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <a className="btn secondary small" href={info.url} target="_blank" rel="noopener noreferrer">
          Open on {info.label}
        </a>
        {giveUrl && (
          <a className="btn small" href={giveUrl} target="_blank" rel="noopener noreferrer">
            Give while you watch
          </a>
        )}
      </div>
    </div>
  );
}
