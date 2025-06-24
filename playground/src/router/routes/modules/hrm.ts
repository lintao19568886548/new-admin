import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

// const LAYOUT = () => import('@/layouts/default/index.vue'); // Removed this line

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:account-group-outline',
      order: 10, // Example order
      title: $t('人事管理'),
    },
    name: 'Hrm',
    path: '/hrm',
    // component: LAYOUT, // Removed this line
    redirect: '/hrm/information',
    children: [
      {
        path: 'information', // Ensure relative path
        name: 'HrmInformation',
        component: () => import('#/views/hrm/information/list.vue'),
        meta: {
          title: $t('员工信息'),
        },
      },
      {
        path: 'mobile-information', // Ensure relative path
        name: 'HrmMobileInformation',
        component: () => import('#/views/hrm/information/mobile-list.vue'),
        meta: {
          hideMenu: true,
          title: $t('移动端员工信息'),
        },
      },
      {
        path: 'attendance', // Corrected to relative path
        name: 'HrmAttendance',
        component: () => import('#/views/hrm/attendance/list.vue'),
        meta: {
          icon: 'mdi:calendar-clock',
          title: '考勤管理',
        },
      },
      // {
      //   path: 'payroll', // Corrected to relative path
      //   name: 'HrmPayroll',
      //   component: () => import(),
      //   children: [], // 添加空的children数组以满足RouteRecordSingleViewWithChildren类型要求
      //   redirect: '/hrm/payroll/list',
      //   // component: undefined,
      //   meta: {
      //     icon: 'mdi:cash-multiple',
      //     title: '薪资管理',
      //   },
      //   // children: [],
      // },
      {
        path: 'leaveapplication', // Ensure relative path
        name: 'HrmLeaveApplication',
        component: () => import('#/views/hrm/leaveapplication/list.vue'),
        meta: {
          title: $t('请假申请'),
        },
      },
    ],
  },
];

export default routes;
