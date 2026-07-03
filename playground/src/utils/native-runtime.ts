export type NativeRuntimePlatform = 'android' | 'ios';

interface CapacitorGlobal {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
}

function getCapacitorGlobal() {
  if (typeof globalThis === 'undefined') {
    return;
  }

  return (globalThis as typeof globalThis & { Capacitor?: CapacitorGlobal })
    .Capacitor;
}

export function getNativeRuntimePlatform(): NativeRuntimePlatform | null {
  const capacitor = getCapacitorGlobal();
  if (!capacitor) {
    return null;
  }

  try {
    const platform = capacitor.getPlatform?.();
    if (platform === 'ios' || platform === 'android') {
      return platform;
    }

    if (!capacitor.isNativePlatform?.()) {
      return null;
    }

    const userAgent = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(userAgent)) {
      return 'ios';
    }
    if (/Android/i.test(userAgent)) {
      return 'android';
    }
  } catch {
    return null;
  }

  return null;
}

export function isNativeRuntime() {
  return getNativeRuntimePlatform() !== null;
}

export function isIosNativeRuntime() {
  return getNativeRuntimePlatform() === 'ios';
}

export function isAndroidNativeRuntime() {
  return getNativeRuntimePlatform() === 'android';
}
