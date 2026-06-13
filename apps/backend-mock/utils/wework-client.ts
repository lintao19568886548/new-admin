import { CrmScmError } from '~/utils/crm-scrm';

type WeworkAccessTokenCache = {
  expiresAt: number;
  token: string;
};

const globalForWework = globalThis as unknown as {
  weworkCustomerContactAccessToken?: WeworkAccessTokenCache;
};

function getWeworkCustomerContactConfig() {
  const corpId = String(process.env.WEWORK_CORP_ID || '').trim();
  const secret = String(
    process.env.WEWORK_CUSTOMER_CONTACT_SECRET || '',
  ).trim();

  if (!corpId || !secret) {
    throw new CrmScmError(
      '缺少企业微信配置 WEWORK_CORP_ID / WEWORK_CUSTOMER_CONTACT_SECRET',
      500,
    );
  }

  return { corpId, secret };
}

function buildUrl(base: string, params: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function readWeworkJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new CrmScmError(`企业微信接口返回异常: ${text.slice(0, 120)}`, 502);
  }

  if (Number(payload?.errcode ?? 0) !== 0) {
    throw new CrmScmError(
      `企业微信接口调用失败(${payload.errcode}): ${
        payload.errmsg || 'unknown'
      }`,
      502,
    );
  }

  return payload as T;
}

export async function getWeworkCustomerContactAccessToken() {
  const cached = globalForWework.weworkCustomerContactAccessToken;
  const now = Date.now();
  if (cached && cached.expiresAt > now + 30_000) {
    return cached.token;
  }

  const { corpId, secret } = getWeworkCustomerContactConfig();
  const url = buildUrl('https://qyapi.weixin.qq.com/cgi-bin/gettoken', {
    corpid: corpId,
    corpsecret: secret,
  });
  const payload = await readWeworkJson<{
    access_token?: string;
    expires_in?: number;
  }>(await fetch(url));

  if (!payload.access_token) {
    throw new CrmScmError('企业微信 access_token 返回为空', 502);
  }

  globalForWework.weworkCustomerContactAccessToken = {
    expiresAt: now + Number(payload.expires_in || 7200) * 1000,
    token: payload.access_token,
  };

  return payload.access_token;
}

export async function createWeworkContactWay(input: {
  remark?: string;
  skipVerify?: boolean;
  state: string;
  weworkUserId: string;
}) {
  const weworkUserId = String(input.weworkUserId || '').trim();
  const state = String(input.state || '').trim();
  if (!weworkUserId) {
    throw new CrmScmError('weworkUserId不能为空');
  }
  if (!state) {
    throw new CrmScmError('state不能为空');
  }

  const accessToken = await getWeworkCustomerContactAccessToken();
  const url = buildUrl(
    'https://qyapi.weixin.qq.com/cgi-bin/externalcontact/add_contact_way',
    {
      access_token: accessToken,
    },
  );
  const payload = await readWeworkJson<{
    config_id?: string;
    qr_code?: string;
  }>(
    await fetch(url, {
      body: JSON.stringify({
        is_temp: false,
        remark: input.remark || 'CRM销售联系我',
        scene: 2,
        skip_verify: input.skipVerify !== false,
        state,
        style: 1,
        type: 1,
        user: [weworkUserId],
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
  );

  if (!payload.config_id && !payload.qr_code) {
    throw new CrmScmError('企业微信联系我二维码返回为空', 502);
  }

  return {
    configId: payload.config_id || '',
    qrCode: payload.qr_code || '',
    state,
  };
}
