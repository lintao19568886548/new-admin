import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/access/manage/list.vue'),
    meta: {
      icon: 'lucide:copyright',
      title: $t('page.access.title'),
    },
    name: 'AccessManage',
    path: '/access/manage',
  },
];

export default routes;
