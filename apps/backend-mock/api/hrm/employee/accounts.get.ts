import { getQuery } from 'h3';
import { getBindableEmployeeAccountOptions } from '~/utils/employee-user-binding';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const customerId = String(
      userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
    );
    const query = getQuery(event);
    const employeeId = Number(query.employeeId);
    const keyword = typeof query.keyword === 'string' ? query.keyword : '';

    const items = await getBindableEmployeeAccountOptions({
      customerId,
      employeeId:
        Number.isFinite(employeeId) && employeeId > 0 ? employeeId : undefined,
      keyword,
    });

    return useResponseSuccess(items);
  } catch (error) {
    console.error('获取可绑定账号失败:', error);
    return serverErrorResponse('获取可绑定账号失败', event);
  }
});
