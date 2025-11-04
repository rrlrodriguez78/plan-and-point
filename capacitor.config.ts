import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.virtualtour360simba',
  appName: 'virtual-tour-360-simba',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    // 🆕 FASE 3: Configuración adicional para Android
    appendUserAgent: 'VirtualTour360/1.0'
  },
  ios: {
    contentInset: 'always'
  },
  plugins: {
    Filesystem: {
      androidDisplayName: 'VirtualTour360',
      // 🆕 FASE 3: Forzar almacenamiento externo en iOS
      iosFallbackToDocuments: true
    }
  }
};

export default config;
