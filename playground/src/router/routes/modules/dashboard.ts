import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const showLocalAgentMenus = import.meta.env.DEV;

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -999,
      title: $t('page.dashboard.title'),
    },
    name: 'Dashboard',
    path: '/dashboard',
    children: [
      {
        name: 'Analytics',
        path: '/analytics',
        component: () => import('#/views/dashboard/analytics/index.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:area-chart',
          order: 1,
          title: $t('page.dashboard.analytics'),
        },
      },
      {
        name: 'Tools',
        path: '/tools',
        redirect: '/tools/agent-workbench',
        meta: {
          hideInMenu: !showLocalAgentMenus,
          icon: 'lucide:bot',
          order: 2,
          title: $t('page.tools.title'),
        },
        children: [
          {
            name: 'AgentWorkbench',
            path: '/tools/agent-workbench',
            component: () =>
              import('#/views/dashboard/agent-workbench/index.vue'),
            meta: {
              hideInMenu: !showLocalAgentMenus,
              icon: 'lucide:messages-square',
              order: 1,
              title: 'Agent工作台',
            },
          },
          {
            name: 'AiToolsWebtools',
            path: '/tools/webtools',
            component: () => import('#/views/tools/webtools.vue'),
            meta: {
              hideInMenu: !showLocalAgentMenus,
              icon: 'lucide:panel-top',
              order: 2,
              title: 'AI工具导航',
            },
          },
          {
            name: 'AgentTaskCenter',
            path: '/tools/agent-tasks',
            component: () => import('#/views/agent/task-list.vue'),
            meta: {
              hideInMenu: !showLocalAgentMenus,
              icon: 'lucide:list-checks',
              order: 3,
              title: '任务中心',
            },
          },
          {
            name: 'AgentTaskDetail',
            path: '/tools/agent-tasks/detail',
            component: () => import('#/views/agent/task-detail.vue'),
            meta: {
              activePath: '/tools/agent-tasks',
              hideInMenu: true,
              icon: 'lucide:file-search',
              order: 3.1,
              title: '任务详情',
            },
          },
          {
            name: 'AgentSkillCenter',
            path: '/tools/agent-skills',
            component: () => import('#/views/agent/skill-center.vue'),
            meta: {
              hideInMenu: !showLocalAgentMenus,
              icon: 'lucide:blocks',
              order: 4,
              title: 'Skill中心',
            },
          },
          {
            name: 'AgentModelConfig',
            path: '/tools/agent-models',
            component: () => import('#/views/agent/model-config.vue'),
            meta: {
              hideInMenu: !showLocalAgentMenus,
              icon: 'lucide:sliders-horizontal',
              order: 5,
              title: '模型配置',
            },
          },
        ],
      },
      {
        name: 'ProfileVipMembership',
        path: '/profile/vip-membership',
        component: () => import('#/views/profile/vip-membership.vue'),
        meta: {
          activePath: '/profile',
          hideInMenu: true,
          icon: 'mdi:account-group-outline',
          isApp: true,
          order: 2,
          title: '创建内部团队',
        },
      },
    ],
  },
];

export default routes;
