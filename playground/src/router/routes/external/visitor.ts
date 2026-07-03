import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/access/visitor/register.vue'),
    meta: {
      title: $t('page.access.register'),
    },
    name: 'Access',
    path: '/visitor/register',
  },
];

export default routes;
