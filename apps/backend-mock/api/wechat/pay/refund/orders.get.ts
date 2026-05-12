import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { listVipMembershipRefundOrders } from '~/utils/vip-membership';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  if (!userinfo.roles?.includes('Super')) {
    return forbiddenResponse(event, '仅 Super 角色可查看会员退款订单');
  }

  try {
    const requesterCustomerId = String(userinfo.customerId || '').trim();
    const defaultCustomerId = String(
      process.env.DEFAULT_CUSTOMER_ID || 'default',
    );
    const result = await listVipMembershipRefundOrders({
      allowCrossCustomerRead: requesterCustomerId === defaultCustomerId,
      customerId: requesterCustomerId,
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('读取会员退款订单失败:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : '读取会员退款订单失败',
      event,
    );
  }
});
