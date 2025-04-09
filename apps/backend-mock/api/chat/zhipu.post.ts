import axios from 'axios';

export default eventHandler(async (event) => {
  const body = await readBody(event);
  const { message, model, apikey } = body;

  try {
    const response = await axios.post(
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
          Authorization: `Bearer ${apikey}`,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('API请求错误:', error);
    return {
      error: true,
      message: error.message || '请求智谱API失败',
    };
  }
});
