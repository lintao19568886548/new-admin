import {
  CrmScmError,
  normalizeCrmScene,
  serializeCrmSalesChannel,
} from '~/utils/crm-scrm';
import { systemDbClient } from '~/utils/db';
import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  createWechatMiniProgramUnlimitedQRCode,
  DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE,
} from '~/utils/wechat-miniprogram';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  try {
    const scene = normalizeCrmScene(query.scene);
    const channel = await systemDbClient.crmSalesChannel.findUnique({
      where: { scene },
    });

    if (!channel || Number(channel.status ?? 1) !== 1) {
      return badRequestResponse('二维码渠道不存在或已停用', event, 404);
    }

    const wxacode = await createWechatMiniProgramUnlimitedQRCode({
      envVersion: String(query.envVersion || 'release'),
      page: String(
        query.page ||
          process.env.CRM_MINIPROGRAM_QRCODE_PAGE ||
          DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE,
      ),
      scene,
      width: Number(query.width) || 430,
    });

    return useResponseSuccess({
      channel: serializeCrmSalesChannel(channel),
      envVersion: String(query.envVersion || 'release'),
      page: String(
        query.page ||
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
    console.error('[crm] create public invite wxacode failed:', error);
    return serverErrorResponse('生成小程序授权码失败', event);
  }
});
