import {
  ExternalLeadValidationError,
  updateExternalLead,
} from '~/utils/investment-radar/external-lead-repository';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function normalizeNullableNumber(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return Number(value);
}

function normalizeNullableString(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return String(value);
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const leadId = Number(event.context.params?.id);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return badRequestResponse('leadId 无效', event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;

  try {
    const result = await runWithRadarSharedScope(() =>
      updateExternalLead(leadId, {
        invalidReason: normalizeNullableString(body.invalidReason),
        ownerUserId: normalizeNullableNumber(body.ownerUserId),
        remark: normalizeNullableString(body.remark),
        status:
          body.status === undefined ? undefined : (String(body.status) as any),
      }),
    );
    if (!result) {
      return badRequestResponse('外部公开线索不存在', event, 404);
    }
    return useResponseSuccess({
      leadId: result.leadId,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof ExternalLeadValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('update external lead failed:', error);
    return serverErrorResponse('更新外部公开线索失败', event);
  }
});
