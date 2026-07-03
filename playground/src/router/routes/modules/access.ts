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
        name: 'DoorAccess',
        path: '/access/door',
        component: () => import('#/views/access/door/list.vue'),
        meta: {
          icon: 'carbon:door',
          title: '门禁管理',
        },
      },
      {
        name: 'AccessBrand',
        path: '/access/brand',
        component: () => import('#/views/access/brand/responsive.vue'),
        meta: {
          icon: 'carbon:badge',
          isApp: true,
          title: '门禁品牌管理',
        },
      },
      {
        name: 'AccessBrandMobile',
        path: '/access/brand/mobile',
        component: () => import('#/views/access/brand/mobile-list.vue'),
        meta: {
          hideMenu: true,
          icon: 'carbon:mobile',
          title: '门禁品牌管理',
        },
      },
      {
        name: 'CarAccess',
        path: '/access/car',
        component: () => import('#/views/access/car/responsive.vue'),
        meta: {
          icon: 'carbon:car',
          isApp: true,
          title: '车辆出入管理',
        },
      },
      {
        name: 'CarAccessMobile',
        path: '/access/car/mobile',
        component: () => import('#/views/access/car/mobile-list.vue'),
        meta: {
          hideMenu: true,
          icon: 'carbon:mobile',
          title: '车辆出入管理',
        },
      },
      {
        name: 'VisitorAccess',
        path: '/access/visitor',
        component: () => import('#/views/access/visitor/list.vue'),
        meta: {
          icon: 'carbon:user-profile',
          isApp: true,
          title: '访客管理',
        },
      },
      {
        name: 'VisitorRegister',
        path: '/access/visitor/register',
        component: () => import('#/views/access/visitor/register.vue'),
        meta: {
          icon: 'carbon:user-profile',
          isApp: true,
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
