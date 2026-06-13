import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:office-building',
      order: 2,
      title: $t('page.Investment.title'),
    },
    name: 'Investment',
    path: '/investment',
    redirect: '/investment/agent',
    children: [
      {
        component: () => import('#/views/investment/agent/list.vue'),
        meta: {
          icon: 'mdi:account-tie',
          title: $t('page.Investment.title'),
        },
        name: 'InvestmentAgent',
        path: 'agent',
      },
    ],
  },
];

export default routes;
