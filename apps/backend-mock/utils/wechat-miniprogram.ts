import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { CrmScmError } from '~/utils/crm-scrm';

const currentDir = dirname(fileURLToPath(import.meta.url));

loadDotenv({ path: resolve(currentDir, '../.env') });

type AccessTokenCache = {
  expiresAt: number;
  token: string;
};

const globalForWechatMiniProgram = globalThis as unknown as {
  wechatMiniProgramAccessToken?: AccessTokenCache;
};

export const DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE = 'pages/home/index';

function getWechatMiniProgramConfig() {
  const appId = String(process.env.WECHAT_MINIPROGRAM_APP_ID || '').trim();
  const appSecret = String(
    process.env.WECHAT_MINIPROGRAM_APP_SECRET || '',
  ).trim();

  if (!appId || !appSecret) {
    throw new CrmScmError(
      '缺少微信小程序配置 WECHAT_MINIPROGRAM_APP_ID / WECHAT_MINIPROGRAM_APP_SECRET',
      500,
    );
  }

  return { appId, appSecret };
}

function buildUrl(base: string, params: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new CrmScmError(`微信接口返回异常: ${text.slice(0, 120)}`, 502);
  }

  if (payload?.errcode && Number(payload.errcode) !== 0) {
    throw new CrmScmError(
      `微信接口调用失败(${payload.errcode}): ${payload.errmsg || 'unknown'}`,
      502,
    );
  }

  return payload as T;
}

export async function getWechatMiniProgramAccessToken() {
  const cached = globalForWechatMiniProgram.wechatMiniProgramAccessToken;
  const now = Date.now();
  if (cached && cached.expiresAt > now + 30_000) {
    return cached.token;
  }

  const { appId, appSecret } = getWechatMiniProgramConfig();
  const url = buildUrl('https://api.weixin.qq.com/cgi-bin/token', {
    appid: appId,
    grant_type: 'client_credential',
    secret: appSecret,
  });

  const payload = await readJsonResponse<{
    access_token?: string;
    expires_in?: number;
  }>(await fetch(url));

  if (!payload.access_token) {
    throw new CrmScmError('微信小程序 access_token 返回为空', 502);
  }

  globalForWechatMiniProgram.wechatMiniProgramAccessToken = {
    expiresAt: now + Number(payload.expires_in || 7200) * 1000,
    token: payload.access_token,
  };

  return payload.access_token;
}

export async function exchangeWechatMiniProgramSession(code: string) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) {
    throw new CrmScmError('code不能为空');
  }

  const { appId, appSecret } = getWechatMiniProgramConfig();
  const url = buildUrl('https://api.weixin.qq.com/sns/jscode2session', {
    appid: appId,
    grant_type: 'authorization_code',
    js_code: normalizedCode,
    secret: appSecret,
  });

  const payload = await readJsonResponse<{
    openid?: string;
    session_key?: string;
    unionid?: string;
  }>(await fetch(url));

  if (!payload.openid) {
    throw new CrmScmError('微信小程序 openid 返回为空', 502);
  }

  return {
    openid: payload.openid,
    unionid: payload.unionid || '',
  };
}

export async function getWechatMiniProgramPhoneNumber(code: string) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) {
    throw new CrmScmError('手机号授权 code 不能为空');
  }

  const accessToken = await getWechatMiniProgramAccessToken();
  const url = buildUrl(
    'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
    {
      access_token: accessToken,
    },
  );

  const payload = await readJsonResponse<{
    phone_info?: {
      phoneNumber?: string;
      purePhoneNumber?: string;
    };
  }>(
    await fetch(url, {
      body: JSON.stringify({ code: normalizedCode }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
  );

  const phoneNumber =
    payload.phone_info?.purePhoneNumber ||
    payload.phone_info?.phoneNumber ||
    '';
  if (!phoneNumber) {
    throw new CrmScmError('微信手机号返回为空', 502);
  }

  return {
    phoneNumber,
  };
}

export async function createWechatMiniProgramUnlimitedQRCode(input: {
  envVersion?: string;
  page?: string;
  scene: string;
  width?: number;
}) {
  const scene = String(input.scene || '').trim();
  if (!scene) {
    throw new CrmScmError('scene不能为空');
  }

  const accessToken = await getWechatMiniProgramAccessToken();
  const page = String(
    input.page ||
      process.env.CRM_MINIPROGRAM_QRCODE_PAGE ||
      DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE,
  ).trim();
  const envVersion = String(input.envVersion || 'release').trim();
  const width = Math.min(1280, Math.max(280, Number(input.width) || 430));
  const url = buildUrl('https://api.weixin.qq.com/wxa/getwxacodeunlimit', {
    access_token: accessToken,
  });
  const response = await fetch(url, {
    body: JSON.stringify({
      check_path: false,
      env_version: envVersion,
      page,
      scene,
      width,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = JSON.parse(buffer.toString('utf8')) as {
      errcode?: number;
      errmsg?: string;
    };
    if (payload.errcode && Number(payload.errcode) !== 0) {
      throw new CrmScmError(
        `生成小程序码失败(${payload.errcode}): ${payload.errmsg || 'unknown'}`,
        502,
      );
    }
  }

  if (buffer.length === 0) {
    throw new CrmScmError('生成小程序码返回为空', 502);
  }

  return {
    dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    mimeType: 'image/png',
  };
}

export async function createWechatMiniProgramUrlLink(input: {
  envVersion?: string;
  expireInterval?: number;
  page?: string;
  scene: string;
}) {
  const scene = String(input.scene || '').trim();
  if (!scene) {
    throw new CrmScmError('scene不能为空');
  }

  const accessToken = await getWechatMiniProgramAccessToken();
  const page = String(
    input.page ||
      process.env.CRM_MINIPROGRAM_QRCODE_PAGE ||
      DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE,
  ).trim();
  const envVersion = String(input.envVersion || 'release').trim();
  const expireInterval = Math.min(
    30,
    Math.max(1, Number(input.expireInterval) || 30),
  );
  const url = buildUrl('https://api.weixin.qq.com/wxa/generate_urllink', {
    access_token: accessToken,
  });
  const query = new URLSearchParams({ scene }).toString();

  const payload = await readJsonResponse<{
    url_link?: string;
  }>(
    await fetch(url, {
      body: JSON.stringify({
        env_version: envVersion,
        expire_interval: expireInterval,
        expire_type: 1,
        is_expire: true,
        path: page,
        query,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
  );

  if (!payload.url_link) {
    throw new CrmScmError('微信小程序 URL Link 返回为空', 502);
  }

  return {
    envVersion,
    expireInterval,
    page,
    query,
    urlLink: payload.url_link,
  };
}
