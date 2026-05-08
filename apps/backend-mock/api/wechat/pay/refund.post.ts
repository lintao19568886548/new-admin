import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { createVipMembershipRefund } from '~/utils/vip-membership';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  if (!userinfo.roles?.includes('Super')) {
    return forbiddenResponse(event, '仅 Super 角色可发起会员退款');
  }

  const body = (await readBody(event)) as Record<string, unknown>;
  const outTradeNo = String(body.outTradeNo || '').trim();
  if (!outTradeNo) {
    return badRequestResponse('缺少 outTradeNo 参数', event);
  }

  try {
    const requesterCustomerId = String(userinfo.customerId || '').trim();
    const defaultCustomerId = String(
      process.env.DEFAULT_CUSTOMER_ID || 'default',
    );
    const result = await createVipMembershipRefund({
      allowCrossCustomerRefund: requesterCustomerId === defaultCustomerId,
      outTradeNo,
      reason:
        typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim()
          : undefined,
      requesterCustomerId,
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('发起会员微信退款失败:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : '发起会员微信退款失败',
      event,
    );
  }
});
