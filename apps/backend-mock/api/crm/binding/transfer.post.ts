import { assertCrmOwnerBindingDataAccess } from '~/utils/crm-data-scope';
import {
  createCrmSchemaMissingError,
  CrmScmError,
  isCrmSchemaMissingError,
  transferCrmOwnerBinding,
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

  const body = await readBody<Record<string, unknown>>(event);
  const payload = body && typeof body === 'object' ? body : {};

  try {
    await assertCrmOwnerBindingDataAccess(payload.id, userinfo);
    return useResponseSuccess(
      await transferCrmOwnerBinding({
        ...payload,
        operatorUserId: userinfo.centerUserId || userinfo.id,
      }),
    );
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
    console.error('[crm] transfer owner binding failed:', error);
    return serverErrorResponse('转移客户归属失败', event);
  }
});
