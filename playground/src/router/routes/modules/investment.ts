import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

// const routes: RouteRecordRaw[] = [
//   {
//     meta: {
//       icon: 'mdi:chart-line', // 将主路由图标改为投资相关的图表图标
//       order: -1,
//       title: $t('page.Investment.title'),
//     },
//     name: 'Investment',
//     path: '/investment',
//     children: [
//       {
//         component: () => import('#/views/investment/agent/list.vue'),
//         meta: {
//           icon: 'mdi:account-tie', // 将代理管理图标改为商务人士图标
//           title: $t('page.agent.title'),
//         },
//         name: 'Agent',
//         path: '/investment/agent',
//       },
//       {
//         component: () => import('#/views/investment/tenant/list.vue'),
//         meta: {
//           icon: 'mdi:office-building', // 将租户管理图标改为建筑/办公楼图标
//           title: $t('page.tenant.title'),
//         },
//         name: 'Tenant',
//         path: '/investment/tenant',
//       },
//     ],
//   },
// ];

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/investment/agent/list.vue'),
    meta: {
      icon: 'mdi:chart-line', // 将主路由图标改为投资相关的图表图标
      order: -1,
      title: $t('page.Investment.title'),
    },
    name: 'Investment',
    path: '/investment',
  },
  {
    component: () => import('#/views/investment/agent/mobile-list.vue'),
    meta: {
      hideMenu: true, // 通常移动端页面不在主菜单显示
      icon: 'mdi:cellphone-text', // 手机图标
      order: 0, // 调整顺序，如果需要
      title: $t('page.agent.mobileListTitle'), // 需要在语言文件中添加此key
    },
    name: 'InvestmentAgentMobileList',
    path: '/investment/agent/mobile',
  },
];

export default routes;
