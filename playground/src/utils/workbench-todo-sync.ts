export const WORKBENCH_TODO_CHANGED_EVENT = 'workbench-todo:changed';

export interface WorkbenchTodoChangedDetail {
  reason?: string;
  source?: string;
}

export function notifyWorkbenchTodoChanged(
  detail: WorkbenchTodoChangedDetail = {},
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<WorkbenchTodoChangedDetail>(WORKBENCH_TODO_CHANGED_EVENT, {
      detail,
    }),
  );
}

export async function notifyWorkbenchTodoChangedAfter<T>(
  promise: Promise<T>,
  detail: WorkbenchTodoChangedDetail = {},
) {
  const result = await promise;
  notifyWorkbenchTodoChanged(detail);
  return result;
}

export function subscribeWorkbenchTodoChanged(
  handler: (detail: WorkbenchTodoChangedDetail) => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event: Event) => {
    handler((event as CustomEvent<WorkbenchTodoChangedDetail>).detail || {});
  };
  window.addEventListener(WORKBENCH_TODO_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(WORKBENCH_TODO_CHANGED_EVENT, listener);
  };
}
