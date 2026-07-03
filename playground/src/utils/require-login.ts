import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { useAccessStore } from '@vben/stores';

import { Modal } from 'ant-design-vue';

const LOGIN_REQUIRED_MESSAGE = '想要使用完整的功能，请先进行登录';

function normalizeRedirectPath(path: string) {
  return path || '/workbench';
}

function requireLogin(router: Router, redirectPath: string) {
  const accessStore = useAccessStore();
  if (accessStore.accessToken) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      cancelText: '暂不登录',
      centered: true,
      content: LOGIN_REQUIRED_MESSAGE,
      okText: '去登录',
      onCancel: () => {
        resolve(false);
      },
      onOk: async () => {
        resolve(false);
        await router.push({
          path: LOGIN_PATH,
          query: {
            redirect: encodeURIComponent(normalizeRedirectPath(redirectPath)),
          },
        });
      },
      title: '需要登录',
    });
  });
}

export { LOGIN_REQUIRED_MESSAGE, requireLogin };
