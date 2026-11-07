'use client';

import { useEffect, useState } from 'react';

function keyBytes(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = 'loading' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'blocked' | 'error';

/** The iPhone app (Capacitor) exposes native push here. */
function nativePush(): any | null {
  const cap = (window as any).Capacitor;
  return cap?.isNativePlatform?.() && cap?.Plugins?.PushNotifications ? cap.Plugins.PushNotifications : null;
}

function nativeToken(push: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false;
    push.addListener('registration', (t: { value: string }) => {
      if (!done) { done = true; resolve(t.value); }
    });
    push.addListener('registrationError', (e: any) => {
      if (!done) { done = true; reject(e); }
    });
    push.register();
    setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); } }, 15000);
  });
}

/** "Get alerts" for an event or one team: game starts, goals, and finals. */
export default function AlertsButton({ slug, teams, publicKey }: { slug: string; teams: { id: number; name: string }[]; publicKey: string }) {
  const [state, setState] = useState<State>('loading');
  const [teamId, setTeamId] = useState('');
  const storeKey = `cek-alerts-${slug}`;

  useEffect(() => {
    if (nativePush()) {
      let saved = '';
      try { saved = localStorage.getItem(storeKey) ?? ''; } catch {}
      if (saved) { setTeamId(saved === 'all' ? '' : saved); setState('on'); } else setState('off');
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState(ios && !standalone ? 'ios-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') return setState('blocked');
    let saved = '';
    try {
      saved = localStorage.getItem(storeKey) ?? '';
    } catch {}
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub && saved) {
          setTeamId(saved === 'all' ? '' : saved);
          setState('on');
        } else setState('off');
      })
      .catch(() => setState('off'));
  }, [storeKey]);

  async function turnOn() {
    const push = nativePush();
    if (push) {
      try {
        const perm = await push.requestPermissions();
        if (perm.receive !== 'granted') return setState('blocked');
        const token = await nativeToken(push);
        const res = await fetch('/api/push/apns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, teamId: teamId || null, token }),
        });
        if (!res.ok) throw new Error('save failed');
        try { localStorage.setItem(storeKey, teamId || 'all'); localStorage.setItem('cek-apns-token', token); } catch {}
        return setState('on');
      } catch {
        return setState('error');
      }
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState(perm === 'denied' ? 'blocked' : 'off');
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, teamId: teamId || null, subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error('save failed');
      try {
        localStorage.setItem(storeKey, teamId || 'all');
      } catch {}
      setState('on');
    } catch {
      setState('error');
    }
  }

  async function turnOff() {
    if (nativePush()) {
      let token = '';
      try { token = localStorage.getItem('cek-apns-token') ?? ''; localStorage.removeItem(storeKey); } catch {}
      if (token) await fetch('/api/push/apns', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, token }) }).catch(() => {});
      return setState('off');
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, endpoint: sub.endpoint }) });
      try {
        localStorage.removeItem(storeKey);
      } catch {}
      setState('off');
    } catch {
      setState('error');
    }
  }

  if (state === 'loading') return null;
  return (
    <div className="card">
      <h2>🔔 Game alerts</h2>
      {state === 'ios-install' && (
        <p className="small muted">
          On iPhone: tap the Share button, then <b>Add to Home Screen</b>. Open Event Kit from your home screen, and you can
          turn on alerts here.
        </p>
      )}
      {state === 'unsupported' && <p className="small muted">This browser can’t show alerts. Try Chrome, Edge, or Safari on a newer phone.</p>}
      {state === 'blocked' && <p className="small muted">Alerts are blocked for this site. Turn them on in your browser or phone settings, then reload.</p>}
      {state === 'error' && <p className="small muted">Something went wrong turning on alerts. Please try again.</p>}
      {(state === 'off' || state === 'error') && (
        <div className="btn-row">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Which team" style={{ width: 'auto', flex: 1, minWidth: 160 }}>
            <option value="">All games</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name} only</option>)}
          </select>
          <button type="button" className="btn" onClick={turnOn}>Get alerts</button>
        </div>
      )}
      {state === 'on' && (
        <div className="btn-row">
          <span>✓ Alerts on for {teams.find((t) => String(t.id) === teamId)?.name ?? 'all games'}.</span>
          <button type="button" className="btn small secondary" onClick={turnOff}>Turn off</button>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>You’ll hear when games start, when goals are scored, and final scores.</p>
    </div>
  );
}
