'use client';

import { useEffect } from 'react';

/** Registers the service worker so the app can be installed and show alerts. */
export default function SwRegister() {
  useEffect(() => {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      // iPhone app: tapping an alert opens the right page.
      cap.Plugins?.PushNotifications?.addListener?.('pushNotificationActionPerformed', (a: any) => {
        const url = a?.notification?.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) window.location.href = url;
      });
      return;
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
