import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:home-city-outline', // 更改为租赁/房产图标
      order: -1,
      title: $t('page.rental.title'),
    },
    name: 'Rental',
    path: '/rental',
    children: [
      {
        component: () => import('#/views/rental/tenant/list.vue'),
        meta: {
          icon: 'mdi:account-group', // 更改为租户/用户组图标
          parentPath: '/tenant',
          title: $t('page.rental.tenant'),
        },
        name: 'TenantManage',
        path: '/rental/tenant/',
      },
      {
        component: () => import('#/views/rental/manage/list.vue'),
        meta: {
          icon: 'mdi:clipboard-list', // 更改为管理/列表图标
          parentPath: '/rental',
          title: $t('page.rental.management'),
        },
        name: 'RentalManage',
        path: '/rental/manage/',
      },
      {
        component: () => import('#/views/rental/list/index.vue'),
        meta: {
          icon: 'mdi:view-list', // 更改为列表视图图标
          title: $t('page.rental.list'),
        },
        name: 'RentalList',
        path: '/rental/list',
      },
      {
        component: () => import('#/views/rental/list/detail.vue'),
        meta: {
          hideInMenu: true,
          icon: 'mdi:file-document-outline', // 更改为详情/文档图标
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
