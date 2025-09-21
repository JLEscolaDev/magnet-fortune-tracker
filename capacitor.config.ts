import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.2595371f99774cf486ceec317d0c8ab5',
  appName: 'magnet-fortune-tracker',
  webDir: 'dist',
  server: {
    url: 'https://2595371f-9977-4cf4-86ce-ec317d0c8ab5.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;