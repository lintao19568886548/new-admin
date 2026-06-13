import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/crm/invite.vue'),
    meta: {
      ignoreAccess: true,
      public: true,
      title: '销售顾问',
    },
    name: 'CrmInvitePublic',
    path: '/invite/crm',
  },
  {
    component: () => import('#/views/crm/invite.vue'),
    meta: {
      ignoreAccess: true,
      public: true,
      title: '销售顾问',
    },
    name: 'CrmInviteLegacyPublic',
    path: '/crm/invite',
  },
];

export default routes;
