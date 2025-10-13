import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  export interface LoginBySmsParams {
    code: string;
    phoneNumber: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data, {
    withCredentials: true,
  });
}

/**
 * 发送登录短信验证码
 */
export async function sendLoginSmsCodeApi(data: { phoneNumber: string }) {
  return requestClient.post<{
    debugCode?: string;
    expiresIn: number;
  }>('/auth/send-login-code', data);
}

/**
 * 短信验证码登录
 */
export async function loginBySmsCodeApi(data: AuthApi.LoginBySmsParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/code-login', data, {
    withCredentials: true,
  });
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/refresh',
    null,
    {
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', null, {
    withCredentials: true,
  });
}

/**
 * 修改密码
 */
export async function changePasswordApi(data: any) {
  return requestClient.post('/auth/password', data);
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
