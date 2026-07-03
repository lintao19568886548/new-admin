import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/bill/amount/print-page.vue'),
    meta: {
      ignoreAccess: true, // 添加这个属性，表示不需要登录也可以访问
      title: $t('打印页'),
    },
    name: 'Print',
    path: '/bill/print/:id',
  },
];

export default routes;
