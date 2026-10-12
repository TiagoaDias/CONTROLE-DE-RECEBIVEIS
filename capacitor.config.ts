import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.haspaho.recebiveispro',
  appName: 'Recebíveis e Parcelas',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
