import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:copyright',
      order: 1000,
      title: $t('page.access.title'),
    },
    name: 'Access',
    path: '/access',
    children: [
      {
        name: 'CarAccess',
        path: '/access/car',
        component: () => import('#/views/access/car/list.vue'),
        meta: {
          icon: 'carbon:car',
          title: '车辆出入管理',
        },
      },
      {
        name: 'VisitorAccess',
        path: '/access/visitor',
        component: () => import('#/views/access/visitor/list.vue'),
        meta: {
          icon: 'carbon:user-profile',
          title: '访客管理',
        },
      },
    ],
  },
];

export default routes;
