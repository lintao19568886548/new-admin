import {
  assertCrmOwnerBindingDataAccess,
  forceCrmSalesUserIdForWrite,
  resolveCrmDataScope,
} from '~/utils/crm-data-scope';
import {
  createCrmSchemaMissingError,
  CrmScmError,
  isCrmSchemaMissingError,
  saveCrmContactWay,
  serializeCrmContactWay,
} from '~/utils/crm-scrm';
import { systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { createWeworkContactWay } from '~/utils/wework-client';

export default defineEventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const scope = resolveCrmDataScope(userinfo);
  const salesUserId = Number(
    forceCrmSalesUserIdForWrite(query.salesUserId, userinfo),
  );
  const bindingId = Number(query.bindingId);
  const forceRefresh = String(query.refresh || '') === 'true';

  if (!Number.isInteger(salesUserId) || salesUserId <= 0) {
    return badRequestResponse('salesUserId必须是有效的正整数', event);
  }
  if (query.bindingId && (!Number.isInteger(bindingId) || bindingId <= 0)) {
    return badRequestResponse('bindingId必须是有效的正整数', event);
  }

  try {
    if (bindingId) {
      await assertCrmOwnerBindingDataAccess(bindingId, userinfo);
    }
    const defaultState = bindingId
      ? `crm_binding_${bindingId}`
      : `crm_sales_${salesUserId}`;
    const state = String(
      scope.isSuper ? query.state || defaultState : defaultState,
    );
    const existing = await systemDbClient.crmWeworkContactWay.findFirst({
      orderBy: { updateTime: 'desc' },
      where: {
        salesUserId,
        status: 1,
        state,
      },
    });

    if (existing && !forceRefresh) {
      return useResponseSuccess(serializeCrmContactWay(existing));
    }

    const channel = await systemDbClient.crmSalesChannel.findFirst({
      orderBy: { createTime: 'desc' },
      where: {
        salesUserId,
        status: 1,
        weworkUserId: {
          not: null,
        },
      },
    });
    const weworkUserId = String(
      query.weworkUserId || channel?.weworkUserId || '',
    );
    const contactWay = await createWeworkContactWay({
      state,
      weworkUserId,
    });
    const saved = await saveCrmContactWay({
      configId: contactWay.configId,
      qrCode: contactWay.qrCode,
      salesUserId,
      state,
      weworkUserId,
    });
    return useResponseSuccess(serializeCrmContactWay(saved));
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
    console.error('[crm] create wework contact way failed:', error);
    return serverErrorResponse('生成企业微信联系二维码失败', event);
  }
});
