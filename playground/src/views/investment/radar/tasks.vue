<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  RadarOutreachTaskDetail,
  RadarOutreachTaskListItem,
  RadarOutreachTaskListParams,
  RadarOutreachTaskSummary,
} from '#/api/investment';

import { h, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { useMediaQuery } from '@vueuse/core';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getRadarOutreachTaskDetail,
  getRadarOutreachTaskList,
} from '#/api/investment';

import { RADAR_STAGE_LABEL_MAP, RADAR_STAGE_OPTIONS } from './data';

defineOptions({ name: 'InvestmentRadarTasks' });

const router = useRouter();
const route = useRoute();
const isMobile = useMediaQuery('(max-width: 767px)');
const loadError = ref('');
const tableLoading = ref(false);
const detailDrawerOpen = ref(false);
const detailLoading = ref(false);
const mobileFilterOpen = ref(false);
const taskDetail = ref<null | RadarOutreachTaskDetail>(null);
const items = ref<RadarOutreachTaskListItem[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const summary = ref<RadarOutreachTaskSummary>({
  callTasks: 0,
  failedTasks: 0,
  pendingTasks: 0,
  positiveReplies: 0,
  repliedTasks: 0,
  sentTasks: 0,
  smsTasks: 0,
  totalTasks: 0,
});
const tableLocale = {
  emptyText: '暂无触达任务',
};

const searchForm = ref({
  channel: undefined as string | undefined,
  keyword: '',
  priorityLevel: undefined as string | undefined,
  replyStatus: undefined as string | undefined,
  stage: undefined as string | undefined,
  status: undefined as string | undefined,
  taskType: undefined as string | undefined,
});

const channelLabelMap: Record<string, string> = {
  CALL: '电话',
  EMAIL: '邮件',
  SMS: '短信',
  VISIT: '拜访',
  WECHAT: '微信',
};

const channelColorMap: Record<string, string> = {
  CALL: 'purple',
  EMAIL: 'cyan',
  SMS: 'blue',
  VISIT: 'orange',
  WECHAT: 'green',
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

const channelOptions = [
  { label: '短信', value: 'SMS' },
  { label: '电话', value: 'CALL' },
  { label: '微信', value: 'WECHAT' },
  { label: '邮件', value: 'EMAIL' },
  { label: '拜访', value: 'VISIT' },
];

const priorityOptions = [
  { label: 'A 级', value: 'A' },
  { label: 'B 级', value: 'B' },
  { label: 'C 级', value: 'C' },
];

const replyStatusOptions = [
  { label: '未回复', value: 'NO_REPLY' },
  { label: '已回复', value: 'REPLIED' },
  { label: '正向反馈', value: 'POSITIVE' },
  { label: '负向反馈', value: 'NEGATIVE' },
];

const statusOptions = [
  { label: '待执行', value: 'PENDING' },
  { label: '执行中', value: 'RUNNING' },
  { label: '已发送', value: 'SENT' },
  { label: '执行成功', value: 'SUCCESS' },
  { label: '发送失败', value: 'FAILED' },
  { label: '执行异常', value: 'ERROR' },
];

const taskTypeOptions = [
  { label: '外呼触达', value: 'OUTREACH' },
  { label: '跟进', value: 'FOLLOW_UP' },
  { label: '预约拜访', value: 'VISIT' },
];

const columns: TableColumnsType<RadarOutreachTaskListItem> = [
  {
    customRender: ({ record }) => renderEnterprise(record),
    dataIndex: 'enterpriseName',
    key: 'enterpriseName',
    title: '线索企业',
    width: 240,
  },
  {
    customRender: ({ record }) => renderLeadStatus(record),
    dataIndex: 'stage',
    key: 'stage',
    title: '线索阶段',
    width: 150,
  },
  {
    customRender: ({ record }) => renderTaskInfo(record),
    dataIndex: 'taskType',
    key: 'taskType',
    title: '触达任务',
    width: 180,
  },
  {
    customRender: ({ record }) => renderTaskStatusGroup(record),
    dataIndex: 'status',
    key: 'status',
    title: '任务状态',
    width: 180,
  },
  {
    customRender: ({ record }) => renderContact(record),
    dataIndex: 'phoneNumber',
    key: 'phoneNumber',
    title: '触达对象',
    width: 180,
  },
  {
    customRender: ({ text }) => text || '-',
    dataIndex: 'templateCode',
    key: 'templateCode',
    title: '模板编码',
    width: 140,
  },
  {
    customRender: ({ record }) => renderTaskTime(record),
    dataIndex: 'sentAt',
    key: 'sentAt',
    title: '任务时间',
    width: 220,
  },
  {
    customRender: ({ text }) => text || '-',
    dataIndex: 'sentByName',
    key: 'sentByName',
    title: '操作人',
    width: 120,
  },
  {
    customRender: ({ record }) => renderResult(record),
    dataIndex: 'resultMessage',
    key: 'resultMessage',
    title: '执行与回复',
    width: 320,
  },
  {
    customRender: ({ record }) =>
      h(Space, {}, () => [
        hButton('任务详情', () => openTaskDetail(record.taskId)),
        hButton('查看线索', () => goToLeadDetail(record.leadId)),
      ]),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 160,
  },
];

function buildParams(): RadarOutreachTaskListParams {
  return {
    channel: searchForm.value.channel,
    currentPage: currentPage.value,
    keyword: searchForm.value.keyword || undefined,
    pageSize: pageSize.value,
    priorityLevel: searchForm.value.priorityLevel,
    replyStatus: searchForm.value.replyStatus,
    stage: searchForm.value.stage,
    status: searchForm.value.status,
    taskType: searchForm.value.taskType,
  };
}

function formatTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function formatNumber(value?: null | number) {
  if (value === null || value === undefined) {
    return '-';
  }
  return Number(value).toLocaleString('zh-CN');
}

function hButton(label: string, onClick: () => void) {
  return h(
    Button,
    {
      onClick,
      size: 'small',
      type: 'link',
    },
    () => label,
  );
}

function getPriorityColor(priorityLevel?: null | string) {
  if (priorityLevel === 'A') {
    return 'red';
  }
  if (priorityLevel === 'B') {
    return 'orange';
  }
  return 'blue';
}

function mapChannel(channel?: null | string) {
  if (!channel) {
    return '-';
  }
  return channelLabelMap[channel] || channel;
}

function mapTaskType(taskType?: null | string) {
  if (!taskType) {
    return '-';
  }
  return taskTypeLabelMap[taskType] || taskType;
}

function renderChannel(channel?: null | string) {
  if (!channel) {
    return '-';
  }
  return h(Tag, { color: channelColorMap[channel] || 'default' }, () =>
    mapChannel(channel),
  );
}

function renderContact(record: RadarOutreachTaskListItem) {
  return h('div', { class: 'leading-6' }, [
    h('div', record.contactName || '-'),
    h(
      'div',
      { class: 'text-text-secondary text-xs' },
      record.phoneNumber || '-',
    ),
  ]);
}

function renderEnterprise(record: RadarOutreachTaskListItem) {
  return h('div', { class: 'min-w-0 leading-6' }, [
    h('div', { class: 'truncate font-medium' }, record.enterpriseName || '-'),
    h(
      'div',
      { class: 'text-text-secondary truncate text-xs' },
      `${record.parkName || '-'} | ${record.latestSignalType || '-'}`,
    ),
  ]);
}

function renderLeadStatus(record: RadarOutreachTaskListItem) {
  const stageText = RADAR_STAGE_LABEL_MAP[record.stage] || record.stage || '-';

  return h(Space, { size: 4, wrap: true }, () => [
    h(
      Tag,
      { color: record.stage === 'PENDING_CONTACT' ? 'gold' : 'blue' },
      () => stageText,
    ),
    h(
      Tag,
      { color: getPriorityColor(record.priorityLevel) },
      () => `${record.priorityLevel || '-'} 级`,
    ),
    h(
      'span',
      { class: 'text-text-secondary text-xs' },
      `${record.totalScore}分`,
    ),
  ]);
}

function renderResult(record: RadarOutreachTaskListItem) {
  const parts = [
    record.resultCode ? `结果码：${record.resultCode}` : '',
    record.resultMessage || '',
    record.replyContent ? `回复：${record.replyContent}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : '-';
}

function renderStatusTag(
  status: null | string | undefined,
  metaMap: Record<string, { color: string; label: string }>,
) {
  if (!status) {
    return null;
  }
  const meta = metaMap[status] || { color: 'default', label: status };
  return h(Tag, { color: meta.color }, () => meta.label);
}

function getStatusMeta(
  status: null | string | undefined,
  metaMap: Record<string, { color: string; label: string }>,
) {
  if (!status) {
    return { color: 'default', label: '-' };
  }
  return metaMap[status] || { color: 'default', label: status };
}

function renderTaskInfo(record: RadarOutreachTaskListItem) {
  return h(Space, { size: 4, wrap: true }, () => [
    renderChannel(record.channel),
    h(Tag, { color: 'default' }, () => mapTaskType(record.taskType)),
  ]);
}

function renderTaskStatusGroup(record: RadarOutreachTaskListItem) {
  return h(Space, { size: 4, wrap: true }, () =>
    [
      renderStatusTag(record.status, taskStatusMetaMap),
      renderStatusTag(record.replyStatus, replyStatusMetaMap),
    ].filter(Boolean),
  );
}

function renderTaskTime(record: RadarOutreachTaskListItem) {
  return h('div', { class: 'leading-6' }, [
    h('div', `计划：${formatTime(record.scheduledAt)}`),
    h(
      'div',
      { class: 'text-text-secondary text-xs' },
      `发送：${formatTime(record.sentAt)}`,
    ),
    h(
      'div',
      { class: 'text-text-secondary text-xs' },
      `回复：${formatTime(record.replyTime)}`,
    ),
  ]);
}

async function openTaskDetail(taskId: number | string) {
  detailDrawerOpen.value = true;
  detailLoading.value = true;
  taskDetail.value = null;

  try {
    taskDetail.value = await getRadarOutreachTaskDetail(taskId);
  } catch (error) {
    console.error('加载雷达触达任务详情失败:', error);
    taskDetail.value = null;
  } finally {
    detailLoading.value = false;
  }
}

async function loadTasks() {
  tableLoading.value = true;
  loadError.value = '';
  try {
    const result = await getRadarOutreachTaskList(buildParams());
    items.value = Array.isArray(result.items) ? result.items : [];
    total.value =
      typeof result.total === 'number'
        ? result.total
        : result.page?.total || Math.max(items.value.length, 0);
    summary.value = result.summary || summary.value;
  } catch (error) {
    console.error('加载雷达触达任务失败:', error);
    items.value = [];
    total.value = 0;
    loadError.value = '任务数据加载失败，请检查雷达触达任务接口是否可用。';
  } finally {
    tableLoading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  mobileFilterOpen.value = false;
  void loadTasks();
}

function handleReset() {
  searchForm.value = {
    channel: undefined,
    keyword: '',
    priorityLevel: undefined,
    replyStatus: undefined,
    stage: undefined,
    status: undefined,
    taskType: undefined,
  };
  mobileFilterOpen.value = false;
  handleSearch();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  currentPage.value = page.current || 1;
  pageSize.value = page.pageSize || 20;
  void loadTasks();
}

function goToLeadDetail(leadId: number) {
  const detailBasePath = route.path.includes('/mobile-tasks')
    ? '/investment/radar/mobile'
    : '/investment/radar';
  router.push(`${detailBasePath}/${leadId}`);
}

function goToRadarList() {
  router.push(
    route.path.includes('/mobile-tasks')
      ? '/investment/radar/mobile'
      : '/investment/radar',
  );
}

onMounted(() => {
  void loadTasks();
});
</script>

<template>
  <div class="radar-task-route">
    <Page
      auto-content-height
      class="radar-collection-page"
      content-class="radar-collection-content"
    >
      <div class="radar-collection-layout">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-lg font-semibold">雷达触达任务</div>
            <div class="text-text-secondary text-sm">
              按任务状态、渠道和回复结果集中推进招商线索。
            </div>
          </div>
          <Space wrap>
            <Button @click="goToRadarList">返回雷达列表</Button>
            <Button type="primary" @click="loadTasks">刷新数据</Button>
          </Space>
        </div>

        <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

        <div v-if="isMobile" class="radar-task-mobile-summary">
          <Card class="radar-task-mobile-stat-card">
            <Statistic title="任务总数" :value="summary.totalTasks" />
          </Card>
          <Card class="radar-task-mobile-stat-card">
            <Statistic title="待执行" :value="summary.pendingTasks" />
          </Card>
          <Card class="radar-task-mobile-stat-card">
            <Statistic title="已回复" :value="summary.repliedTasks" />
          </Card>
          <Card class="radar-task-mobile-stat-card">
            <Statistic title="正向" :value="summary.positiveReplies" />
          </Card>
        </div>

        <Row v-else class="radar-stat-card-grid" :gutter="[12, 12]">
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic title="触达任务总数" :value="summary.totalTasks" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic
                title="待执行 / 执行中"
                :value="summary.pendingTasks"
              />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic title="已回复" :value="summary.repliedTasks" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic title="正向反馈" :value="summary.positiveReplies" />
            </Card>
          </Col>
        </Row>

        <Card v-if="!isMobile" title="查询条件">
          <Form class="radar-task-filter radar-search-form" layout="inline">
            <Form.Item label="关键字">
              <Input
                v-model:value="searchForm.keyword"
                allow-clear
                class="radar-filter-keyword"
                placeholder="企业 / 电话 / 园区 / 模板"
                @press-enter="handleSearch"
              />
            </Form.Item>
            <Form.Item label="任务状态">
              <Select
                v-model:value="searchForm.status"
                allow-clear
                class="radar-filter-control"
                :options="statusOptions"
              />
            </Form.Item>
            <Form.Item label="回复状态">
              <Select
                v-model:value="searchForm.replyStatus"
                allow-clear
                class="radar-filter-control"
                :options="replyStatusOptions"
              />
            </Form.Item>
            <Form.Item label="渠道">
              <Select
                v-model:value="searchForm.channel"
                allow-clear
                class="radar-filter-control"
                :options="channelOptions"
              />
            </Form.Item>
            <Form.Item label="触达类型">
              <Select
                v-model:value="searchForm.taskType"
                allow-clear
                class="radar-filter-control"
                :options="taskTypeOptions"
              />
            </Form.Item>
            <Form.Item label="线索阶段">
              <Select
                v-model:value="searchForm.stage"
                allow-clear
                class="radar-filter-control"
                :options="RADAR_STAGE_OPTIONS"
              />
            </Form.Item>
            <Form.Item label="优先级">
              <Select
                v-model:value="searchForm.priorityLevel"
                allow-clear
                class="radar-filter-control"
                :options="priorityOptions"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" @click="handleSearch">查询</Button>
                <Button @click="handleReset">重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <div v-if="isMobile" class="radar-task-mobile">
          <div class="radar-task-mobile-filter">
            <div class="radar-task-mobile-search">
              <Input
                v-model:value="searchForm.keyword"
                allow-clear
                placeholder="企业 / 电话 / 园区 / 模板"
                @press-enter="handleSearch"
              />
              <Button type="primary" @click="handleSearch">查询</Button>
              <Button @click="mobileFilterOpen = !mobileFilterOpen">
                筛选
              </Button>
            </div>
            <div v-show="mobileFilterOpen" class="radar-task-mobile-panel">
              <div class="radar-task-mobile-grid">
                <Select
                  v-model:value="searchForm.status"
                  allow-clear
                  placeholder="任务状态"
                  :options="statusOptions"
                />
                <Select
                  v-model:value="searchForm.replyStatus"
                  allow-clear
                  placeholder="回复状态"
                  :options="replyStatusOptions"
                />
                <Select
                  v-model:value="searchForm.channel"
                  allow-clear
                  placeholder="渠道"
                  :options="channelOptions"
                />
                <Select
                  v-model:value="searchForm.taskType"
                  allow-clear
                  placeholder="触达类型"
                  :options="taskTypeOptions"
                />
                <Select
                  v-model:value="searchForm.stage"
                  allow-clear
                  placeholder="线索阶段"
                  :options="RADAR_STAGE_OPTIONS"
                />
                <Select
                  v-model:value="searchForm.priorityLevel"
                  allow-clear
                  placeholder="优先级"
                  :options="priorityOptions"
                />
              </div>
              <div class="radar-task-mobile-actions">
                <Button block type="primary" @click="handleSearch">
                  应用筛选
                </Button>
                <Button block @click="handleReset">重置</Button>
              </div>
            </div>
          </div>

          <Skeleton v-if="tableLoading" active :paragraph="{ rows: 8 }" />
          <div v-else-if="items.length > 0" class="radar-task-mobile-list">
            <div
              v-for="item in items"
              :key="item.taskId"
              class="radar-task-mobile-card"
            >
              <div class="radar-task-mobile-head">
                <div>
                  <div class="radar-task-mobile-title">
                    {{ item.enterpriseName || '-' }}
                  </div>
                  <div class="radar-task-mobile-subtitle">
                    {{ item.parkName || '-' }} ·
                    {{ item.latestSignalType || '-' }}
                  </div>
                </div>
                <Tag :color="getPriorityColor(item.priorityLevel)">
                  {{ item.priorityLevel || '-' }} 级
                </Tag>
              </div>

              <div class="radar-task-mobile-tags">
                <Tag
                  :color="getStatusMeta(item.status, taskStatusMetaMap).color"
                >
                  {{ getStatusMeta(item.status, taskStatusMetaMap).label }}
                </Tag>
                <Tag
                  :color="
                    getStatusMeta(item.replyStatus, replyStatusMetaMap).color
                  "
                >
                  {{
                    getStatusMeta(item.replyStatus, replyStatusMetaMap).label
                  }}
                </Tag>
                <Tag :color="channelColorMap[item.channel] || 'default'">
                  {{ mapChannel(item.channel) }}
                </Tag>
                <Tag color="blue">
                  {{ RADAR_STAGE_LABEL_MAP[item.stage] || item.stage || '-' }}
                </Tag>
              </div>

              <div class="radar-task-mobile-info">
                <span>联系人：{{ item.contactName || '-' }}</span>
                <span>电话：{{ item.phoneNumber || '-' }}</span>
                <span>类型：{{ mapTaskType(item.taskType) }}</span>
                <span>计划：{{ formatTime(item.scheduledAt) }}</span>
                <span>发送：{{ formatTime(item.sentAt) }}</span>
                <span>回复：{{ formatTime(item.replyTime) }}</span>
              </div>

              <p v-if="renderResult(item) !== '-'">
                {{ renderResult(item) }}
              </p>

              <div class="radar-task-mobile-card-actions">
                <Button size="small" @click="openTaskDetail(item.taskId)">
                  任务详情
                </Button>
                <Button
                  size="small"
                  type="primary"
                  @click="goToLeadDetail(item.leadId)"
                >
                  查看线索
                </Button>
              </div>
            </div>
            <div class="radar-task-mobile-pagination">
              <Button
                :disabled="currentPage <= 1"
                @click="
                  handleTableChange({ current: currentPage - 1, pageSize })
                "
              >
                上一页
              </Button>
              <span>
                {{ currentPage }} /
                {{ Math.max(1, Math.ceil(total / pageSize)) }}
              </span>
              <Button
                :disabled="currentPage >= Math.ceil(total / pageSize)"
                @click="
                  handleTableChange({ current: currentPage + 1, pageSize })
                "
              >
                下一页
              </Button>
            </div>
          </div>
          <Empty v-else description="暂无触达任务" />
        </div>

        <Card v-else class="radar-collection-table-card" title="触达任务列表">
          <Table
            bordered
            :columns="columns"
            :data-source="items"
            :loading="tableLoading"
            :locale="tableLocale"
            :pagination="{
              current: currentPage,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (value: number) => `共 ${value} 条`,
            }"
            :scroll="{ x: 1770 }"
            row-key="taskId"
            size="small"
            table-layout="fixed"
            @change="handleTableChange"
          >
            <template #emptyText>
              <Empty description="暂无触达任务" />
            </template>
          </Table>
          <div v-if="items.length > 0" class="text-text-secondary mt-3 text-sm">
            当前筛选下短信 {{ summary.smsTasks }} 条，电话
            {{ summary.callTasks }} 条，失败 {{ summary.failedTasks }} 条。
          </div>
        </Card>

        <Drawer
          v-model:open="detailDrawerOpen"
          destroy-on-close
          placement="right"
          title="触达任务详情"
          :width="isMobile ? '100%' : 720"
        >
          <Skeleton v-if="detailLoading" active :paragraph="{ rows: 8 }" />
          <template v-else-if="taskDetail">
            <div class="space-y-4">
              <Card :body-style="{ padding: '12px 16px' }">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-base font-semibold">
                      {{ taskDetail.enterpriseName || '-' }}
                    </div>
                    <div class="text-text-secondary mt-1 text-sm">
                      {{ taskDetail.parkName || '-' }}
                      <span class="mx-2">|</span>
                      {{ taskDetail.ownerName || '-' }}
                      <span class="mx-2">|</span>
                      {{ taskDetail.totalScore }} 分
                    </div>
                  </div>
                  <Space wrap>
                    <Tag :color="getPriorityColor(taskDetail.priorityLevel)">
                      {{ taskDetail.priorityLevel || '-' }} 级
                    </Tag>
                    <Tag
                      :color="
                        taskDetail.stage === 'PENDING_CONTACT' ? 'gold' : 'blue'
                      "
                    >
                      {{
                        RADAR_STAGE_LABEL_MAP[taskDetail.stage] ||
                        taskDetail.stage ||
                        '-'
                      }}
                    </Tag>
                  </Space>
                </div>
              </Card>

              <Card title="执行信息">
                <Descriptions :column="isMobile ? 1 : 2" bordered size="small">
                  <Descriptions.Item label="触达类型">
                    {{ mapTaskType(taskDetail.taskType) }}
                  </Descriptions.Item>
                  <Descriptions.Item label="渠道">
                    {{ mapChannel(taskDetail.channel) }}
                  </Descriptions.Item>
                  <Descriptions.Item label="触达号码">
                    {{ taskDetail.phoneNumber || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="模板编码">
                    {{ taskDetail.templateCode || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="操作人">
                    {{ taskDetail.sentByName || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="任务状态">
                    <component
                      :is="
                        renderStatusTag(taskDetail.status, taskStatusMetaMap)
                      "
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="回复状态">
                    <component
                      :is="
                        renderStatusTag(
                          taskDetail.replyStatus,
                          replyStatusMetaMap,
                        )
                      "
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="计划时间">
                    {{ formatTime(taskDetail.scheduledAt) }}
                  </Descriptions.Item>
                  <Descriptions.Item label="发送时间">
                    {{ formatTime(taskDetail.sentAt) }}
                  </Descriptions.Item>
                  <Descriptions.Item label="回复时间">
                    {{ formatTime(taskDetail.replyTime) }}
                  </Descriptions.Item>
                  <Descriptions.Item label="更新时间">
                    {{ formatTime(taskDetail.updateTime) }}
                  </Descriptions.Item>
                  <Descriptions.Item label="执行结果" :span="isMobile ? 1 : 2">
                    {{ renderResult(taskDetail) }}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="线索与企业">
                <Descriptions :column="isMobile ? 1 : 2" bordered size="small">
                  <Descriptions.Item label="线索来源">
                    {{ taskDetail.leadSource || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="联系人">
                    {{ taskDetail.contactName || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="行业">
                    {{ taskDetail.industryName || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="城市">
                    {{ taskDetail.city || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="意向面积">
                    {{
                      taskDetail.intentArea === null ||
                      taskDetail.intentArea === undefined
                        ? '-'
                        : `${formatNumber(taskDetail.intentArea)} ㎡`
                    }}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label="意图 / 匹配 / 可触达"
                    :span="isMobile ? 1 : 2"
                  >
                    {{ taskDetail.intentScore }} / {{ taskDetail.matchScore }} /
                    {{ taskDetail.reachableScore }}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label="统一社会信用代码"
                    :span="isMobile ? 1 : 2"
                  >
                    {{ taskDetail.unifiedSocialCreditCode || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="企业地址" :span="isMobile ? 1 : 2">
                    {{ taskDetail.address || '-' }}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近信号">
                    {{
                      taskDetail.sourceLatest ||
                      taskDetail.latestSignalType ||
                      '-'
                    }}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近信号时间">
                    {{ formatTime(taskDetail.latestSignalTime) }}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <div class="radar-task-detail-actions">
                <Space>
                  <Button @click="detailDrawerOpen = false">关闭</Button>
                  <Button
                    type="primary"
                    @click="goToLeadDetail(taskDetail.leadId)"
                  >
                    查看线索详情
                  </Button>
                </Space>
              </div>
            </div>
          </template>
          <Empty v-else description="未找到触达任务详情" />
        </Drawer>
      </div>
    </Page>
  </div>
</template>

<style scoped>
.radar-task-route,
.radar-collection-page,
:deep(.radar-collection-content) {
  min-height: 100%;
}

.radar-collection-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

.radar-collection-table-card {
  overflow: hidden;
}

.radar-stat-card-grid {
  margin: 0 !important;
}

.radar-stat-card {
  height: 100%;
}

.radar-stat-card :deep(.ant-card-body) {
  padding: 16px 18px;
}

.radar-stat-card :deep(.ant-statistic-title) {
  margin-bottom: 4px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-stat-card :deep(.ant-statistic-content) {
  font-size: 24px;
  line-height: 32px;
  color: var(--ant-color-text);
}

.radar-search-form {
  --radar-filter-height: 32px;
  --radar-filter-width: 180px;

  row-gap: 8px;
  align-items: center;
  width: 100%;
}

.radar-search-form :deep(.ant-form-item) {
  align-items: center;
  margin-bottom: 0;
}

.radar-search-form :deep(.ant-form-item-control-input) {
  min-height: var(--radar-filter-height);
}

.radar-filter-control {
  width: var(--radar-filter-width);
  min-width: var(--radar-filter-width);
  max-width: var(--radar-filter-width);
}

.radar-filter-keyword {
  width: var(--radar-filter-width);
  min-width: var(--radar-filter-width);
  max-width: var(--radar-filter-width);
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-selection-item),
.radar-search-form :deep(.ant-select-selection-placeholder) {
  font-size: 14px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-select-single .ant-select-selection-search-input),
.radar-search-form :deep(.ant-btn) {
  height: var(--radar-filter-height);
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-btn) {
  line-height: calc(var(--radar-filter-height) - 2px);
}

.radar-search-form :deep(.ant-input-affix-wrapper) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding-block: 0;
}

.radar-search-form :deep(.ant-input-affix-wrapper > input.ant-input) {
  height: calc(var(--radar-filter-height) - 2px);
  line-height: calc(var(--radar-filter-height) - 2px);
}

.radar-search-form :deep(.ant-select-single .ant-select-selector) {
  display: flex;
  align-items: center;
}

.radar-search-form :deep(.ant-select-single .ant-select-selection-item),
.radar-search-form :deep(.ant-select-single .ant-select-selection-placeholder) {
  width: 100%;
  line-height: calc(var(--radar-filter-height) - 2px);
}

.radar-search-form
  :deep(.ant-select-single .ant-select-selection-search-input) {
  text-align: left;
}

.radar-search-form :deep(.ant-form-item-label > label) {
  min-height: var(--radar-filter-height);
  font-size: 14px;
  color: var(--ant-color-text);
}

:deep(.ant-table-thead > tr > th) {
  font-size: 14px;
  font-weight: 600;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

:deep(.ant-table-tbody > tr > td) {
  font-size: 14px;
  line-height: 22px;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

.radar-task-mobile-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.radar-task-mobile-stat-card,
.radar-task-mobile-filter,
.radar-task-mobile-card {
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgb(15 23 42 / 6%);
}

.radar-task-mobile-stat-card :deep(.ant-card-body) {
  padding: 10px 4px;
  text-align: center;
}

.radar-task-mobile-stat-card :deep(.ant-statistic-title) {
  margin-bottom: 2px;
  font-size: 11px;
  line-height: 16px;
  color: var(--ant-color-text-secondary);
}

.radar-task-mobile-stat-card :deep(.ant-statistic-content) {
  font-size: 18px;
  line-height: 24px;
  color: var(--ant-color-text);
}

.radar-task-mobile {
  padding-bottom: calc(var(--app-safe-area-bottom) + 16px);
}

.radar-task-mobile-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.radar-task-mobile-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 64px;
  gap: 8px;
  align-items: center;
}

.radar-task-mobile-panel {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--ant-color-border-secondary);
}

.radar-task-mobile-grid,
.radar-task-mobile-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.radar-task-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-task-mobile-card {
  padding: 13px;
}

.radar-task-mobile-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.radar-task-mobile-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 22px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.radar-task-mobile-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.radar-task-mobile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.radar-task-mobile-info {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-task-mobile-card p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
}

.radar-task-mobile-card-actions,
.radar-task-mobile-pagination {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.radar-task-mobile-pagination {
  font-size: 13px;
  color: var(--ant-color-text-secondary);
}

@media (max-width: 767px) {
  :deep(.ant-page) {
    overflow-y: auto;
  }

  .radar-task-detail-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .radar-task-detail-actions :deep(.ant-space),
  .radar-task-detail-actions :deep(.ant-space-item),
  .radar-task-detail-actions :deep(.ant-btn) {
    display: block;
    width: 100%;
  }
}

@media (min-width: 768px) {
  .radar-task-detail-actions {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
