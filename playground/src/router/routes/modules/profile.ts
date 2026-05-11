import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/profile/index.vue'),
    meta: {
      title: '我的',
    },
    name: 'Profile',
    path: '/profile',
  },
  {
    component: () => import('#/views/profile/vip-membership.vue'),
    meta: {
      hideMenu: true,
      title: '会员服务',
    },
    name: 'ProfileVipMembership',
    path: '/profile/vip-membership',
  },
  {
    component: () => import('#/views/profile/tenant-invitations.vue'),
    meta: {
      hideMenu: true,
      title: '企业邀请码',
    },
    name: 'ProfileTenantInvitations',
    path: '/profile/tenant-invitations',
  },
  {
    component: () => import('#/views/profile/vip-refunds.vue'),
    meta: {
      hideMenu: true,
      title: '会员退款订单',
    },
    name: 'ProfileVipRefunds',
    path: '/profile/vip-refunds',
  },
];

export default routes;
