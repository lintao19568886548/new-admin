import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:tools', // 更改为工具/维护图标
      order: -1,
      title: $t('page.maintenance.title'),
    },
    name: 'Maintenance',
    path: '/maintenance',
    children: [
      {
        component: () => import('#/views/maintenance/firefighting/list.vue'),
        meta: {
          icon: 'mdi:fire-extinguisher', // 更改为消防图标
          title: $t('page.maintenance.firefighting'),
        },
        name: 'Firefighting',
        path: '/maintenance/firefighting',
      },
      {
        component: () =>
          import('#/views/maintenance/firefighting/mobile-list.vue'),
        meta: {
          hidden: true, // Hide from menu
          title: '消防管理mobile',
        },
        name: 'FirefightingMobile',
        path: '/maintenance/firefighting/mobile',
      },
      {
        component: () => import('#/views/maintenance/elevator/list.vue'),
        meta: {
          icon: 'mdi:elevator', // 更改为电梯图标
          title: $t('page.maintenance.elevator'),
        },
        name: 'Elevator',
        path: '/maintenance/elevator',
      },
      {
        component: () => import('#/views/maintenance/elevator/mobile-list.vue'),
        meta: {
          hidden: true, // Hide from menu
          title: '电梯管理mobile',
        },
        name: 'ElevatorMobile',
        path: '/maintenance/elevator/mobile',
      },
      {
        component: () => import('#/views/maintenance/factoryMaint/list.vue'),
        meta: {
          icon: 'mdi:office-building-cog', // 更改为厂房维护图标
          title: '厂房维护',
        },
        name: 'FactoryMaint',
        path: '/maintenance/factoryMaint',
      },
      {
        component: () =>
          import('#/views/maintenance/factoryMaint/mobile-list.vue'),
        meta: {
          hidden: true, // Hide from menu
          title: '厂房维护mobile',
        },
        name: 'FactoryMaintMobile',
        path: '/maintenance/factoryMaint/mobile',
      },
      {
        component: () => import('#/views/maintenance/repair-order/list.vue'),
        meta: {
          icon: 'mdi:clipboard-text-clock',
          title: '报修工单',
        },
        name: 'RepairOrder',
        path: '/maintenance/repair-order',
      },
      {
        component: () =>
          import('#/views/maintenance/repair-order/mobile-list.vue'),
        meta: {
          hidden: true,
          title: '报修工单mobile',
        },
        name: 'RepairOrderMobile',
        path: '/maintenance/repair-order/mobile',
      },
      {
        component: () => import('#/views/maintenance/transformer/list.vue'),
        meta: {
          icon: 'mdi:lightning-bolt', // 更改为电力/变压器图标
          title: $t('page.maintenance.transformer'),
        },
        name: 'Transformer',
        path: '/maintenance/transformer',
      },
      {
        component: () =>
          import('#/views/maintenance/transformer/mobile-list.vue'),
        meta: {
          hidden: true, // Hide from menu
          title: '变压器维保mobile',
        },
        name: 'TransformerMobile',
        path: '/maintenance/transformer/mobile',
      },
      {
        component: () => import('#/views/maintenance/hygieneCheck/list.vue'),
        meta: {
          icon: 'mdi:broom', // 卫生检查图标
          title: $t('page.maintenance.hygieneCheck'),
        },
        name: 'HygieneCheck',
        path: '/maintenance/hygieneCheck',
      },
      {
        component: () =>
          import('#/views/maintenance/hygieneCheck/mobile-list.vue'),
        meta: {
          hidden: true, // Hide from menu
          title: '卫生检查mobile',
        },
        name: 'HygieneCheckMobile',
        path: '/maintenance/hygieneCheck/mobile',
      },
    ],
  },
];

export default routes;
