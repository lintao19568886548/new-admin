import { CrmScmError, normalizeCrmScene } from '~/utils/crm-scrm';

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

function buildPublicOrigin(event: any) {
  const configured = normalizeOrigin(
    String(process.env.CRM_INVITE_H5_BASE_URL || '').trim(),
  );
  if (configured) {
    return configured;
  }
  return getRequestURL(event).origin.replace(/\/+$/, '');
}

function buildInviteUrl(event: any, params: Record<string, string>) {
  const url = new URL('/invite/crm', buildPublicOrigin(event));
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  let scene = '';
  try {
    scene = normalizeCrmScene(query.scene);
  } catch (error) {
    if (error instanceof CrmScmError) {
      return sendRedirect(
        event,
        buildInviteUrl(event, {
          oauth_error: 'bad_scene',
          scene: String(query.scene || ''),
        }),
        302,
      );
    }
    throw error;
  }

  const appId = String(process.env.WECHAT_APP_ID || '').trim();
  const appSecret = String(process.env.WECHAT_APP_SECRET || '').trim();
  if (!appId || !appSecret) {
    return sendRedirect(
      event,
      buildInviteUrl(event, {
        oauth_error: 'not_configured',
        scene,
      }),
      302,
    );
  }

  const callbackUrl = new URL(
    '/api/crm/invite/wechat-oauth/callback',
    buildPublicOrigin(event),
  );
  const authUrl = new URL(
    'https://open.weixin.qq.com/connect/oauth2/authorize',
  );
  authUrl.searchParams.set('appid', appId);
  authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'snsapi_userinfo');
  authUrl.searchParams.set('state', scene);

  return sendRedirect(event, `${authUrl.toString()}#wechat_redirect`, 302);
});
