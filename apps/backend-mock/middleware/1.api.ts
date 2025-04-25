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
      const referer = event.headers.get('referer') || '';
      // 提取referer中端口号后面的路径部分
      const refererPath = referer ? new URL(referer).pathname : '';
      const userAgent = event.headers.get('user-agent') || '';
      const ip =
        event.headers.get('x-forwarded-for') ||
        event.node.req.socket.remoteAddress;

      // 定义变量保存匹配到的字段值
      let itemName = '';

      try {
        // 克隆请求体以便后续处理仍然可以访问
        const cloneBody = await readBody(event).catch(() => ({}));
        console.log(`\nbody:\n${JSON.stringify(cloneBody, null, 2)}\n`);

        // 查找匹配字段
        if (cloneBody && typeof cloneBody === 'object') {
          // 首先尝试完全匹配'name'字段
          if ('name' in cloneBody) {
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
              console.log('\n未找到匹配name或xxxName格式的字段\n');
            }
          }
        }
      } catch (error) {
        console.error('读取请求体时出错:', error);
      }

      // 记录日志
      console.log(`
        \n请求日志：\n${JSON.stringify(
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
          await prismaClient.apiLog.create({
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
