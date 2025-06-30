import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/download/index.vue'),
    meta: {
      public: true,
      title: '下载页面',
    },
    name: 'Download',
    path: '/app/download',
  },
];

export default routes;
