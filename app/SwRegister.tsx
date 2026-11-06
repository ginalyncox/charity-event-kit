'use client';

import { useEffect } from 'react';

/** Registers the service worker so the app can be installed and show alerts. */
export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
