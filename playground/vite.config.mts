import type { DefineApplicationOptions } from '@vben/vite-config/src/typing';

import { defineConfig } from '@vben/vite-config';

const createConfig: DefineApplicationOptions = async () => {
  return {
    application: {},
    vite: {
      envPrefix: ['VITE_'],
      optimizeDeps: {
        exclude: [
          '@capacitor/core',
          '@capacitor/filesystem',
          '@capacitor/geolocation',
        ],
      },
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://localhost:5320/api',
            ws: true,
          },
        },
      },
    },
  };
};

export default defineConfig(createConfig) as unknown;
