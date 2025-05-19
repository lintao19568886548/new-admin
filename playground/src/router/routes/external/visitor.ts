import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/access/visitor/modules/register.vue'),
    meta: {
      title: $t('page.access.register'),
    },
    name: 'Access',
    path: '/visitor/register',
  },
];

export default routes;
