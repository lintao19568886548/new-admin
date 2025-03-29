import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/bill/amount/list.vue'),
    meta: {
      icon: 'mdi:file-document-multiple', // 更改为账单/文档图标
      order: -1,
      title: $t('page.bill.title'),
    },
    name: 'Bill',
    path: '/bill',
  },
];

export default routes;
