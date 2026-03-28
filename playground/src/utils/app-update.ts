export function normalizeIosStoreUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol.toLowerCase();

    // iOS 线上分发仅支持 App Store。
    const isAppStoreHost =
      host === 'apps.apple.com' ||
      host === 'itunes.apple.com' ||
      host.endsWith('.apps.apple.com');

    if (!isAppStoreHost) {
      return '';
    }

    if (protocol === 'itms-apps:' || protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // ignore
  }
  return '';
}
