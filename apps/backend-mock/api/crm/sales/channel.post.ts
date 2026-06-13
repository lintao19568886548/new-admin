import { forceCrmSalesUserIdForWrite } from '~/utils/crm-data-scope';
import {
  createCrmSalesChannel,
  createCrmSchemaMissingError,
  CrmScmError,
  isCrmSchemaMissingError,
  serializeCrmSalesChannel,
} from '~/utils/crm-scrm';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default defineEventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);

  try {
    const channel = await createCrmSalesChannel({
      ...body,
      createdById: userinfo.centerUserId || userinfo.id,
      salesUserId: forceCrmSalesUserIdForWrite(body?.salesUserId, userinfo),
    });
    return useResponseSuccess(serializeCrmSalesChannel(channel));
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
    console.error('[crm] create sales channel failed:', error);
    return serverErrorResponse('创建销售渠道失败', event);
  }
});
