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
          title: $t('page.rental.tenant'),
        },
        name: 'TenantManage',
        path: 'tenant',
      },
      {
        component: () => import('#/views/rental/tenant/mobile-list.vue'),
        meta: {
          hideMenu: true,
          icon: 'mdi:cellphone-account', // 手机和用户图标结合
          title: $t('page.rental.tenantMobileListTitle'),
        },
        name: 'TenantMobileList',
        path: 'tenant/mobile',
      },
      {
        component: () => import('#/views/rental/manage/list.vue'),
        meta: {
          hideInMenu: true,
          icon: 'mdi:clipboard-list', // 更改为管理/列表图标
          title: $t('page.rental.management'),
        },
        name: 'RentalManage',
        path: 'manage',
      },
      {
        component: () => import('#/views/rental/manage/mobile.vue'),
        meta: {
          hideInMenu: true,
          hideMenu: true,
          icon: 'mdi:cellphone-cog', // 手机和设置图标结合
          title: $t('page.rental.managementMobile'),
        },
        name: 'RentalManageMobile',
        path: 'manage/mobile',
      },
      {
        component: () => import('#/views/rental/list/index.vue'),
        meta: {
          icon: 'mdi:view-list', // 更改为列表视图图标
          title: $t('page.rental.list'),
        },
        name: 'RentalList',
        path: 'list',
      },
      {
        component: () => import('#/views/rental/list/detail.vue'),
        meta: {
          hideInMenu: true,
          icon: 'mdi:file-document-outline', // 更改为详情/文档图标
          title: $t('page.rental.detail'),
        },
        name: 'RentalDetail',
        path: 'list/detail/:id',
      },
      {
        component: () => import('#/views/rental/settled/list.vue'),
        meta: {
          icon: 'mdi:home-import-outline', // 入驻厂房图标
          title: $t('page.rental.settled'),
        },
        name: 'SettledFactory',
        path: 'settled',
      },
      {
        component: () => import('#/views/rental/settled/mobile-list.vue'),
        meta: {
          hideMenu: true,
          icon: 'mdi:cellphone-home', // 手机和房屋图标结合
          title: $t('page.rental.settled'),
        },
        name: 'SettledFactoryMobile',
        path: 'settled/mobile',
      },
    ],
  },
];

export default routes;
