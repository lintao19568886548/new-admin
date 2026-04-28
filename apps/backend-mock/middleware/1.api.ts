import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { verifyVipCheckoutFlowTokenFromEvent } from '~/utils/vip-checkout-flow-token';
import {
  getVipMembershipAccessState,
  shouldBlockTenantWriteForProvisioning,
} from '~/utils/vip-membership';

import { decodeAccessToken, verifyAccessToken } from '../utils/jwt-utils';
import { forbiddenResponse, unAuthorizedResponse } from '../utils/response';

function isMembershipAllowedApiRequest(method: string, requestPath: string) {
  if (requestPath.startsWith('/api/auth')) {
    return true;
  }

  if (requestPath.startsWith('/api/wechat/pay')) {
    return true;
  }

  if (requestPath.startsWith('/api/tenant/invitation')) {
    return true;
  }

  if (
    method === 'GET' &&
    [
      '/api/access/visitor/list',
      '/api/hrm/attendance/today',
      '/api/hrm/employee/accounts',
      '/api/menu/all',
      '/api/reimbursement/summary',
      '/api/system/version',
      '/api/tenant/provisioning/status',
      '/api/user/info',
    ].includes(requestPath)
  ) {
    return true;
  }

  if (
    method === 'GET' &&
    ['/api/park/list', '/api/system/park/list'].includes(requestPath)
  ) {
    return true;
  }

  if (
    method === 'GET' &&
    (/^\/api\/system\/park\/\d+$/.test(requestPath) ||
      /^\/api\/hrm\/employee\/\d+$/.test(requestPath))
  ) {
    return true;
  }

  if (
    method === 'POST' &&
    [
      '/api/dormitory',
      '/api/factory/own',
      '/api/hrm/employee',
      '/api/image/upload',
      '/api/park',
      '/api/user/cancel',
      '/api/user/feedback',
    ].includes(requestPath)
  ) {
    return true;
  }

  if (method === 'GET' && ['/api/hrm/employee/list'].includes(requestPath)) {
    return true;
  }

  if (
    method === 'PUT' &&
    (/^\/api\/dormitory\/\d+$/.test(requestPath) ||
      /^\/api\/factory\/\d+$/.test(requestPath) ||
      /^\/api\/hrm\/employee\/\d+$/.test(requestPath) ||
      /^\/api\/park\/\d+$/.test(requestPath))
  ) {
    return true;
  }

  if (
    method === 'DELETE' &&
    (/^\/api\/dormitory\/\d+$/.test(requestPath) ||
      /^\/api\/factory\/\d+$/.test(requestPath) ||
      /^\/api\/hrm\/employee\/\d+$/.test(requestPath) ||
      /^\/api\/system\/park\/\d+$/.test(requestPath))
  ) {
    return true;
  }

  return false;
}

function membershipRequiredResponse(
  event: Parameters<typeof forbiddenResponse>[0],
  reason: 'membership_expired' | 'trial_expired',
) {
  const message =
    reason === 'membership_expired'
      ? '会员已过期，请续费后继续访问当前功能'
      : '试用已到期，请开通会员后继续访问当前功能';

  setResponseStatus(event, 403);
  return {
    code: 403,
    data: null,
    error: message,
    errorCode: 'MEMBERSHIP_REQUIRED',
    message,
    redirectTo: '/profile/vip-membership',
    restrictionReason: reason,
  };
}

