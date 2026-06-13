import { forceCrmSalesUserIdForWrite } from '~/utils/crm-data-scope';
import {
  createCrmSalesChannel,
  createCrmSchemaMissingError,
  CrmScmError,
  isCrmSchemaMissingError,
  serializeCrmSalesChannel,
} from '~/utils/crm-scrm';
import { systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { createWechatMiniProgramUnlimitedQRCode } from '~/utils/wechat-miniprogram';

export default defineEventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody<{
    channelName?: string;
    channelType?: string;
    envVersion?: string;
    generateWxacode?: boolean;
    page?: string;
    salesName?: string;
    salesUserId?: number;
    scene?: string;
    weworkUserId?: string;
    width?: number;
  }>(event);

  try {
    const channel = await createCrmSalesChannel({
      ...body,
      createdById: userinfo.centerUserId || userinfo.id,
      salesUserId: forceCrmSalesUserIdForWrite(body?.salesUserId, userinfo),
    });
    const payload: Record<string, unknown> = {
      channel: serializeCrmSalesChannel(channel),
    };

    if (body?.generateWxacode) {
      try {
        payload.wxacode = await createWechatMiniProgramUnlimitedQRCode({
          envVersion: body.envVersion,
          page: body.page,
          scene: channel.scene,
          width: body.width,
        });
      } catch (error) {
        await systemDbClient.crmSalesChannel
          .delete({ where: { id: channel.id } })
          .catch((deleteError) => {
            console.warn(
              '[crm] rollback sales channel after qrcode failed:',
              deleteError,
            );
          });
        throw error;
      }
    }

    return useResponseSuccess(payload);
  } catch (error) {
    if (isCrmSchemaMissingError(error)) {
      const schemaError = createCrmSchemaMissingError();
      return serverErrorResponse(
        schemaError.message,
        event,
        schemaError.statusCode,
      );
    }
    if (error instanceof CrmScmError) {
      return error.statusCode >= 500
        ? serverErrorResponse(error.message, event, error.statusCode)
        : badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('[crm] create sales qrcode failed:', error);
    return serverErrorResponse('生成销售二维码失败', event);
  }
});
