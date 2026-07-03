import { retryImport } from '#/utils/retry-import';

let fullComponentAdapterPromise: null | Promise<void> = null;

async function loadFullComponentAdapter() {
  const [{ initComponentAdapter }, { setupApplicationFormAdapter }] =
    await Promise.all([
      retryImport(() => import('./component')),
      retryImport(() => import('./form')),
    ]);

  await initComponentAdapter();
  setupApplicationFormAdapter();
}

function ensureFullComponentAdapter() {
  fullComponentAdapterPromise ??= loadFullComponentAdapter().catch((error) => {
    fullComponentAdapterPromise = null;
    throw error;
  });

  return fullComponentAdapterPromise;
}

export { ensureFullComponentAdapter };
