import type {
  CSSOptions,
  PluginOption,
  ResolveModulePreloadDependenciesFn,
  UserConfig,
} from 'vite';

import type { DefineApplicationOptions } from '../typing';

import path, { relative } from 'node:path';

import { findMonorepoRoot } from '@vben/node-utils';

import { NodePackageImporter } from 'sass';
import { defineConfig, loadEnv, mergeConfig } from 'vite';

import { defaultImportmapOptions, getDefaultPwaOptions } from '../options';
import { loadApplicationPlugins } from '../plugins';
import { loadAndConvertEnv } from '../utils/env';
import { getCommonConfig } from './common';

function defineApplicationConfig(userConfigPromise?: DefineApplicationOptions) {
  return defineConfig(async (config) => {
    const options = await userConfigPromise?.(config);
    const { appTitle, base, port, ...envConfig } = await loadAndConvertEnv();
    const { command, mode } = config;
    const { application = {}, vite = {} } = options || {};
    const root = process.cwd();
    const isBuild = command === 'build';
    const env = loadEnv(mode, root);

    const plugins = await loadApplicationPlugins({
      archiver: true,
      archiverPluginOptions: {},
      compress: false,
      compressTypes: ['brotli', 'gzip'],
      devtools: true,
      env,
      extraAppConfig: true,
      html: true,
      i18n: true,
      importmapOptions: defaultImportmapOptions,
      injectAppLoading: true,
      injectMetadata: true,
      isBuild,
      license: true,
      mode,
      nitroMock: !isBuild,
      nitroMockOptions: {},
      print: !isBuild,
      printInfoMap: {
        'Vben Admin Docs': 'https://doc.vben.pro',
      },
      pwa: true,
      pwaOptions: getDefaultPwaOptions(appTitle),
      vxeTableLazyImport: true,
      ...envConfig,
      ...application,
    });

    const { injectGlobalScss = true } = application;

    const applicationConfig: UserConfig = {
      base,
      build: {
        modulePreload: {
          resolveDependencies: filterLazyInitialPreloadDependencies,
        },
        rollupOptions: {
          output: {
            assetFileNames: '[ext]/[name]-[hash].[ext]',
            chunkFileNames: 'js/[name]-[hash].js',
            entryFileNames: 'jse/index-[name]-[hash].js',
            manualChunks: createManualChunks,
          },
        },
        target: 'es2015',
      },
      css: createCssOptions(injectGlobalScss),
      esbuild: {
        drop: isBuild
          ? [
              // 'console',
              'debugger',
            ]
          : [],
        legalComments: 'none',
      },
      plugins: [...plugins, viteStripLazyInitialPreloadPlugin()],
      server: {
        host: true,
        port,
        warmup: {
          // 预热文件
          clientFiles: [
            './index.html',
            './src/bootstrap.ts',
            './src/{views,layouts,router,store,api,adapter}/*',
          ],
        },
      },
    };

    const mergedCommonConfig = mergeConfig(
      await getCommonConfig(),
      applicationConfig,
    );
    return mergeConfig(mergedCommonConfig, vite);
  });
}

function createManualChunks(id: string) {
  const normalizedId = id.replaceAll('\\', '/');

  if (normalizedId.includes('/node_modules/@univerjs/')) {
    if (normalizedId.includes('/locales/')) {
      return 'vendor-univer-locales';
    }
    return 'vendor-univer';
  }

  if (normalizedId.includes('/node_modules/exceljs/')) {
    return 'vendor-exceljs';
  }

  if (normalizedId.includes('/node_modules/html2canvas/')) {
    return 'vendor-html2canvas';
  }

  if (normalizedId.includes('/node_modules/jspdf/')) {
    return 'vendor-jspdf';
  }

  if (normalizedId.includes('/node_modules/echarts/')) {
    return 'vendor-echarts';
  }

  if (normalizedId.includes('/node_modules/vxe-table/')) {
    return 'vendor-vxe-table';
  }
}

const LAZY_INITIAL_PRELOAD_PATTERNS = [
  'vendor-echarts-',
  'vendor-exceljs-',
  'vendor-html2canvas-',
  'vendor-jspdf-',
  'vendor-univer-',
  'vendor-univer-locales-',
  'vendor-vxe-table-',
] as const;

const filterLazyInitialPreloadDependencies: ResolveModulePreloadDependenciesFn =
  (_filename, deps) => deps.filter((dep) => !isLazyInitialPreloadAsset(dep));

function isLazyInitialPreloadAsset(asset: string) {
  return LAZY_INITIAL_PRELOAD_PATTERNS.some((pattern) =>
    asset.includes(pattern),
  );
}

function stripLazyInitialAssetLinks(html: string) {
  return html.replaceAll(/<link\b[^>]*>/gi, (tag) => {
    const isPreloadOrStyle =
      /\brel=(?:"modulepreload"|'modulepreload'|modulepreload|"stylesheet"|'stylesheet'|stylesheet)/i.test(
        tag,
      );

    if (!isPreloadOrStyle) {
      return tag;
    }

    return isLazyInitialPreloadAsset(tag) ? '' : tag;
  });
}

function viteStripLazyInitialPreloadPlugin(): PluginOption {
  return {
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = bundle['index.html'];
      if (htmlAsset?.type !== 'asset' || typeof htmlAsset.source !== 'string') {
        return;
      }

      htmlAsset.source = stripLazyInitialAssetLinks(htmlAsset.source);
    },
    name: 'vben:strip-lazy-initial-preloads',
  };
}

function createCssOptions(injectGlobalScss = true): CSSOptions {
  const root = findMonorepoRoot();
  return {
    preprocessorOptions: injectGlobalScss
      ? {
          scss: {
            additionalData: (content: string, filepath: string) => {
              const relativePath = relative(root, filepath);
              // apps下的包注入全局样式
              if (relativePath.startsWith(`apps${path.sep}`)) {
                return `@use "@vben/styles/global" as *;\n${content}`;
              }
              return content;
            },
            api: 'modern',
            importers: [new NodePackageImporter()],
          },
        }
      : {},
  };
}

export { defineApplicationConfig };
