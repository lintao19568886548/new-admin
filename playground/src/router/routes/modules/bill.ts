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
  {
    component: () => import('#/views/bill/amount/mobile-list.vue'),
    meta: {
      icon: 'mdi:cellphone',
      order: 0,
      title: $t('page.bill.amount.mobileTitle'),
    },
    name: 'BillMobileList',
    path: '/bill/mobile-list',
  },
];

export default routes;
