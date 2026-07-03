import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/profile/organization-invitations.vue'),
    meta: {
      hideMenu: true,
      title: '企业邀请码',
    },
    name: 'ProfileOrganizationInvitations',
    path: '/profile/organization-invitations',
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
