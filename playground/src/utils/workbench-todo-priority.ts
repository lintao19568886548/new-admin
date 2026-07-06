import { h } from 'vue';

import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

export type WorkbenchTodoPriority = 'normal' | 'urgent' | 'warning';

export interface WorkbenchTodoPriorityInfo {
  color: string;
  label: string;
  priority: WorkbenchTodoPriority;
  reason: string;
  visible: boolean;
}

function createPriorityInfo(
  priority: WorkbenchTodoPriority,
  reason: string,
  visible = true,
): WorkbenchTodoPriorityInfo {
  return {
    color: getWorkbenchPriorityColor(priority),
    label: getWorkbenchPriorityLabel(priority),
    priority,
    reason,
    visible,
  };
}

export function getWorkbenchPriorityLabel(priority: WorkbenchTodoPriority) {
  if (priority === 'urgent') {
    return '紧急处理';
  }
  if (priority === 'warning') {
    return '重点关注';
  }
  return '常规提醒';
}

export function getWorkbenchPriorityColor(priority: WorkbenchTodoPriority) {
  if (priority === 'urgent') {
    return 'red';
  }
  if (priority === 'warning') {
    return 'orange';
  }
  return 'blue';
}

export function renderWorkbenchTodoPriorityInfo(
  info: WorkbenchTodoPriorityInfo,
) {
  if (!info.visible) {
    return '';
  }

  return h(
    'div',
    {
      class:
        'flex min-w-[220px] items-center gap-2 overflow-hidden py-1 leading-5',
    },
    [
      h(Tag, { class: 'm-0 flex-none', color: info.color }, () => info.label),
      h(
        'span',
        {
          class: 'min-w-0 flex-1 truncate text-xs leading-5 text-gray-500',
          title: info.reason,
        },
        info.reason,
      ),
    ],
  );
}

export function getRentTodoPriorityInfo(
  remainingAmount: number,
): WorkbenchTodoPriorityInfo {
  if (remainingAmount >= 10_000) {
    return createPriorityInfo('urgent', '未收金额 1 万元以上');
  }
  if (remainingAmount >= 1000) {
    return createPriorityInfo('warning', '未收金额 1000 元以上');
  }
  return createPriorityInfo('normal', '常规催收跟进', remainingAmount > 0);
}

export function getContractTodoPriorityInfo(
  contractEnd?: Date | null | string,
): WorkbenchTodoPriorityInfo {
  if (!contractEnd) {
    return createPriorityInfo('normal', '合同到期日未填写', false);
  }

  const endDate = dayjs(contractEnd);
  if (!endDate.isValid()) {
    return createPriorityInfo('normal', '合同到期日格式异常', false);
  }

  const days = endDate.startOf('day').diff(dayjs().startOf('day'), 'day');
  if (days < 0) {
    return createPriorityInfo('urgent', `合同已过期 ${Math.abs(days)} 天`);
  }
  if (days === 0) {
    return createPriorityInfo('warning', '合同今天到期');
  }
  if (days <= 7) {
    return createPriorityInfo('warning', `合同 ${days} 天后到期`);
  }
  if (days <= 30) {
    return createPriorityInfo('normal', `合同 ${days} 天后到期`);
  }
  return createPriorityInfo('normal', '合同仍在有效期', false);
}

function getInvestmentProgressStage(progress?: null | string) {
  const text = String(progress || '');
  if (text.includes('签约')) {
    return 'signed';
  }
  if (text.includes('合同')) {
    return 'contract';
  }
  if (
    text.includes('深入') ||
    text.includes('沟通') ||
    text.includes('谈判') ||
    text.includes('报价') ||
    text.includes('看房') ||
    text.includes('跟进')
  ) {
    return 'active';
  }
  if (text.includes('初步') || text.includes('接洽')) {
    return 'initial';
  }
  return 'unknown';
}

function getInvestmentIntentLevel(intentLevel?: null | string) {
  const level = String(intentLevel || '').toLowerCase();
  if (level.includes('很高') || level.startsWith('a')) {
    return 'very_high';
  }
  if (level.includes('高')) {
    return 'high';
  }
  if (level.includes('中') || level.includes('一般') || level.startsWith('b')) {
    return 'medium';
  }
  return 'low';
}

