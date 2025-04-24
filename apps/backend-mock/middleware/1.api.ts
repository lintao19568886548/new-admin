export default defineEventHandler(async (event) => {
  event.node.res.setHeader(
    'Access-Control-Allow-Origin',
    event.headers.get('Origin') ?? '*',
  );

  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    event.node.res.statusMessage = 'No Content.';
    return 'OK';
  }

  // 记录请求开始时间
  const startTime = Date.now();

  // 获取用户名
  const userinfo = await verifyAccessToken(event);
  const username = userinfo?.username || '';

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
      const userAgent = event.headers.get('user-agent') || '';
      const ip =
        event.headers.get('x-forwarded-for') ||
        event.node.req.socket.remoteAddress;

      // 记录日志
      console.log(
        JSON.stringify(
          {
            timestamp: new Date(endTime).toISOString(),
            method,
            path,
            statusCode,
            duration: `${duration}ms`,
            ip,
            userAgent,
            username,
          },
          null,
          2,
        ),
      );

      // 检查是否需要排除记录
      const shouldExclude =
        statusCode !== 200 || // 只有状态码为200的不排除，其他都排除
        excludeList.pathPatterns.some((pattern) => path.startsWith(pattern));

      // 记录API请求日志
      if (!shouldExclude) {
        try {
          // API请求日志录入到数据库
          await prismaClient.apiLog.create({
            data: {
              method,
              path,
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
