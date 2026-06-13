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
  createWechatMiniProgramUrlLink,
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

    const link = await createWechatMiniProgramUrlLink({
      envVersion: String(query.envVersion || 'release'),
      expireInterval: Number(query.expireInterval) || 30,
      page: String(
        query.page ||
          process.env.CRM_MINIPROGRAM_QRCODE_PAGE ||
          DEFAULT_CRM_MINIPROGRAM_QRCODE_PAGE,
      ),
      scene,
    });

    return useResponseSuccess({
      channel: serializeCrmSalesChannel(channel),
      scene,
      ...link,
    });
  } catch (error) {
    if (error instanceof CrmScmError) {
      return error.statusCode >= 500
        ? serverErrorResponse(error.message, event, error.statusCode)
        : badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('[crm] create public invite url link failed:', error);
    return serverErrorResponse('生成小程序授权链接失败', event);
  }
});
