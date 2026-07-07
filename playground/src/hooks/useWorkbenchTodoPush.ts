import type { Router } from 'vue-router';

import type { DashboardWorkbenchTodo } from '#/api/dashboard';

import { computed } from 'vue';

import { useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';

import { getDashboardWorkbenchTodos } from '#/api/dashboard';
import { subscribeWorkbenchTodoChanged } from '#/utils/workbench-todo-sync';

const WORKBENCH_TODO_PUSH_INTERVAL = 3 * 60 * 60 * 1000;
const WORKBENCH_TODO_PUSH_STORAGE_KEY = 'dashboard-workbench-todo-pushed-ids';

let activeRouter: null | Router = null;
let isRefreshing = false;
let pushedWorkbenchTodoIds = new Set<string>();
let stopWorkbenchTodoChanged: (() => void) | undefined;
let workbenchTodoPushTimer: ReturnType<typeof setInterval> | undefined;

export function useWorkbenchTodoPush(router?: Router) {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const isAuthenticated = computed(() => Boolean(accessStore.accessToken));

  if (router) {
    activeRouter = router;
  }

  function startWorkbenchTodoPush(options: { immediate?: boolean } = {}) {
    if (!isAuthenticated.value) {
      stopWorkbenchTodoPush();
      return;
    }

    restorePushedWorkbenchTodoIds();

    if (!stopWorkbenchTodoChanged) {
      stopWorkbenchTodoChanged = subscribeWorkbenchTodoChanged(() => {
        void refreshAndPushWorkbenchTodos({ force: true });
      });
    }

    if (options.immediate) {
      void refreshAndPushWorkbenchTodos();
    }

    if (workbenchTodoPushTimer) {
      return;
    }

    workbenchTodoPushTimer = setInterval(() => {
      void refreshAndPushWorkbenchTodos();
    }, WORKBENCH_TODO_PUSH_INTERVAL);
  }

  function stopWorkbenchTodoPush() {
    if (workbenchTodoPushTimer) {
      clearInterval(workbenchTodoPushTimer);
      workbenchTodoPushTimer = undefined;
    }

    stopWorkbenchTodoChanged?.();
    stopWorkbenchTodoChanged = undefined;
  }

  async function refreshAndPushWorkbenchTodos(
    options: { force?: boolean } = {},
  ) {
    if (!isAuthenticated.value || isRefreshing) {
      return;
    }

    isRefreshing = true;
    try {
      const todos = await getDashboardWorkbenchTodos({ force: options.force });
      const sections = Array.isArray(todos?.sections) ? todos.sections : [];
      const notificationItems = Array.isArray(todos?.notificationItems)
        ? todos.notificationItems
        : sections.flatMap((section) => section.items);
      pushWorkbenchTodoNotifications(notificationItems);
    } catch (error) {
      console.error('workbench todo push refresh failed', error);
    } finally {
      isRefreshing = false;
    }
  }

  function pushWorkbenchTodoNotifications(todos: DashboardWorkbenchTodo[]) {
    if (!isAuthenticated.value) {
      return;
    }

    const newTodos = todos
      .filter((todo) => !pushedWorkbenchTodoIds.has(todo.todoId))
      .sort(compareTodoPriority);

    if (newTodos.length === 0) {
      return;
    }

    newTodos.forEach((todo) => pushedWorkbenchTodoIds.add(todo.todoId));
    persistPushedWorkbenchTodoIds();

    newTodos.slice(0, 3).forEach((todo) => {
      getTodoNotificationApi(todo.priority)({
        description: todo.content,
        duration: todo.priority === 'urgent' ? 0 : 8,
        key: `workbench-todo-${todo.todoId}`,
        message: `${getTodoPriorityText(todo.priority)}｜${todo.title}`,
        onClick: () => {
          void goTodo(todo);
        },
        placement: 'topRight',
      });
    });

    if (newTodos.length > 3) {
      notification.info({
        description: `还有 ${newTodos.length - 3} 条待办，请在首页工作台查看。`,
        duration: 6,
        key: 'workbench-todo-more',
        message: '首页待办提醒',
        onClick: () => {
          void activeRouter?.push('/home');
        },
        placement: 'topRight',
      });
    }
  }

  function restorePushedWorkbenchTodoIds() {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const ids = JSON.parse(
        sessionStorage.getItem(getWorkbenchTodoPushStorageKey()) || '[]',
      );
      if (!Array.isArray(ids)) {
        return;
      }

      pushedWorkbenchTodoIds = new Set(
        ids.filter((id): id is string => typeof id === 'string' && Boolean(id)),
      );
    } catch {
      pushedWorkbenchTodoIds = new Set<string>();
    }
  }

  function persistPushedWorkbenchTodoIds() {
    if (typeof window === 'undefined') {
      return;
    }

    sessionStorage.setItem(
      getWorkbenchTodoPushStorageKey(),
      JSON.stringify([...pushedWorkbenchTodoIds].slice(-200)),
    );
  }

  function getWorkbenchTodoPushStorageKey() {
    const userKey =
      userStore.userInfo?.username || userStore.userInfo?.realName || 'guest';
    return `${WORKBENCH_TODO_PUSH_STORAGE_KEY}:${userKey}`;
  }

  async function goTodo(todo: DashboardWorkbenchTodo) {
    if (!activeRouter) {
      return;
    }

    try {
      await activeRouter.push({
        path: todo.routePath,
        query: normalizeRouteQuery(todo.routeQuery),
      });
    } catch (error) {
      console.error('go workbench todo failed:', error);
    }
  }

  return {
    refreshAndPushWorkbenchTodos,
    startWorkbenchTodoPush,
    stopWorkbenchTodoPush,
  };
}

function getTodoNotificationApi(priority: DashboardWorkbenchTodo['priority']) {
  if (priority === 'urgent') {
    return notification.error;
  }
  if (priority === 'warning') {
    return notification.warning;
  }
  return notification.info;
}

function getTodoPriorityText(priority: DashboardWorkbenchTodo['priority']) {
  if (priority === 'urgent') {
    return '紧急处理';
  }
  if (priority === 'warning') {
    return '重点关注';
  }
  return '常规提醒';
}

function compareTodoPriority(
  first: DashboardWorkbenchTodo,
  second: DashboardWorkbenchTodo,
) {
  const priorityDiff =
    getTodoPriorityWeight(first.priority) -
    getTodoPriorityWeight(second.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const riskDiff = getTodoRiskScore(second) - getTodoRiskScore(first);
  if (riskDiff !== 0) {
    return riskDiff;
  }

  const firstTime = new Date(first.dueTime || first.createTime || 0).getTime();
  const secondTime = new Date(
    second.dueTime || second.createTime || 0,
  ).getTime();
  return firstTime - secondTime;
}

function getTodoPriorityWeight(priority: DashboardWorkbenchTodo['priority']) {
  if (priority === 'urgent') {
    return 0;
  }
  if (priority === 'warning') {
    return 1;
  }
  return 2;
}

function getTodoRiskScore(todo: DashboardWorkbenchTodo) {
  const value = todo.meta?.riskScore;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function normalizeRouteQuery(query?: Record<string, number | string>) {
  return Object.fromEntries(
    Object.entries(query ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Record<string, number | string>;
}
