<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  RadarOutreachTaskDetail,
  RadarOutreachTaskListItem,
  RadarOutreachTaskListParams,
  RadarOutreachTaskSummary,
} from '#/api/investment';

import { h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

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
const loadError = ref('');
const tableLoading = ref(false);
const detailDrawerOpen = ref(false);
const detailLoading = ref(false);
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
  handleSearch();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  currentPage.value = page.current || 1;
  pageSize.value = page.pageSize || 20;
  void loadTasks();
}

function goToLeadDetail(leadId: number) {
  router.push(`/investment/radar/${leadId}`);
}

function goToRadarList() {
  router.push('/investment/radar');
}

onMounted(() => {
  void loadTasks();
});
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-4">
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

      <Row :gutter="[16, 16]">
        <Col :lg="6" :md="12" :sm="12" :xs="24">
          <Card>
            <Statistic title="触达任务总数" :value="summary.totalTasks" />
          </Card>
        </Col>
        <Col :lg="6" :md="12" :sm="12" :xs="24">
          <Card>
            <Statistic title="待执行 / 执行中" :value="summary.pendingTasks" />
          </Card>
        </Col>
        <Col :lg="6" :md="12" :sm="12" :xs="24">
          <Card>
            <Statistic title="已回复" :value="summary.repliedTasks" />
          </Card>
        </Col>
        <Col :lg="6" :md="12" :sm="12" :xs="24">
          <Card>
            <Statistic title="正向反馈" :value="summary.positiveReplies" />
          </Card>
        </Col>
      </Row>

      <Card title="查询条件">
        <Form class="radar-task-filter" layout="inline">
          <Form.Item label="关键字">
            <Input
              v-model:value="searchForm.keyword"
              allow-clear
              class="w-60"
              placeholder="企业 / 电话 / 园区 / 模板"
              @press-enter="handleSearch"
            />
          </Form.Item>
          <Form.Item label="任务状态">
            <Select
              v-model:value="searchForm.status"
              allow-clear
              class="w-36"
              :options="statusOptions"
            />
          </Form.Item>
          <Form.Item label="回复状态">
            <Select
              v-model:value="searchForm.replyStatus"
              allow-clear
              class="w-36"
              :options="replyStatusOptions"
            />
          </Form.Item>
          <Form.Item label="渠道">
            <Select
              v-model:value="searchForm.channel"
              allow-clear
              class="w-32"
              :options="channelOptions"
            />
          </Form.Item>
          <Form.Item label="触达类型">
            <Select
              v-model:value="searchForm.taskType"
              allow-clear
              class="w-36"
              :options="taskTypeOptions"
            />
          </Form.Item>
          <Form.Item label="线索阶段">
            <Select
              v-model:value="searchForm.stage"
              allow-clear
              class="w-36"
              :options="RADAR_STAGE_OPTIONS"
            />
          </Form.Item>
          <Form.Item label="优先级">
            <Select
              v-model:value="searchForm.priorityLevel"
              allow-clear
              class="w-28"
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

      <Card title="触达任务列表">
        <Table
          :columns="columns"
          :data-source="items"
          :loading="tableLoading"
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
        width="720"
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
              <Descriptions :column="2" bordered size="small">
                <Descriptions.Item label="任务编号">
                  {{ taskDetail.taskId }}
                </Descriptions.Item>
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
                    :is="renderStatusTag(taskDetail.status, taskStatusMetaMap)"
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
                <Descriptions.Item label="执行结果" :span="2">
                  {{ renderResult(taskDetail) }}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="线索与企业">
              <Descriptions :column="2" bordered size="small">
                <Descriptions.Item label="线索编号">
                  {{ taskDetail.leadId }}
                </Descriptions.Item>
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
                <Descriptions.Item label="意图 / 匹配 / 可触达" :span="2">
                  {{ taskDetail.intentScore }} / {{ taskDetail.matchScore }} /
                  {{ taskDetail.reachableScore }}
                </Descriptions.Item>
                <Descriptions.Item label="统一社会信用代码" :span="2">
                  {{ taskDetail.unifiedSocialCreditCode || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="企业地址" :span="2">
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

            <div class="flex justify-end">
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
</template>

<style scoped>
.radar-task-filter {
  row-gap: 12px;
}
</style>
