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
    path: '/rental/factory',
    children: [
      {
        component: () => import('#/views/rental/factory/index.vue'),
        meta: {
          icon: 'mdi:factory',
          ignoreAccess: true,
          title: $t('page.rental.factory'),
        },
        name: 'FactoryList',
        path: '',
      },
    ],
  },
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      ignoreAccess: true,
      title: $t('page.rental.factoryDetail'),
    },
    path: '/rental/factory/detail/:id',
    children: [
      {
        component: () => import('#/views/rental/factory/detail.vue'),
        meta: {
          hideInMenu: true,
          icon: 'mdi:factory',
          ignoreAccess: true,
          title: $t('page.rental.factoryDetail'),
        },
        name: 'FactoryDetail',
        path: '',
      },
    ],
  },
];

export default routes;
