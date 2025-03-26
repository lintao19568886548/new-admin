import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/bill/amount/list.vue'),
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.bill.title'),
    },
    name: 'Bill',
    path: '/bill',
  },
];

export default routes;
