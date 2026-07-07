import type { RepairOrder } from '#/api/maintenance';

export type RepairOrderWorkflowAction =
  | 'accept'
  | 'cancel'
  | 'finish'
  | 'return'
  | 'verify';

export interface RepairOrderWorkflowActionMeta {
  action: RepairOrderWorkflowAction;
  content: string;
  okText: string;
  placeholder?: string;
  requireRemark?: boolean;
  text: string;
  title: string;
}

const ACTION_META: Record<
  RepairOrderWorkflowAction,
  Omit<RepairOrderWorkflowActionMeta, 'action'>
> = {
  accept: {
    content: '接单后工单状态会变为处理中，并记录接单时间。',
    okText: '确认接单',
    text: '接单',
    title: '确认接单',
  },
  cancel: {
    content: '取消后该工单将不再进入首页待办，请填写取消原因。',
    okText: '确认取消',
    placeholder: '请输入取消原因',
    requireRemark: true,
    text: '取消',
    title: '取消工单',
  },
  finish: {
    content: '提交后工单状态会变为待验收，请填写本次维修处理说明。',
    okText: '提交完工',
    placeholder: '请输入维修处理说明',
    requireRemark: true,
    text: '提交完工',
    title: '提交完工',
  },
  return: {
    content: '退回后工单状态会回到处理中，请填写退回原因。',
    okText: '确认退回',
    placeholder: '请输入退回原因',
    requireRemark: true,
    text: '退回处理',
    title: '退回处理',
  },
  verify: {
    content: '验收通过后工单状态会变为已完成，并记录验收时间。',
    okText: '验收通过',
    placeholder: '可填写验收说明',
    text: '验收通过',
    title: '验收通过',
  },
};

export function getRepairOrderWorkflowActionMeta(
  action: RepairOrderWorkflowAction,
): RepairOrderWorkflowActionMeta {
  return {
    action,
    ...ACTION_META[action],
  };
}

export function getRepairOrderWorkflowActions(
  record: Pick<RepairOrder, 'status'>,
): RepairOrderWorkflowActionMeta[] {
  const status = String(record.status || '');
  const actions: RepairOrderWorkflowAction[] = [];

  if (status === '待接单') {
    actions.push('accept', 'cancel');
  }
  if (status === '处理中') {
    actions.push('finish', 'cancel');
  }
  if (status === '待验收') {
    actions.push('verify', 'return');
  }

  return actions.map((action) => getRepairOrderWorkflowActionMeta(action));
}
