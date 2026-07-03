type MessageApi = (typeof import('ant-design-vue'))['message'];

let messagePromise: null | Promise<MessageApi> = null;

function loadMessage() {
  messagePromise ??= import('ant-design-vue').then(({ message }) => message);
  return messagePromise;
}

export async function showAntdMessage(
  type: 'error' | 'info' | 'loading' | 'success',
  options: Parameters<MessageApi[typeof type]>[0],
) {
  const message = await loadMessage();
  return message[type](options as any);
}

export async function destroyAntdMessage(key?: string) {
  const message = await loadMessage();
  message.destroy(key);
}
