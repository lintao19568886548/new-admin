import { requestClient } from '#/api/request';

export namespace ZhiPuApi {
  export interface ZhiPuApiDetail {
    messages: string[];
    model: string;
  }
}

/**
 * 获取部门列表数据
 */
async function chat(params: any) {
  const { message, model } = params;
  return requestClient.post(
    'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    {
      messages: [
        {
          content: message,
          role: 'user',
        },
      ],
      model,
    },
    {
      headers: {
        Authorization: `Bearer a0f076c247684233a4f3215c09dca859.uJc1KAaTkmVsg0YB`,
      },
    },
  );
}

export { chat };
