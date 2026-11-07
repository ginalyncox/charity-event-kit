import 'server-only';
import { query } from './db';

/**
 * Finds map coordinates for an event's location text using OpenStreetMap's
 * free geocoder (best effort, US only). Only runs when the location changes.
 */
export async function geocodeEvent(eventId: number, location: string): Promise<void> {
  const text = location.trim();
  if (!text) {
    await query(`UPDATE events SET lat = NULL, lng = NULL, geo_for = '' WHERE id = $1`, [eventId]);
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CharityEventKit/1.0 (https://eventkit.ginamakes.app)' },
      signal: AbortSignal.timeout(4000),
    });
    const data = res.ok ? ((await res.json()) as { lat: string; lon: string }[]) : [];
    const hit = data[0];
    await query('UPDATE events SET lat = $1, lng = $2, geo_for = $3 WHERE id = $4', [
      hit ? Number(hit.lat) : null,
      hit ? Number(hit.lon) : null,
      text,
      eventId,
    ]);
  } catch {
    // Leave it; "near me" just won't place this event.
  }
}

/** Distance in miles between two points. */
export function miles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
