import type { UserConfig } from 'vite';

import path from 'node:path';

import { findMonorepoRoot } from '@vben/node-utils';

async function getCommonConfig(): Promise<UserConfig> {
  const root = findMonorepoRoot();
  return {
    build: {
      chunkSizeWarningLimit: 2000,
      reportCompressedSize: false,
      sourcemap: false,
    },
    resolve: {
      alias: [
        {
          find: /^@vben-core\/design$/,
          replacement: path.join(
            root,
            'packages/@core/base/design/src/index.ts',
          ),
        },
      ],
    },
  };
}

export { getCommonConfig };
