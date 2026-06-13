import { applyCrmSalesDataScope } from '~/utils/crm-data-scope';
import {
  createCrmSchemaMissingError,
  CrmScmError,
  isCrmSchemaMissingError,
  listCrmSalesChannels,
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

  const query = applyCrmSalesDataScope(getQuery(event), userinfo);

  try {
    const result = await listCrmSalesChannels(query);
    return useResponseSuccess(result);
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
    console.error('[crm] list sales channels failed:', error);
    return serverErrorResponse('查询销售渠道失败', event);
  }
});
