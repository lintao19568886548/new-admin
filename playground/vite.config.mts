import type { DefineApplicationOptions } from '@vben/vite-config/src/typing';

import process from 'node:process';

import { defineConfig } from '@vben/vite-config';

import { loadEnv } from 'vite';

const createConfig: DefineApplicationOptions = async (configEnv) => {
  const mode =
    configEnv?.mode ??
    process.env.MODE ??
    process.env.NODE_ENV ??
    'development';
  const mergedEnv = {
    ...loadEnv(mode, process.cwd(), ''),
    ...loadEnv('llmkey', process.cwd(), ''),
  };
  const aliyunKey =
    mergedEnv.ALIYUN_BAILIAN_KEY ?? process.env.ALIYUN_BAILIAN_KEY ?? '';

  return {
    application: {},
    vite: {
      define: {
        'import.meta.env.ALIYUN_BAILIAN_KEY': JSON.stringify(aliyunKey),
      },
      envPrefix: ['VITE_', 'ALIYUN_'],
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
