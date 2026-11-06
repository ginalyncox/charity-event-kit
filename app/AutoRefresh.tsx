'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-fetches the page's data every few seconds so scores stay live.
 * Pauses while the tab is hidden or while someone is typing in a form.
 */
export default function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let lastTyped = 0;
    const onInput = () => {
      lastTyped = Date.now();
    };
    document.addEventListener('input', onInput, true);
    const id = window.setInterval(() => {
      const busy =
        Date.now() - lastTyped < 120_000 ||
        (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));
      if (document.visibilityState === 'visible' && !busy) router.refresh();
    }, seconds * 1000);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('input', onInput, true);
    };
  }, [router, seconds]);
  return null;
}
