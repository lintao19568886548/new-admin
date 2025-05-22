import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'material-symbols:group-outline',
      order: 9000,
      title: '人力资源',
    },
    name: 'HRM',
    path: '/hrm',
    redirect: '/hrm/information',
    children: [
      {
        path: '/hrm/information',
        name: 'HrmInformation',
        component: () => import('#/views/hrm/information/list.vue'),
        meta: {
          icon: 'mdi:account-multiple-outline',
          title: '人员管理',
        },
      },
      {
        path: '/hrm/attendance',
        name: 'HrmAttendance',
        meta: {
          icon: 'mdi:calendar-clock',
          title: '考勤管理',
        },
        children: [],
      },
      {
        path: '/hrm/payroll',
        name: 'HrmPayroll',
        meta: {
          icon: 'mdi:cash-multiple',
          title: '薪资管理',
        },
        children: [],
      },
    ],
  },
];

export default routes;
