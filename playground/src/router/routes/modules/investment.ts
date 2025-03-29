import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.project.title'),
    },
    name: 'Maintenance',
    path: '/maintenance',
    children: [
      {
        component: () => import('#/views/maintenance/firefighting/list.vue'),
        meta: {
          icon: 'mdi:home-city',
          title: $t('page.maintenance.firefighting'),
        },
        name: 'Firefighting',
        path: '/maintenance/firefighting',
      },
      {
        component: () => import('#/views/maintenance/transformer/list.vue'),
        meta: {
          icon: 'lucide:layout-dashboard',
          title: $t('page.maintenance.transformer'),
        },
        name: 'Transformer',
        path: '/maintenance/transformer',
      },
    ],
  },
];

export default routes;
