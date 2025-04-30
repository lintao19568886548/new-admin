import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/access/visitor/modules/register.vue'),
    meta: {
      ignoreAccess: true, // 添加这个属性，表示不需要登录也可以访问
      title: $t('page.access.register'),
    },
    name: 'Access',
    path: '/visitor/register',
  },
];

export default routes;
