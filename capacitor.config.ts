import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ulum.app',
  appName: 'Taqyeed AI',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#ffffff'
  },
  server: {
    cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#006239',
      showSpinner: false
    },
    Filesystem: {
      // No special config needed — uses app-internal directories by default
    },
  }
};

export default config;
