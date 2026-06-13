import { randomUUID } from 'node:crypto';

import { CrmScmError } from '~/utils/crm-scrm';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  createWechatMiniProgramUnlimitedQRCode,
  DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE,
} from '~/utils/wechat-miniprogram';

function buildTestScene() {
  return `test_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`.slice(
    0,
    32,
  );
}

export default defineEventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody<{
    envVersion?: string;
    page?: string;
    scene?: string;
    width?: number;
  }>(event);

  const scene = String(body?.scene || buildTestScene()).trim();
  if (!scene) {
    return badRequestResponse('scene不能为空', event);
  }
  if (scene.length > 32) {
    return badRequestResponse('微信小程序 scene 长度不能超过32个字符', event);
  }

  try {
    const wxacode = await createWechatMiniProgramUnlimitedQRCode({
      envVersion: body?.envVersion,
      page: body?.page,
      scene,
      width: body?.width,
    });

    return useResponseSuccess({
      envVersion: String(body?.envVersion || 'release'),
      page: String(
        body?.page ||
          process.env.CRM_MINIPROGRAM_QRCODE_PAGE ||
          DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE,
      ),
      scene,
      wxacode,
    });
  } catch (error) {
    if (error instanceof CrmScmError) {
      return error.statusCode >= 500
        ? serverErrorResponse(error.message, event, error.statusCode)
        : badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('[crm] create miniprogram qrcode test failed:', error);
    return serverErrorResponse('生成微信小程序测试码失败', event);
  }
});
