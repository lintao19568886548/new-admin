import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/tools/webtools.vue'),
    meta: {
      icon: 'lucide:copyright',
      title: $t('page.tools.title'),
    },
    name: 'Tools',
    path: '/tools',
  },
];

export default routes;
