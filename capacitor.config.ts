import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crisferre80.lvnadmin',
  appName: 'LVN Diario Admin App',
  webDir: 'dist', // ✅ debe coincidir con tu output de Vite
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https' // 👈 importante para APIs modernas (geolocation, camera, etc.)
  },
  // Para evitar scroll en el body (mejor UX móvil)
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff'
    }
  }
};

export default config;
