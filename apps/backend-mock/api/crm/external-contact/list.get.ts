import { applyCrmSalesDataScope } from '~/utils/crm-data-scope';
import {
  createCrmSchemaMissingError,
  CrmScmError,
  isCrmSchemaMissingError,
  listCrmExternalContactLogs,
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

  try {
    return useResponseSuccess(
      await listCrmExternalContactLogs(
        applyCrmSalesDataScope(getQuery(event), userinfo),
      ),
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
    console.error('[crm] list external contact logs failed:', error);
    return serverErrorResponse('查询企微添加记录失败', event);
  }
});
