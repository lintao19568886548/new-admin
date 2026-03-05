import { requestClient } from '#/api/request';

/**
 * 发送页面访问验证码
 */
export async function sendPageAccessSmsCodeApi(data: { phoneNumber: string }) {
  return requestClient.post<{
    debugCode?: string;
    expiresIn: number;
  }>('/auth/send-page-access-code', data);
}

/**
 * 验证页面访问验证码
 */
export async function verifyPageAccessSmsCodeApi(data: {
  code: string;
  phoneNumber: string;
}) {
  return requestClient.post('/auth/verify-page-access-code', data);
}
