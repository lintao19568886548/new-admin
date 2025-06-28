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
        path: 'attendance',
        name: 'HrmAttendance',
        redirect: '/hrm/attendance/punch',
        meta: {
          icon: 'mdi:calendar-clock',
          title: '考勤管理',
        },
        children: [
          {
            path: 'punch',
            name: 'HrmAttendancePunch',
            component: () => import('#/views/hrm/attendance/check-in.vue'),
            meta: {
              icon: 'mdi:card-account-details-outline',
              title: '考勤打卡',
            },
          },
          {
            path: 'stats',
            name: 'HrmAttendanceStats',
            component: () => import('#/views/hrm/attendance/record.vue'),
            meta: {
              icon: 'mdi:history',
              title: '考勤记录',
            },
          },
        ],
      },
      {
        path: 'trajectory',
        name: 'HrmTrajectory',
        component: () => import('#/views/hrm/trajectory/list.vue'),
        meta: {
          icon: 'mdi:map-marker-path',
          title: '考勤轨迹',
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
      {
        path: 'leavemobile', // Ensure relative path
        name: 'HrmLeaveApplicationMobile',
        component: () => import('#/views/hrm/leaveapplication/mobile-list.vue'),
        meta: {
          hideMenu: true,
          title: $t('移动端请假申请'),
        },
      },
    ],
  },
];

export default routes;
