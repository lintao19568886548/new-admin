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

  // 使用钩子在请求完成后执行日志记录
  event.node.res.on('finish', () => {
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
        `[${new Date().toISOString()}] ${method} ${path} ${statusCode} ${duration}ms - ${ip} ${userAgent}`,
      );

      // 如果需要，可以将日志写入数据库
      // if (['DELETE', 'POST', 'PUT'].includes(method)) {
      //   prismaClient.operationLog
      //     .create({
      //       data: {
      //         method,
      //         path,
      //         statusCode,
      //         duration,
      //         ip: String(ip),
      //         userAgent,
      //         userId: event.context.user?.userId || null,
      //       },
      //     })
      //     .catch((error) => console.error('日志记录失败:', error));
      // }
    }
  });
});
