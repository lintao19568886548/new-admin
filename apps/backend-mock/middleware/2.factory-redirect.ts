import { getHeader, readBody } from 'h3';

/**
 * 处理厂房创建请求的通用函数
 * @param event - 事件对象
 * @param isOwn - 是否为自有厂房
 * @param pathName - 请求路径名称（用于日志）
 */
async function handleFactoryRequest(
  event: any,
  isOwn: boolean,
  pathName: string,
) {
  console.log(`拦截到 ${pathName} 请求`);

  // 读取原始请求体
  const originalBody = await readBody(event);
  console.log('原始请求体:', originalBody);

  // 修改请求体，添加 isOwn 参数
  const modifiedBody = {
    ...originalBody,
    isOwn,
  };

  console.log('修改后的请求体:', modifiedBody);
  console.log('请求体中的 itemName:', modifiedBody.itemName);

  // 存储修改后的请求体到 context 中，让后续的 /api/factory 路由处理
  event.context.factoryBody = modifiedBody;

  try {
    // 使用 $fetch 进行内部 API 调用
    const internalFetch = $fetch as unknown as (
      request: string,
      options: any,
    ) => Promise<any>;
    const result = await internalFetch('/api/factory', {
      method: 'POST',
      body: modifiedBody,
      headers: {
        // 传递原始请求的认证头
        authorization: getHeader(event, 'authorization') || '',
        cookie: getHeader(event, 'cookie') || '',
      },
    });

    console.log('内部调用 /api/factory 成功:', result);
    return result;
  } catch (error) {
    console.error('内部调用 /api/factory 失败:', error);
    throw error;
  }
}

// 路径与 isOwn 参数的映射配置
const FACTORY_PATH_CONFIG = {
  '/api/factory/own': true,
  '/api/factory/settled': false,
} as const;

/**
 * 厂房创建接口转发中间件
 * 拦截 /api/factory/own 和 /api/factory/settled 请求
 * 根据路径自动添加 isOwn 参数并转发到统一的 /api/factory 接口
 */
export default defineEventHandler(async (event) => {
  // 只处理 POST 请求的厂房创建接口
  if (event.method === 'POST' && event.path in FACTORY_PATH_CONFIG) {
    const isOwn =
      FACTORY_PATH_CONFIG[event.path as keyof typeof FACTORY_PATH_CONFIG];
    return await handleFactoryRequest(event, isOwn, event.path);
  }
});
