import type { CapacitorConfig } from '@capacitor/cli';

/**
 * iPhone app shell for Charity Event Kit.
 * The app loads the live site, so every web update reaches the app instantly.
 * capacitor-www/ holds only the offline fallback page.
 */
const config: CapacitorConfig = {
  appId: 'app.ginamakes.eventkit',
  appName: 'Event Kit',
  webDir: 'capacitor-www',
  server: {
    url: 'https://eventkit.ginamakes.app/account',
    errorPath: 'index.html',
    allowNavigation: ['eventkit.ginamakes.app'],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f7f4ee',
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
