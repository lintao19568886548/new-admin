import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';

import { decodeAccessToken, verifyAccessToken } from '../utils/jwt-utils';
import { unAuthorizedResponse } from '../utils/response';

export default defineEventHandler(async (event) => {
  const defaultCustomerId = String(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const path = event.path;
  const isApiRequest = path.startsWith('/api/');
  const isPublicVisitorRegisterApi =
    event.method === 'POST' &&
    ['/api/access/visitor', '/api/access/visitor/register'].includes(path);
  const isPublicApi =
    ['/api/auth'].some((p) => path.startsWith(p)) || isPublicVisitorRegisterApi;

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
      select: { customerType: true, status: true, tokenVersion: true },
    });
    if (!current || Number(current.status ?? 1) !== 1) {
      return unAuthorizedResponse(event);
    }
    if (!current.customerType) {
      return unAuthorizedResponse(event);
    }
    if (
      Number(current.tokenVersion ?? 1) !==
      Number(userinfoForScope.tokenVersion)
    ) {
      return unAuthorizedResponse(event);
    }
    if (String(current.customerType) !== userinfoForScope.customerId) {
      return unAuthorizedResponse(event);
    }

    const customer = await systemDbClient.customer.findUnique({
      where: { customerId: String(current.customerType) },
      select: { status: true },
    });
    if (!customer || customer.status === 0) {
      return unAuthorizedResponse(event);
    }
  }

  const customerIdForScope = String(
    userinfoForScope?.customerId || defaultCustomerId,
  );
  prismaScopeStorage.enterWith({ customerId: customerIdForScope });
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
