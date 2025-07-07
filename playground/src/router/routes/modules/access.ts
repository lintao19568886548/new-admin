import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:key-square',
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
      {
        name: 'VisitorRegister',
        path: '/access/visitor/register',
        component: () => import('#/views/access/visitor/modules/register.vue'),
        meta: {
          icon: 'carbon:user-profile',
          title: '访客登记',
        },
      },
      {
        name: 'VisitorMobileList',
        path: '/access/visitor/mobile',
        component: () => import('#/views/access/visitor/mobile-list.vue'),
        meta: {
          icon: 'carbon:mobile',
          title: '访客管理(移动端)',
        },
      },
    ],
  },
];

export default routes;
