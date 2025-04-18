import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () =>
      import('#/views/reimbursement/application/application.vue'),
    meta: {
      icon: 'mdi:file-document-multiple', // 更改为账单/文档图标
      order: -1,
      title: $t('报销申请'),
    },
    name: 'Reimbursement',
    path: '/reimbursement',
  },
];

export default routes;
