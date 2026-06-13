import { CrmScmError, normalizeCrmScene } from '~/utils/crm-scrm';

interface WechatOauthTokenResponse {
  access_token?: string;
  errcode?: number;
  errmsg?: string;
  openid?: string;
  unionid?: string;
}

interface WechatOauthUserInfoResponse {
  errcode?: number;
  errmsg?: string;
  headimgurl?: string;
  nickname?: string;
  openid?: string;
  unionid?: string;
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

function buildWechatUrl(base: string, params: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function readWechatJson<T>(response: Response, label: string) {
  const payload = (await response.json()) as T & {
    errcode?: number;
    errmsg?: string;
  };

  if (!response.ok || payload.errcode) {
    throw new Error(
      `${label}失败: ${payload.errmsg || response.statusText || 'unknown error'}`,
    );
  }

  return payload;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const sceneText = String(query.state || query.scene || '').trim();

  let scene = '';
  try {
    scene = normalizeCrmScene(sceneText);
  } catch (error) {
    if (error instanceof CrmScmError) {
      return sendRedirect(
        event,
        buildInviteUrl(event, {
          oauth_error: 'bad_scene',
          scene: sceneText,
        }),
        302,
      );
    }
    throw error;
  }

  const code = String(query.code || '').trim();
  if (!code) {
    return sendRedirect(
      event,
      buildInviteUrl(event, {
        oauth_error: 'denied',
        scene,
      }),
      302,
    );
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

  try {
    const tokenUrl = buildWechatUrl(
      'https://api.weixin.qq.com/sns/oauth2/access_token',
      {
        appid: appId,
        code,
        grant_type: 'authorization_code',
        secret: appSecret,
      },
    );
    const token = await readWechatJson<WechatOauthTokenResponse>(
      await fetch(tokenUrl),
      '获取微信网页授权 access_token',
    );
    const openid = String(token.openid || '').trim();
    const accessToken = String(token.access_token || '').trim();
    if (!openid || !accessToken) {
      throw new Error('微信网页授权返回缺少 openid 或 access_token');
    }

    const userInfoUrl = buildWechatUrl(
      'https://api.weixin.qq.com/sns/userinfo',
      {
        access_token: accessToken,
        lang: 'zh_CN',
        openid,
      },
    );
    const userInfo = await readWechatJson<WechatOauthUserInfoResponse>(
      await fetch(userInfoUrl),
      '获取微信用户信息',
    );

    return sendRedirect(
      event,
      buildInviteUrl(event, {
        customerName: String(userInfo.nickname || '').trim(),
        openid,
        scene,
        source: 'wechat',
        unionid: String(userInfo.unionid || token.unionid || '').trim(),
      }),
      302,
    );
  } catch (error) {
    console.error('[crm] wechat oauth callback failed:', error);
    return sendRedirect(
      event,
      buildInviteUrl(event, {
        oauth_error: 'failed',
        scene,
      }),
      302,
    );
  }
});
