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
        component: () => import('#/views/maintenance/transformer/list.vue'),
        meta: {
          icon: 'mdi:lightning-bolt', // 更改为电力/变压器图标
          title: $t('page.maintenance.transformer'),
        },
        name: 'Transformer',
        path: '/maintenance/transformer',
      },
    ],
  },
];

export default routes;
