import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:factory',
      order: -1,
      title: $t('亿玛信诺'),
    },
    name: 'Ymsino',
    path: '/ymsino',
    children: [
      {
        component: () => import('#/views/ymsino/meter/list.vue'),
        meta: {
          icon: 'mdi:gauge',
          title: $t('原始抄表数据'),
        },
        name: 'YmsinoMeterRaw',
        path: 'meter',
      },
    ],
  },
];

export default routes;