function isBeforeToday(value?: Date | null | string) {
  if (!value) {
    return false;
  }
  const date = dayjs(value);
  return date.isValid() && date.startOf('day').isBefore(dayjs().startOf('day'));
}

export function getInvestmentTodoPriorityInfo(
  progress?: null | string,
  meetingTime?: Date | null | string,
  intentLevel?: null | string,
): WorkbenchTodoPriorityInfo {
  const stage = getInvestmentProgressStage(progress);
  const intent = getInvestmentIntentLevel(intentLevel);
  const overdue = isBeforeToday(meetingTime);
  const highIntent = ['high', 'very_high'].includes(intent);

  if (stage === 'signed') {
    return createPriorityInfo('normal', '已签约完成', false);
  }

  if (stage === 'contract') {
    if (overdue && highIntent) {
      return createPriorityInfo('urgent', '合同阶段、会谈逾期且客户意向高');
    }
    if (overdue) {
      return createPriorityInfo('urgent', '合同阶段会谈已逾期');
    }
    if (highIntent) {
      return createPriorityInfo('urgent', '合同阶段且客户意向高');
    }
    return createPriorityInfo('warning', '合同阶段需推进签约');
  }

  if (stage === 'active') {
    if (overdue && highIntent) {
      return createPriorityInfo('urgent', '深度跟进逾期且客户意向高');
    }
    if (overdue) {
      return createPriorityInfo('warning', '会谈时间已逾期');
    }
    if (highIntent) {
      return createPriorityInfo('warning', '客户意向较高');
    }
    return createPriorityInfo('normal', '持续跟进客户');
  }

  if (stage === 'initial') {
    if (overdue) {
      return createPriorityInfo('warning', '初步接洽已逾期');
    }
    if (highIntent) {
      return createPriorityInfo('warning', '初步接洽但客户意向较高');
    }
    return createPriorityInfo('normal', '初步接洽，常规跟进');
  }

  if (overdue) {
    return createPriorityInfo('warning', '跟进时间已逾期');
  }
  if (highIntent) {
    return createPriorityInfo('warning', '客户意向较高');
  }
  return createPriorityInfo('normal', '常规招商跟进');
}

export function getRepairOrderTodoPriorityInfo(
  priority?: null | string,
  status?: null | string,
): WorkbenchTodoPriorityInfo {
  const priorityText = String(priority || '');
  const statusText = String(status || '');

  if (['已取消', '已完成'].includes(statusText)) {
    return createPriorityInfo('normal', `工单${statusText}`, false);
  }

  if (priorityText.includes('紧急')) {
    return createPriorityInfo('urgent', '紧急工单需优先处理');
  }

  if (statusText === '待接单') {
    return createPriorityInfo('warning', '工单待接单，需尽快响应');
  }

  if (statusText === '处理中') {
    return createPriorityInfo('warning', '工单处理中，需跟进进度');
  }

  if (statusText === '待验收') {
    return createPriorityInfo('normal', '工单待验收，常规收口');
  }

  return createPriorityInfo('normal', '常规工单处理', false);
}

export function getAttendanceRecordPriorityInfo(
  statusText?: null | string,
): WorkbenchTodoPriorityInfo {
  const text = String(statusText || '');
  const late = text.includes('迟到');
  const earlyLeave = text.includes('早退');

  if (late && earlyLeave) {
    return createPriorityInfo('urgent', '同一天迟到且早退');
  }
  if (late) {
    return createPriorityInfo('warning', '存在迟到记录');
  }
  if (earlyLeave) {
    return createPriorityInfo('warning', '存在早退记录');
  }
  return createPriorityInfo('normal', '考勤状态正常', false);
}

export function getVacantFactoryTodoPriorityInfo(
  availableArea: number,
): WorkbenchTodoPriorityInfo {
  if (availableArea >= 5000) {
    return createPriorityInfo('urgent', '空置面积 5000㎡ 以上');
  }
  if (availableArea >= 1000) {
    return createPriorityInfo('warning', '空置面积 1000㎡ 以上');
  }
  return createPriorityInfo('normal', '常规招商推广', availableArea > 0);
}
