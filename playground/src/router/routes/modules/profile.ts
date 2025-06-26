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
];

export default routes;
