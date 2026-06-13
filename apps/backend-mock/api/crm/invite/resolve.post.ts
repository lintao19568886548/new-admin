import {
  createCrmSchemaMissingError,
  CrmScmError,
  isCrmSchemaMissingError,
  resolveCrmInvite,
  saveCrmContactWay,
  serializeCrmContactWay,
} from '~/utils/crm-scrm';
import { systemDbClient } from '~/utils/db';
import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import { createWeworkContactWay } from '~/utils/wework-client';

function getClientIp(event: any) {
  const forwarded = getHeader(event, 'x-forwarded-for');
  if (forwarded) {
    return String(forwarded).split(',')[0]?.trim() || '';
  }
  return String(getHeader(event, 'x-real-ip') || '');
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  try {
    const result = await resolveCrmInvite({
      ...body,
      ip: getClientIp(event),
      userAgent: getHeader(event, 'user-agent') || '',
    });
    let contactWay = null;
    let contactWayError = '';
    if (!result.binding) {
      return useResponseSuccess({
        ...result,
        contactWay,
        contactWayError,
      });
    }

    const weworkUserId = String(result.owner.weworkUserId || '').trim();
    if (weworkUserId) {
      try {
        const state = `crm_binding_${result.binding.id}`;
        const existing = await systemDbClient.crmWeworkContactWay.findFirst({
          orderBy: { updateTime: 'desc' },
          where: {
            salesUserId: result.owner.salesUserId,
            state,
            status: 1,
          },
        });

        if (existing) {
          contactWay = serializeCrmContactWay(existing);
        } else {
          const created = await createWeworkContactWay({
            state,
            weworkUserId,
          });
          const saved = await saveCrmContactWay({
            configId: created.configId,
            qrCode: created.qrCode,
            salesUserId: result.owner.salesUserId,
            state,
            weworkUserId,
          });
          contactWay = serializeCrmContactWay(saved);
        }
      } catch (error) {
        contactWayError =
          error instanceof Error ? error.message : '生成企业微信二维码失败';
      }
    }

    return useResponseSuccess({
      ...result,
      contactWay,
      contactWayError,
      owner: {
        ...result.owner,
        contactQrCode: contactWay?.qrCode || result.owner.contactQrCode,
      },
    });
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
    console.error('[crm] resolve invite failed:', error);
    return serverErrorResponse('解析扫码归属失败', event);
  }
});
