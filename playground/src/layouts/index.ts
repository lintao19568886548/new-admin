import { withRetryImport } from '#/utils/retry-import';

const BasicLayout = withRetryImport(() => import('./basic.vue'));
const AuthPageLayout = withRetryImport(() => import('./auth.vue'));

const IFrameView = withRetryImport(() =>
  import('@vben/layouts').then((m) => m.IFrameView),
);

export { AuthPageLayout, BasicLayout, IFrameView };
