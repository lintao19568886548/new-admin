import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/reimbursement/application/list.vue'),
    meta: {
      icon: 'mdi:file-document-multiple', // 更改为账单/文档图标
      order: -1,
      title: $t('报销申请'),
    },
    name: 'ReimbursementApplication',
    path: '/reimbursement/application',
  },
  {
    component: () => import('#/views/reimbursement/audit/list.vue'),
    meta: {
      icon: 'mdi:file-document-multiple', // 更改为账单/文档图标
      order: -1,
      title: $t('报销审核'),
    },
    name: 'ReimbursementAudit',
    path: '/reimbursement/audit',
  },
  {
    component: () => import('#/views/reimbursement/application/mobile.vue'),
    meta: {
      hideMenu: true, // 通常移动端专项页面不在主菜单显示
      icon: 'mdi:cellphone-check', // 移动端图标
      order: -1,
      title: $t('移动端报销申请'),
    },
    name: 'ReimbursementMobileApply',
    path: '/reimbursement/mobile-apply',
  },
  {
    component: () => import('#/views/reimbursement/audit/mobile.vue'),
    meta: {
      hideMenu: true, // 通常移动端专项页面不在主菜单显示
      icon: 'mdi:cellphone-text', // 移动端审核图标
      order: -1,
      title: $t('移动端报销审核'),
    },
    name: 'ReimbursementMobileAudit',
    path: '/reimbursement/mobile-audit',
  },
];

export default routes;
