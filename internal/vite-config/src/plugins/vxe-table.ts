import type { PluginOption } from 'vite';

import { lazyImport, VxeResolver } from 'vite-plugin-lazy-import';

async function viteVxeTableImportsPlugin(): Promise<PluginOption[]> {
  const vxeLazyImport = lazyImport({
    resolvers: [
      VxeResolver({
        libraryName: 'vxe-table',
      }),
      VxeResolver({
        libraryName: 'vxe-pc-ui',
      }),
    ],
  }) as unknown as PluginOption;

  return [vxeLazyImport];
}

export { viteVxeTableImportsPlugin };
