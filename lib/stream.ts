/** Turns a stream link into something we can embed, when the site allows it. */
export type StreamInfo = { url: string; label: string; embed: string | null };

export function streamInfo(raw: string, host: string): StreamInfo | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const h = u.hostname.replace(/^www\.|^m\./, '');
  const parent = host.split(':')[0];

  if (h === 'youtube.com' || h === 'youtu.be') {
    let id = '';
    if (h === 'youtu.be') id = u.pathname.slice(1);
    else if (u.pathname.startsWith('/watch')) id = u.searchParams.get('v') ?? '';
    else if (/^\/(live|embed|shorts)\//.test(u.pathname)) id = u.pathname.split('/')[2] ?? '';
    id = id.replace(/[^A-Za-z0-9_-]/g, '');
    return { url: raw, label: 'YouTube', embed: id ? `https://www.youtube-nocookie.com/embed/${id}` : null };
  }
  if (h === 'twitch.tv') {
    const channel = u.pathname.split('/')[1]?.replace(/[^A-Za-z0-9_]/g, '');
    return {
      url: raw,
      label: 'Twitch',
      embed: channel ? `https://player.twitch.tv/?channel=${channel}&parent=${encodeURIComponent(parent)}&muted=true` : null,
    };
  }
  if (h === 'facebook.com' || h === 'fb.watch') return { url: raw, label: 'Facebook', embed: null };
  return { url: raw, label: 'the stream', embed: null };
}
