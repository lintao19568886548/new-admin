import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -999,
      title: $t('page.dashboard.title'),
    },
    name: 'Dashboard',
    path: '/dashboard',
    children: [
      {
        name: 'Analytics',
        path: '/analytics',
        component: () => import('#/views/dashboard/analytics/index.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:area-chart',
          title: $t('page.dashboard.analytics'),
        },
      },
      {
        name: 'Analysis',
        path: '/analysis',
        component: () => import('#/views/dashboard/analysis.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:bar-chart-3',
          title: '数据分析',
        },
      },
      {
        name: 'Workspace',
        path: '/workspace',
        component: () => import('#/views/dashboard/workspace/index.vue'),
        meta: {
          icon: 'carbon:workspace',
          title: $t('page.dashboard.workspace'),
        },
      },
      {
        name: 'Home',
        path: '/home',
        component: () => import('#/views/dashboard/index.vue'),
        meta: {
          icon: 'lucide:home',
          isApp: true,
          title: '首页',
        },
      },
      {
        name: 'Workbench',
        path: '/workbench',
        component: () => import('#/views/dashboard/workbench/index.vue'),
        meta: {
          hideMenu: true,
          icon: 'carbon:workspace',
          title: $t('page.dashboard.workspace'),
        },
      },
    ],
  },
];

export default routes;
