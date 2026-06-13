import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      hideInMenu: true,
      icon: 'mdi:account-plus-outline',
      order: 8500,
      title: $t('获客推广'),
    },
    name: 'Crm',
    path: '/crm',
    redirect: '/crm/qrcode-test',
    children: [
      {
        component: () => import('#/views/crm/qrcode-test.vue'),
        meta: {
          icon: 'mdi:account-plus-outline',
          title: $t('获客推广'),
        },
        name: 'CrmQrcodeTest',
        path: 'qrcode-test',
      },
    ],
  },
];

export default routes;
