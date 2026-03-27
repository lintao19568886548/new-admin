import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      ignoreAccess: true,
      title: $t('page.rental.factory'),
    },
    name: 'RentalPublicRoot',
    path: '/',
    children: [
      {
        component: () => import('#/views/rental/factory/index.vue'),
        meta: {
          icon: 'mdi:factory',
          ignoreAccess: true,
          title: $t('page.rental.factory'),
        },
        name: 'FactoryList',
        path: '/rental/factory',
      },
      {
        component: () => import('#/views/rental/factory/detail.vue'),
        meta: {
          hideInMenu: true,
          icon: 'mdi:factory',
          ignoreAccess: true,
          title: $t('page.rental.factoryDetail'),
        },
        name: 'FactoryDetail',
        path: '/rental/factory/detail/:id',
      },
    ],
  },
];

export default routes;
