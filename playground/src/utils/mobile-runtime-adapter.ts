const DISPOSERS: Array<() => void> = [];
let initialized = false;

function getUserAgent() {
  return navigator.userAgent || '';
}

function isIosLike() {
  const ua = getUserAgent();
  return (
    /iP(?:ad|hone|od)/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isMobileLike() {
  return (
    window.innerWidth < 768 ||
    /Android|iP(?:ad|hone|od)|Mobile|MicroMessenger/i.test(getUserAgent())
  );
}

function syncViewportVars() {
  const viewport = window.visualViewport;
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportOffsetTop = viewport?.offsetTop || 0;
  const keyboardHeight = Math.max(
    0,
    window.innerHeight - viewportHeight - viewportOffsetTop,
  );

  document.documentElement.style.setProperty(
    '--app-viewport-height',
    `${viewportHeight}px`,
  );
  document.documentElement.style.setProperty(
    '--app-keyboard-height',
    `${keyboardHeight}px`,
  );
  document.body.classList.toggle('is-keyboard-open', keyboardHeight > 80);
}

function syncRuntimeClasses() {
  const ua = getUserAgent();
  const root = document.documentElement;
  root.classList.toggle('is-mobile-runtime', isMobileLike());
  root.classList.toggle('is-ios-runtime', isIosLike());
  root.classList.toggle('is-android-runtime', /Android/i.test(ua));
  root.classList.toggle('is-wechat-runtime', /MicroMessenger/i.test(ua));
}

function bind(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
) {
  target.addEventListener(type, listener, { passive: true });
  DISPOSERS.push(() => target.removeEventListener(type, listener));
}

export function setupMobileRuntimeAdapter() {
  if (initialized || typeof window === 'undefined') {
    return () => {};
  }
  initialized = true;

  const sync = () => {
    syncRuntimeClasses();
    syncViewportVars();
  };

  sync();
  bind(window, 'orientationchange', sync);
  bind(window, 'resize', sync);

  if (window.visualViewport) {
    bind(window.visualViewport, 'resize', sync);
    bind(window.visualViewport, 'scroll', sync);
  }

  return () => {
    while (DISPOSERS.length > 0) {
      DISPOSERS.pop()?.();
    }
    initialized = false;
  };
}
