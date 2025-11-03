import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.virtualtour360simba',
  appName: 'virtual-tour-360-simba',
  webDir: 'dist',
  server: {
    url: 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;
