type ImportFactory<T> = () => Promise<T>;

interface RetryImportOptions {
  delay?: number;
  retries?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DYNAMIC_IMPORT_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed|ChunkLoadError|CSS_CHUNK_LOAD_FAILED|Unable to preload CSS|dynamically imported module|module script failed/i;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error || '');
}

function isDynamicImportLoadError(error: unknown) {
  return DYNAMIC_IMPORT_ERROR_PATTERN.test(getErrorMessage(error));
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function retryImport<T>(
  factory: ImportFactory<T>,
  options: RetryImportOptions = {},
): Promise<T> {
  const {
    delay: retryDelay = 800,
    retries = 2,
    shouldRetry = isDynamicImportLoadError,
  } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;

      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }

      await delay(retryDelay * (attempt + 1));
    }
  }

  throw lastError;
}

function withRetryImport<T>(
  factory: ImportFactory<T>,
  options?: RetryImportOptions,
) {
  return () => retryImport(factory, options);
}

export {
  getErrorMessage,
  isDynamicImportLoadError,
  retryImport,
  withRetryImport,
};
export type { RetryImportOptions };
