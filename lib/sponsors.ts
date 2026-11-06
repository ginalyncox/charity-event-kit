export type Sponsor = { name: string; url: string };

/** "Name" or "Name | https://site" per line. */
export function parseSponsors(text: string): Sponsor[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((l) => {
      const [name, url] = l.split('|').map((x) => x.trim());
      const safe = url && /^https?:\/\//i.test(url) ? url : '';
      return { name: name.slice(0, 80), url: safe };
    })
    .filter((s) => s.name);
}
