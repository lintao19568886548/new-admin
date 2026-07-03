type IdleWindow = typeof globalThis &
  Window & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout?: number },
    ) => number;
  };

type NetworkConnection = {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkConnection;
  mozConnection?: NetworkConnection;
  webkitConnection?: NetworkConnection;
};

interface DeferredPreloadOptions {
  delay?: number;
  skipSlowNetwork?: boolean;
  timeout?: number;
}

const SLOW_NETWORK_PATTERN = /(?:^|-)2g|slow-2g/i;

function getConnection() {
  const navigatorWithConnection = window.navigator as NavigatorWithConnection;
  return (
    navigatorWithConnection.connection ??
    navigatorWithConnection.mozConnection ??
    navigatorWithConnection.webkitConnection
  );
}

function shouldSkipDeferredPreload(skipSlowNetwork: boolean) {
  if (!skipSlowNetwork) {
    return false;
  }

  const connection = getConnection();
  if (!connection) {
    return false;
  }

  return (
    connection.saveData === true ||
    SLOW_NETWORK_PATTERN.test(connection.effectiveType ?? '')
  );
}

function runWhenIdle(callback: () => void, delay: number, timeout: number) {
  window.setTimeout(() => {
    const idleWindow = window as IdleWindow;
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(callback, { timeout });
      return;
    }

    window.setTimeout(callback, timeout);
  }, delay);
}

function preloadWhenIdle(
  factory: () => Promise<unknown>,
  options: DeferredPreloadOptions = {},
) {
  if (typeof window === 'undefined') {
    return;
  }

  const { delay = 1500, skipSlowNetwork = true, timeout = 2500 } = options;

  if (shouldSkipDeferredPreload(skipSlowNetwork)) {
    return;
  }

  runWhenIdle(
    () => {
      void factory().catch(() => {});
    },
    delay,
    timeout,
  );
}

export { preloadWhenIdle };
