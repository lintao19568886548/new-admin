import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:currency-usd',
      order: 8000, // Example order, adjust as needed
      title: $t('page.finance.moduleTitle'), // Assuming a general title for the finance module
    },
    name: 'Finance', // Parent route name
    path: '/finance', // Parent route path
    redirect: '/finance/manage', // Redirect to the default child
    children: [
      {
        path: 'manage', // Child route, relative path
        name: 'FinanceManage',
        component: () => import('#/views/finance/manage/list.vue'),
        meta: {
          // icon: 'mdi:currency-usd', // Icon can be inherited or specific
          title: $t('page.finance.manage.title'), // More specific title for this page
        },
      },
      {
        path: 'mobile-manage',
        name: 'FinanceMobileManage',
        component: () => import('#/views/finance/manage/mobile-list.vue'),
        meta: {
          hideMenu: true, // Hide from main menu if it's a mobile-specific view
          title: $t('page.finance.mobileManage.title'),
        },
      },
    ],
  },
];

export default routes;
