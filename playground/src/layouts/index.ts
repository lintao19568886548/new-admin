import { withRetryImport } from '#/utils/retry-import';

const BasicLayout = withRetryImport(async () => {
  const [
    { initTippy, registerLoadingDirective },
    appModule,
    { ensureFullComponentAdapter },
    layout,
  ] = await Promise.all([
    import('@vben/common-ui'),
    import('#/app-context'),
    import('#/adapter/ensure-component-adapter'),
    import('./basic.vue'),
  ]);

  const app = appModule.getAppInstance();
  registerLoadingDirective(app, {
    loading: 'loading',
    spinning: 'spinning',
  });
  initTippy(app);

  await ensureFullComponentAdapter();
  return layout;
});
const AuthPageLayout = withRetryImport(async () => {
  const [{ ensureFullComponentAdapter }, layout] = await Promise.all([
    import('#/adapter/ensure-component-adapter'),
    import('./auth.vue'),
  ]);

  await ensureFullComponentAdapter();
  return layout;
});

const IFrameView = withRetryImport(() =>
  import('@vben/layouts').then((m) => m.IFrameView),
);

export { AuthPageLayout, BasicLayout, IFrameView };
