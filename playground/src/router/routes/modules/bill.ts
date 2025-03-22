import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.bill.title'),
    },
    name: 'Bill',
    path: '/bill',
    children: [
      {
        name: 'rent',
        path: '/bill/rent',
        component: () => import('#/views/bill/rent/list.vue'),
        meta: {
          icon: 'carbon:workspace',
          title: $t('page.bill.rent'),
        },
      },
      {
        name: 'Electricity',
        path: '/bill/electricity',
        component: () => import('#/views/bill/electricity/list.vue'),
        meta: {
          icon: 'carbon:workspace',
          title: $t('page.bill.electricity'),
        },
      },
      {
        name: 'Water',
        path: '/bill/water',
        component: () => import('#/views/bill/water/list.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:area-chart',
          title: $t('page.bill.water'),
        },
      },
    ],
  },
];

export default routes;
