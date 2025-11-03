import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.virtualtour360simba',
  appName: 'virtual-tour-360-simba',
  webDir: 'dist',
  android: {
    allowMixedContent: true
  },
  ios: {
    contentInset: 'always'
  },
  plugins: {
    Filesystem: {
      androidDisplayName: 'VirtualTour360'
    }
  }
};

export default config;
