'use client';

import { useState } from 'react';

type Item = { slug: string; lat: number | null; lng: number | null };

function miles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * "Near me": asks for the phone's location (it stays on the phone),
 * then re-orders the event cards by distance and shows how far each is.
 */
export default function NearMe({ items }: { items: Item[] }) {
  const [state, setState] = useState<'idle' | 'busy' | 'on' | 'denied' | 'none'>('idle');

  function sortCards(lat: number, lng: number) {
    const list = document.getElementById('event-list');
    if (!list) return;
    const dist = new Map<string, number>();
    for (const it of items) if (it.lat !== null && it.lng !== null) dist.set(it.slug, miles(lat, lng, it.lat, it.lng));
    const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-slug]'));
    cards.sort((a, b) => (dist.get(a.dataset.slug!) ?? 1e9) - (dist.get(b.dataset.slug!) ?? 1e9));
    for (const c of cards) {
      list.appendChild(c);
      const d = dist.get(c.dataset.slug!);
      const tag = c.querySelector<HTMLElement>('[data-distance]');
      if (tag) tag.textContent = d === undefined ? '' : `📍 ${d < 10 ? d.toFixed(1) : Math.round(d)} mi away`;
    }
  }

  function go() {
    if (!('geolocation' in navigator)) return setState('none');
    setState('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sortCards(pos.coords.latitude, pos.coords.longitude);
        setState('on');
      },
      () => setState('denied'),
      { maximumAge: 600000, timeout: 10000 },
    );
  }

  return (
    <div className="btn-row">
      <button type="button" className="btn secondary small" onClick={go} disabled={state === 'busy'}>
        {state === 'busy' ? 'Finding you…' : state === 'on' ? '✓ Sorted by distance' : '📍 Near me'}
      </button>
      {state === 'denied' && <span className="small muted">Location is off. Turn it on in your browser settings to sort by distance.</span>}
      {state === 'none' && <span className="small muted">This browser can’t share location.</span>}
    </div>
  );
}
