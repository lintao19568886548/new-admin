import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/notices/list.vue'),
    meta: {
      icon: 'mdi:bullhorn-outline',
      order: 8010,
      title: '公告列表',
    },
    name: 'Notices',
    path: '/notices',
  },
];

export default routes;
