export function money(cents: number | null | undefined): string {
  const n = Number(cents ?? 0) / 100;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
}

/** "$25", "25.50" → 2550 cents. Empty → 0. */
export function toCents(input: FormDataEntryValue | null): number {
  const s = String(input ?? '').replace(/[$,\s]/g, '');
  if (!s) return 0;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export function toInt(input: FormDataEntryValue | null, fallback = 0, min = 0, max = 10000): number {
  const n = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function toNum(input: FormDataEntryValue | null): number | null {
  const s = String(input ?? '').trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function text(input: FormDataEntryValue | null, max = 500): string {
  return String(input ?? '').trim().slice(0, max);
}

/** Only allow http(s) links, so a payment link can't be a script URL. */
export function safeUrl(input: FormDataEntryValue | null): string {
  const s = text(input, 1000);
  if (!s) return '';
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'event';
}

export function randomToken(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function feeLabel(event: { team_fee: number; solo_fee: number }): string {
  return [event.team_fee ? `${money(event.team_fee)} per team` : '', event.solo_fee ? `${money(event.solo_fee)} per player` : '']
    .filter(Boolean)
    .join(' · ');
}
