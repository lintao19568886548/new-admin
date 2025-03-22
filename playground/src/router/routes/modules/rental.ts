import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.rental.title'),
    },
    name: 'Rental',
    path: '/rental',
    children: [
      {
        component: () => import('#/views/rental/tenant/list.vue'),
        meta: {
          icon: 'lucide:layout-dashboard',
          parentPath: '/tenant',
          title: $t('page.rental.tenant'),
        },
        name: 'TenantManage',
        path: '/rental/tenant/',
      },
      {
        component: () => import('#/views/rental/manage/list.vue'),
        meta: {
          icon: 'lucide:layout-dashboard',
          parentPath: '/rental',
          title: $t('page.rental.management'),
        },
        name: 'RentalManage',
        path: '/rental/manage/',
      },
      {
        component: () => import('#/views/rental/list/index.vue'),
        meta: {
          icon: 'mdi:home-city',
          title: $t('page.rental.list'),
        },
        name: 'RentalList',
        path: '/rental/list',
      },
      {
        component: () => import('#/views/rental/list/detail.vue'),
        meta: {
          hideInMenu: true,
          icon: 'lucide:layout-dashboard',
          parentPath: '/rental',
          title: $t('page.rental.detail'),
        },
        name: 'RentalDetail',
        path: '/rental/detail/:id',
      },
    ],
  },
];

export default routes;
