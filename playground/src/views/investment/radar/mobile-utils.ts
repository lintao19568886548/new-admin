import type {
  PublicOpportunityItem,
  RadarOutreachTaskItem,
} from '#/api/investment';

import { formatDateTime } from '@vben/utils';

import { RADAR_STAGE_LABEL_MAP } from './data';

export const priorityOptions = [
  { label: 'A 级', value: 'A' },
  { label: 'B 级', value: 'B' },
  { label: 'C 级', value: 'C' },
];

export const channelOptions = [
  { label: '短信', value: 'SMS' },
  { label: '电话', value: 'CALL' },
  { label: '微信', value: 'WECHAT' },
  { label: '邮件', value: 'EMAIL' },
  { label: '拜访', value: 'VISIT' },
];

export const replyStatusOptions = [
  { label: '未回复', value: 'NO_REPLY' },
  { label: '已回复', value: 'REPLIED' },
  { label: '正向反馈', value: 'POSITIVE' },
  { label: '负向反馈', value: 'NEGATIVE' },
];

export const taskStatusOptions = [
  { label: '待执行', value: 'PENDING' },
  { label: '执行中', value: 'RUNNING' },
  { label: '已发送', value: 'SENT' },
  { label: '执行成功', value: 'SUCCESS' },
  { label: '发送失败', value: 'FAILED' },
  { label: '执行异常', value: 'ERROR' },
];

export const taskTypeOptions = [
  { label: '外呼触达', value: 'OUTREACH' },
  { label: '跟进', value: 'FOLLOW_UP' },
  { label: '预约拜访', value: 'VISIT' },
];

const channelLabelMap: Record<string, string> = {
  CALL: '电话',
  EMAIL: '邮件',
  SMS: '短信',
  VISIT: '拜访',
  WECHAT: '微信',
};

const opportunityTypeMetaMap: Record<string, { color: string; label: string }> =
  {
    DEMAND: { color: 'blue', label: '需求' },
    SUPPLY: { color: 'green', label: '房源' },
  };

const replyStatusMetaMap: Record<string, { color: string; label: string }> = {
  NEGATIVE: { color: 'red', label: '负向反馈' },
  NO_REPLY: { color: 'default', label: '未回复' },
  POSITIVE: { color: 'green', label: '正向反馈' },
  REPLIED: { color: 'cyan', label: '已回复' },
};

const taskStatusMetaMap: Record<string, { color: string; label: string }> = {
  ERROR: { color: 'red', label: '执行异常' },
  FAILED: { color: 'red', label: '发送失败' },
  PENDING: { color: 'gold', label: '待执行' },
  REPLIED: { color: 'cyan', label: '已回复' },
  RUNNING: { color: 'processing', label: '执行中' },
  SENT: { color: 'green', label: '已发送' },
  SUCCESS: { color: 'green', label: '执行成功' },
};

const taskTypeLabelMap: Record<string, string> = {
  FOLLOW_UP: '跟进',
  OUTREACH: '外呼触达',
  VISIT: '预约拜访',
};

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

export function formatTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

export function formatDateOnly(value?: null | string) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const parts: Record<string, string> = {};
  for (const part of shanghaiDateFormatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatCollectTaskStatus(status?: null | string) {
  if (status === 'SUCCESS') {
    return '采集成功';
  }
  if (status === 'FAILED') {
    return '采集失败';
  }
  if (status === 'RUNNING') {
    return '采集中';
  }
  if (status === 'PENDING') {
    return '待采集';
  }
  return status || '-';
}

export function formatNumber(value?: null | number) {
  if (value === null || value === undefined) {
    return '-';
  }
  return Number(value).toLocaleString('zh-CN');
}

export function formatArea(record: PublicOpportunityItem) {
  if (
    record.areaText &&
    record.areaSqm !== null &&
    record.areaSqm !== undefined
  ) {
    return `${record.areaText} / ${formatNumber(record.areaSqm)} ㎡`;
  }
  if (record.areaText) {
    return record.areaText;
  }
  if (record.areaSqm !== null && record.areaSqm !== undefined) {
    return `${formatNumber(record.areaSqm)} ㎡`;
  }
  return '-';
}

export function getPriorityColor(priorityLevel?: null | string) {
  if (priorityLevel === 'A') {
    return 'red';
  }
  if (priorityLevel === 'B') {
    return 'orange';
  }
  if (priorityLevel === 'C') {
    return 'blue';
  }
  return 'default';
}

export function getStageLabel(stage?: null | string) {
  if (!stage) {
    return '-';
  }
  return RADAR_STAGE_LABEL_MAP[stage] || stage;
}

export function getOpportunityTypeMeta(type?: null | string) {
  if (!type) {
    return { color: 'default', label: '-' };
  }
  return opportunityTypeMetaMap[type] || { color: 'default', label: type };
}

export function getTaskStatusMeta(status?: null | string) {
  if (!status) {
    return { color: 'default', label: '-' };
  }
  return taskStatusMetaMap[status] || { color: 'default', label: status };
}

export function getReplyStatusMeta(status?: null | string) {
  if (!status) {
    return { color: 'default', label: '-' };
  }
  return replyStatusMetaMap[status] || { color: 'default', label: status };
}

export function mapChannel(channel?: null | string) {
  if (!channel) {
    return '-';
  }
  return channelLabelMap[channel] || channel;
}

export function mapTaskType(taskType?: null | string) {
  if (!taskType) {
    return '-';
  }
  return taskTypeLabelMap[taskType] || taskType;
}

export function renderTaskResult(record: RadarOutreachTaskItem) {
  return (
    record.replyContent ||
    record.resultMessage ||
    record.resultCode ||
    record.templateCode ||
    '-'
  );
}
