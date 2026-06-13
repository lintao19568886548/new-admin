import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE } from '~/utils/wechat-miniprogram';

function hasEnv(name: string) {
  return Boolean(String(process.env[name] || '').trim());
}

function normalizeOrigin(value: string) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  try {
    const url = new URL(text);
    return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function isLocalPublicOrigin(origin: string) {
  if (!origin) {
    return false;
  }
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

function buildPublicOrigin(event: any) {
  const requestOrigin = normalizeOrigin(
    String(getHeader(event, 'origin') || getHeader(event, 'referer') || ''),
  );
  if (isLocalPublicOrigin(requestOrigin)) {
    return requestOrigin;
  }

  const configured = String(process.env.CRM_INVITE_H5_BASE_URL || '').trim();
  if (configured) {
    return normalizeOrigin(configured) || configured.replace(/\/+$/, '');
  }
  return getRequestURL(event).origin.replace(/\/+$/, '');
}

export default defineEventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const origin = buildPublicOrigin(event);
  const qrcodePage =
    String(process.env.CRM_MINIPROGRAM_QRCODE_PAGE || '').trim() ||
    DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE;
  const required = [
    'WECHAT_APP_ID',
    'WECHAT_APP_SECRET',
    'WECHAT_MINIPROGRAM_APP_ID',
    'WECHAT_MINIPROGRAM_APP_SECRET',
    'CRM_MINIPROGRAM_QRCODE_PAGE',
    'CRM_INVITE_H5_BASE_URL',
    'WEWORK_CORP_ID',
    'WEWORK_CUSTOMER_CONTACT_SECRET',
    'WEWORK_CALLBACK_TOKEN',
    'WEWORK_CALLBACK_AES_KEY',
  ].map((key) => ({
    configured: hasEnv(key),
    key,
  }));

  return useResponseSuccess({
    callbackUrl: `${origin}/api/wework/callback`,
    h5Oauth: {
      appIdConfigured: hasEnv('WECHAT_APP_ID'),
      appSecretConfigured: hasEnv('WECHAT_APP_SECRET'),
      h5BaseUrlConfigured: hasEnv('CRM_INVITE_H5_BASE_URL'),
    },
    inviteH5Url: `${origin}/invite/crm`,
    miniprogram: {
      appIdConfigured: hasEnv('WECHAT_MINIPROGRAM_APP_ID'),
      appSecretConfigured: hasEnv('WECHAT_MINIPROGRAM_APP_SECRET'),
      h5BaseUrlConfigured: hasEnv('CRM_INVITE_H5_BASE_URL'),
      qrcodePage,
      qrcodePageConfigured: hasEnv('CRM_MINIPROGRAM_QRCODE_PAGE'),
    },
    required,
    wework: {
      aesKeyConfigured: hasEnv('WEWORK_CALLBACK_AES_KEY'),
      callbackTokenConfigured: hasEnv('WEWORK_CALLBACK_TOKEN'),
      corpIdConfigured: hasEnv('WEWORK_CORP_ID'),
      customerContactSecretConfigured: hasEnv('WEWORK_CUSTOMER_CONTACT_SECRET'),
    },
  });
});
