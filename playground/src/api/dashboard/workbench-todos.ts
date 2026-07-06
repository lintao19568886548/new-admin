import { requestClient } from '#/api/request';

export type DashboardWorkbenchTodoType =
  | 'attendance_abnormal'
  | 'contract_expire'
  | 'investment_lead'
  | 'rent_unreceived'
  | 'repair_order'
  | 'vacant_factory';

export interface DashboardWorkbenchTodo {
  businessId: string;
  businessName: string;
  content: string;
  createTime?: string;
  dueTime?: string;
  meta?: Record<string, unknown>;
  parkId?: number;
  parkName?: string;
  phoneNumber?: string;
  priority: 'normal' | 'urgent' | 'warning';
  routeName?: string;
  routePath: string;
  routeQuery?: Record<string, number | string>;
  status: 'pending';
  title: string;
  todoId: string;
  type: DashboardWorkbenchTodoType;
}

export interface DashboardWorkbenchTodoSection {
  count: number;
  items: DashboardWorkbenchTodo[];
  key: DashboardWorkbenchTodoType;
  title: string;
}

export interface DashboardWorkbenchTodosResult {
  generatedAt: string;
  notificationItems?: DashboardWorkbenchTodo[];
  sections: DashboardWorkbenchTodoSection[];
  summary: {
    byType?: Partial<Record<DashboardWorkbenchTodoType, number>>;
    total: number;
    unreceivedAmount?: number;
  };
}

let pendingWorkbenchTodosRequest:
  | Promise<DashboardWorkbenchTodosResult>
  | undefined;

export function invalidateDashboardWorkbenchTodos() {
  pendingWorkbenchTodosRequest = undefined;
}

export async function getDashboardWorkbenchTodos(
  options: { force?: boolean } = {},
) {
  if (options.force) {
    invalidateDashboardWorkbenchTodos();
  }

  if (!pendingWorkbenchTodosRequest) {
    pendingWorkbenchTodosRequest = requestClient
      .get<DashboardWorkbenchTodosResult>('/dashboard/workbench-todos')
      .finally(() => {
        pendingWorkbenchTodosRequest = undefined;
      });
  }

  return pendingWorkbenchTodosRequest;
}
