import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/finance/manage/list.vue'),
    meta: {
      icon: 'mdi:currency-usd', // 更改为金融/货币图标
      title: $t('page.finance.title'),
    },
    name: 'FinanceManage',
    path: '/finance/manage',
  },
];

export default routes;
