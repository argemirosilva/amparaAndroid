import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9eae17f51a4049eabcb6887a2af1fbbc',
  appName: 'AMPARA',
  webDir: 'dist',
  server: {
    url: 'https://9eae17f5-1a40-49ea-bcb6-887a2af1fbbc.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a0a2e',
      showSpinner: false,
    },
  },
};

export default config;