export default defineEventHandler(async (event) => {
  const defaultCustomerId = String(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const path = event.path;
  const requestPath = path.split('?')[0] || path;
  const isApiRequest = requestPath.startsWith('/api/');
  const isPublicVisitorRegisterApi =
    event.method === 'POST' &&
    ['/api/access/visitor', '/api/access/visitor/register'].includes(
      requestPath,
    );
  const isPublicFactoryApi =
    event.method === 'GET' &&
    (requestPath === '/api/factory/available-list' ||
      /^\/api\/factory\/\d+$/.test(requestPath));
  const isPublicWechatApi =
    event.method === 'GET' && requestPath === '/api/wechat/js-sdk-config';
  const isPublicWechatPayConfigApi =
    event.method === 'GET' && requestPath === '/api/wechat/pay/app/config';
  const isPublicWechatPayNotifyApi =
    event.method === 'POST' && requestPath === '/api/wechat/pay/notify';
  const isWechatPayOrderQueryApi =
    event.method === 'GET' && requestPath === '/api/wechat/pay/query';
  const isTenantProvisioningStatusApi =
    event.method === 'GET' && requestPath === '/api/tenant/provisioning/status';
  const isVipCheckoutFlowApi =
    isWechatPayOrderQueryApi || isTenantProvisioningStatusApi;
  const isPublicAppVersionApi =
    event.method === 'GET' && requestPath === '/api/system/version';
  const vipCheckoutFlow = isVipCheckoutFlowApi
    ? verifyVipCheckoutFlowTokenFromEvent(event)
    : null;
  const isPublicApi =
    ['/api/auth'].some((p) => requestPath.startsWith(p)) ||
    isPublicVisitorRegisterApi ||
    isPublicFactoryApi ||
    isPublicWechatApi ||
    isPublicWechatPayConfigApi ||
    isPublicWechatPayNotifyApi ||
    isPublicAppVersionApi ||
    Boolean(vipCheckoutFlow);
  let currentCustomerDbName: null | string = null;

  event.node.res.setHeader(
    'Access-Control-Allow-Origin',
    event.headers.get('Origin') ?? '*',
  );

  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    event.node.res.statusMessage = 'No Content.';
    return 'OK';
  }

  const userinfoForScope = verifyAccessToken(event);
  event.context.vipCheckoutFlow = vipCheckoutFlow;
  if (isApiRequest && !isPublicApi) {
    if (
      !userinfoForScope ||
      !userinfoForScope.customerId ||
      !userinfoForScope.id ||
      userinfoForScope.tokenVersion === null ||
      userinfoForScope.tokenVersion === undefined
    ) {
      return unAuthorizedResponse(event);
    }

    const centerUserId = Number(
      userinfoForScope.centerUserId ?? userinfoForScope.id,
    );
    if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
      return unAuthorizedResponse(event);
    }

    const current = await systemDbClient.user.findUnique({
      where: { id: centerUserId },
      select: {
        createTime: true,
        customerType: true,
        membershipTrialStartAt: true,
        status: true,
        tokenVersion: true,
      },
    });
    if (!current || Number(current.status ?? 1) !== 1) {
      return unAuthorizedResponse(event);
    }
    if (!current.customerType) {
      return unAuthorizedResponse(event);
    }
    const currentCustomerId = String(current.customerType);
    const isDefaultCustomer = currentCustomerId === defaultCustomerId;
    const isTokenVersionMismatch =
      Number(current.tokenVersion ?? 1) !==
      Number(userinfoForScope.tokenVersion);
    if (isTokenVersionMismatch) {
      return unAuthorizedResponse(
        event,
        '登录状态已变更，请重新登录',
        'AUTH_TOKEN_VERSION_MISMATCH',
      );
    }
    const isCustomerScopeMismatch =
      currentCustomerId !== userinfoForScope.customerId;
    if (isCustomerScopeMismatch) {
      return unAuthorizedResponse(
        event,
        '账号租户已变更，请重新登录',
        'AUTH_CUSTOMER_SCOPE_CHANGED',
      );
    }

    if (!isDefaultCustomer) {
      const membershipAccessState = await getVipMembershipAccessState({
        centerUserId,
        centerUserCreateTime: current.createTime || null,
        centerUserTrialStartAt: current.membershipTrialStartAt || null,
        customerId: currentCustomerId,
      });
      if (
        membershipAccessState.accessRestricted &&
        !isMembershipAllowedApiRequest(event.method, requestPath)
      ) {
        const restrictionReason =
          membershipAccessState.membershipGateReason === 'membership_expired'
            ? 'membership_expired'
            : 'trial_expired';
        return membershipRequiredResponse(event, restrictionReason);
      }
    }

    const customer = await systemDbClient.customer.findUnique({
      where: { customerId: currentCustomerId },
      select: { dbName: true, status: true },
    });
    if (!customer || customer.status === 0) {
      return unAuthorizedResponse(event);
    }
    currentCustomerDbName = customer.dbName ? String(customer.dbName) : null;

    const isWriteRequest = ['DELETE', 'PATCH', 'POST', 'PUT'].includes(
      event.method,
    );
    const isProvisioningWriteAllowed =
      requestPath.startsWith('/api/auth') ||
      requestPath.startsWith('/api/wechat/pay') ||
      isTenantProvisioningStatusApi ||
      requestPath === '/api/user/info';

    if (
      isWriteRequest &&
      !isProvisioningWriteAllowed &&
      (await shouldBlockTenantWriteForProvisioning({
        centerUserId: userinfoForScope.centerUserId ?? userinfoForScope.id,
        customerId: userinfoForScope.customerId,
      }))
    ) {
      return forbiddenResponse(
        event,
        '专属空间开通中，暂不能新增或修改业务数据',
      );
    }
  }

  const customerIdForScope = String(
    userinfoForScope?.customerId || defaultCustomerId,
  );
  prismaScopeStorage.enterWith({
    customerId: customerIdForScope,
    dbName: currentCustomerDbName,
  });
  event.context.customerId = customerIdForScope;
  event.context.userId = userinfoForScope?.id
    ? Number(userinfoForScope.id)
    : undefined;
  event.context.systemDbClient = systemDbClient;
  event.context.customerDbClient = prismaClient;

  // 记录请求开始时间
  const startTime = Date.now();

  // 获取用户名 (仅解码，不验证签名)
  const userinfo = userinfoForScope ?? decodeAccessToken(event);
  const username = userinfo?.realName || '';

  const excludeList = {
    pathPatterns: ['/api/auth'],
  };

  // 使用钩子在请求完成后执行日志记录
  event.node.res.on('finish', async () => {
    // 只记录PUT、POST、DELETE请求
    if (['DELETE', 'POST', 'PUT'].includes(event.method)) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const statusCode = event.node.res.statusCode;
      const method = event.method;
      const path = event.path;
      const referer = event.headers.get('referer') || '';
      // 优先从自定义头X-Current-Path获取前端路由，如果获取不到再降级到 referer
      const pagePath = event.headers.get('x-current-path');
      const refererPath =
        pagePath || (referer ? new URL(referer).pathname : '');
      const userAgent = event.headers.get('user-agent') || '';
      const ip =
        event.headers.get('x-forwarded-for') ||
        event.node.req.socket.remoteAddress;

      // 定义变量保存匹配到的字段值
      let itemName = '';

      try {
        // 克隆请求体以便后续处理仍然可以访问
        const cloneBody = await readBody(event).catch(() => ({}));
        // console.log(`\nbody:\n${JSON.stringify(cloneBody, null, 2)}\n`);

        // 查找匹配字段
        if (cloneBody && typeof cloneBody === 'object') {
          // 首先尝试完全匹配'purpose'字段
          if ('purpose' in cloneBody) {
            // 完全匹配purpose字段
            itemName = cloneBody.purpose;
            console.log(`\n找到完全匹配purpose字段: purpose = ${itemName}\n`);
            // 然后尝试完全匹配'name'字段
          } else if ('name' in cloneBody) {
            itemName = cloneBody.name;
            console.log(`\n找到完全匹配name字段: name = ${itemName}\n`);
          } else {
            // 如果找不到，再查找匹配xxxName格式的字段
            const nameField = Object.keys(cloneBody).find((key) =>
              /^[a-zA-Z]+Name$/.test(key),
            );
            if (nameField) {
              itemName = cloneBody[nameField];
              console.log(
                `\n找到匹配xxxName格式的字段: ${nameField} = ${itemName}\n`,
              );
            } else {
              // 如果找不到，再查找匹配xxxName格式的字段
              const nameField = Object.keys(cloneBody).find((key) =>
                /^[a-zA-Z]+Name$/.test(key),
              );
              if (nameField) {
                itemName = cloneBody[nameField];
                console.log(
                  `\n找到匹配xxxName格式的字段: ${nameField} = ${itemName}\n`,
                );
              }
              console.log('\n未找到匹配purpose、name或xxxName格式字段\n');
            }
          }
        }
      } catch (error) {
        console.error('读取请求体时出错:', error);
      }

      // 记录日志
      console.log(`
        \n1.api请求日志：\n${JSON.stringify(
          {
            timestamp: new Date(endTime).toISOString(),
            method,
            path,
            refererPath,
            statusCode,
            duration: `${duration}ms`,
            ip,
            userAgent,
            username,
            itemName,
          },
          null,
          2,
        )}\n`);

      // 检查是否需要排除记录
      const shouldExclude =
        statusCode !== 200 || // 只有状态码为200的不排除，其他都排除
        excludeList.pathPatterns.some((pattern) => path.startsWith(pattern));

      // 记录API请求日志
      if (!shouldExclude) {
        try {
          // API请求日志录入到数据库
          await systemDbClient.apiLog.create({
            data: {
              method,
              path,
              refererPath,
              itemName,
              username,
              requestTime: new Date(endTime),
            },
          });
        } catch (error) {
          console.error('记录API日志失败:', error);
        }
      }
    }
  });
});
