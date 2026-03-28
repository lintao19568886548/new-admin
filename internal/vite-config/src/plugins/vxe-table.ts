import { findMonorepoRoot } from '@vben/node-utils';

import { lazyImport, VxeResolver } from 'vite-plugin-lazy-import';

function normalizeGlobPath(path: string) {
  return path.replaceAll('\\', '/');
}

function getVxeLazyImportInclude() {
  const root = normalizeGlobPath(findMonorepoRoot());
  const base = `${root}/packages/effects/plugins/src/vxe-table`;
  return [`${base}/**/*.ts`, `${base}/**/*.vue`];
}

async function viteVxeTableImportsPlugin() {
  const vxeLazyImport = lazyImport({
    include: getVxeLazyImportInclude(),
    resolvers: [
      VxeResolver({
        libraryName: 'vxe-table',
      }),
      VxeResolver({
        libraryName: 'vxe-pc-ui',
      }),
    ],
  });

  return [vxeLazyImport];
}

export { viteVxeTableImportsPlugin };
