<script lang="ts" setup>
import type {
  RadarLeadDetail,
  RadarLeadNavigationItem,
  RadarOutreachTaskItem,
} from '#/api/investment';

import { computed, h, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
} from 'ant-design-vue';

import { getRadarLeadDetail } from '#/api/investment';

import { RADAR_STAGE_LABEL_MAP } from './data';

defineOptions({ name: 'InvestmentRadarDetail' });

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const loadError = ref('');
const detail = ref<null | RadarLeadDetail>(null);

const leadId = computed(() => Number(route.params.id));

const channelLabelMap: Record<string, string> = {
  CALL: '电话',
  EMAIL: '邮件',
  SMS: '短信',
  VISIT: '拜访',
  WECHAT: '微信',
};

const taskStatusMetaMap: Record<string, { color: string; label: string }> = {
  ERROR: { color: 'red', label: '执行异常' },
  FAILED: { color: 'red', label: '发送失败' },
  PENDING: { color: 'blue', label: '待执行' },
  REPLIED: { color: 'cyan', label: '已回复' },
  RUNNING: { color: 'processing', label: '执行中' },
  SENT: { color: 'green', label: '已发送' },
  SUCCESS: { color: 'green', label: '执行成功' },
};

const replyStatusMetaMap: Record<string, { color: string; label: string }> = {
  NEGATIVE: { color: 'red', label: '负向反馈' },
  NO_REPLY: { color: 'default', label: '未回复' },
  POSITIVE: { color: 'green', label: '正向反馈' },
  REPLIED: { color: 'cyan', label: '已回复' },
};

const taskTypeLabelMap: Record<string, string> = {
  FOLLOW_UP: '跟进',
  OUTREACH: '外呼触达',
  VISIT: '预约拜访',
};

const summary = computed(() => ({
  intentScore: detail.value?.intentScore ?? 0,
  matchScore: detail.value?.matchScore ?? 0,
  reachableScore: detail.value?.reachableScore ?? 0,
  totalScore: detail.value?.totalScore ?? 0,
}));

const outreachColumns = [
  {
    customRender: ({ text }: { text?: string }) => mapTaskType(text),
    dataIndex: 'taskType',
    key: 'taskType',
    title: '触达类型',
    width: 110,
  },
  {
    customRender: ({ text }: { text?: string }) => mapChannel(text),
    dataIndex: 'channel',
    key: 'channel',
    title: '渠道',
    width: 90,
  },
  {
    customRender: ({ record }: { record: RadarOutreachTaskItem }) =>
      renderStatusGroup(record),
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 170,
  },
  {
    customRender: ({ text }: { text?: string }) => text || '-',
    dataIndex: 'phoneNumber',
    key: 'phoneNumber',
    title: '触达号码',
    width: 140,
  },
  {
    customRender: ({ text }: { text?: string }) => text || '-',
    dataIndex: 'templateCode',
    key: 'templateCode',
    title: '模板编码',
    width: 140,
  },
  {
    customRender: ({ text }: { text?: string }) => formatTime(text),
    dataIndex: 'sentAt',
    key: 'sentAt',
    title: '发送时间',
    width: 170,
  },
  {
    customRender: ({ text }: { text?: string }) => formatTime(text),
    dataIndex: 'replyTime',
    key: 'replyTime',
    title: '回复时间',
    width: 170,
  },
  {
    customRender: ({ text }: { text?: string }) => text || '-',
    dataIndex: 'sentByName',
    key: 'sentByName',
    title: '操作人',
    width: 120,
  },
  {
    customRender: ({ record }: { record: RadarOutreachTaskItem }) =>
      renderResult(record),
    dataIndex: 'resultMessage',
    key: 'resultMessage',
    minWidth: 280,
    title: '执行结果',
  },
];

function formatTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function formatNumber(value?: null | number) {
  if (value === null || value === undefined) {
    return '-';
  }
  return Number(value).toLocaleString('zh-CN');
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

function renderPriority(priorityLevel?: null | string) {
  if (!priorityLevel) {
    return { color: 'default', text: '-' };
  }
  let color = 'blue';
  if (priorityLevel === 'A') {
    color = 'red';
  } else if (priorityLevel === 'B') {
    color = 'orange';
  }
  return { color, text: `${priorityLevel} 级` };
}

function renderTaskStatus(status?: string) {
  if (!status) {
    return '-';
  }
  const meta = taskStatusMetaMap[status] || {
    color: 'default',
    label: status,
  };
  return h(Tag, { color: meta.color }, () => meta.label);
}

function renderReplyStatus(replyStatus?: null | string) {
  if (!replyStatus) {
    return null;
  }
  const meta = replyStatusMetaMap[replyStatus] || {
    color: 'default',
    label: replyStatus,
  };
  return h(Tag, { color: meta.color }, () => meta.label);
}

function renderStatusGroup(record: RadarOutreachTaskItem) {
  return h(Space, { size: 4, wrap: true }, () =>
    [
      renderTaskStatus(record.status),
      renderReplyStatus(record.replyStatus),
    ].filter(Boolean),
  );
}

function renderResult(record: RadarOutreachTaskItem) {
  const parts = [
    record.resultCode ? `结果码：${record.resultCode}` : '',
    record.resultMessage || '',
    record.replyContent ? `回复：${record.replyContent}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : '-';
}

function formatCollectTaskStatus(status?: null | string) {
  if (!status) {
    return '-';
  }
  return taskStatusMetaMap[status]?.label || status;
}

function getNavigationText(item?: null | RadarLeadNavigationItem) {
  if (!item) {
    return '';
  }
  const stageText = RADAR_STAGE_LABEL_MAP[item.stage] || item.stage || '-';
  return `${item.enterpriseName} · ${stageText} · ${item.totalScore}分`;
}

async function loadDetail() {
  if (!Number.isFinite(leadId.value) || leadId.value <= 0) {
    loadError.value = '线索编号无效。';
    loading.value = false;
    return;
  }

  loading.value = true;
  loadError.value = '';

  try {
    detail.value = await getRadarLeadDetail(leadId.value);
  } catch (error) {
    console.error('加载雷达线索详情失败:', error);
    detail.value = null;
    loadError.value = '线索详情加载失败，请检查详情接口是否可用。';
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push('/investment/radar');
}

function navigateLead(targetId?: null | number) {
  if (!targetId || targetId === leadId.value) {
    return;
  }
  router.push(`/investment/radar/${targetId}`);
}

watch(
  () => route.params.id,
  () => {
    void loadDetail();
  },
);

onMounted(() => {
  void loadDetail();
});
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">雷达线索详情</div>
          <div class="text-text-secondary text-sm">
            查看单条线索、企业信息、采集情况与触达记录。
          </div>
        </div>
        <Space wrap>
          <Button @click="goBack">返回雷达主列表</Button>
          <Button type="primary" @click="loadDetail">刷新数据</Button>
        </Space>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <Card
        v-if="detail && !loading"
        :body-style="{ paddingBottom: '12px', paddingTop: '12px' }"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate text-base font-semibold">
              {{ detail.enterpriseName || `线索 #${detail.leadId}` }}
            </div>
            <div class="text-text-secondary mt-1 text-sm">
              当前阶段：{{
                RADAR_STAGE_LABEL_MAP[detail.stage] || detail.stage || '-'
              }}
              <span class="mx-2">|</span>
              园区：{{ detail.parkName || '-' }}
              <span class="mx-2">|</span>
              负责人：{{ detail.ownerName || '-' }}
            </div>
          </div>
          <Space wrap>
            <Button
              :disabled="!detail.navigation?.previousLead"
              @click="navigateLead(detail.navigation?.previousLead?.leadId)"
            >
              上一条
            </Button>
            <Button
              :disabled="!detail.navigation?.nextLead"
              @click="navigateLead(detail.navigation?.nextLead?.leadId)"
            >
              下一条
            </Button>
          </Space>
        </div>
        <div
          class="text-text-secondary mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm"
        >
          <span>
            上一条：{{
              getNavigationText(detail.navigation?.previousLead) || '已是第一条'
            }}
          </span>
          <span>
            下一条：{{
              getNavigationText(detail.navigation?.nextLead) || '已是最后一条'
            }}
          </span>
        </div>
      </Card>

      <template v-if="loading">
        <Row :gutter="[16, 16]">
          <Col v-for="item in 4" :key="item" :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Skeleton active :paragraph="{ rows: 1 }" />
            </Card>
          </Col>
        </Row>
      </template>

      <template v-else-if="detail">
        <Row :gutter="[16, 16]">
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Statistic title="意图分" :value="summary.intentScore" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Statistic title="匹配分" :value="summary.matchScore" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Statistic title="可触达分" :value="summary.reachableScore" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Statistic title="总分" :value="summary.totalScore" />
            </Card>
          </Col>
        </Row>

        <Row :gutter="[16, 16]">
          <Col :lg="14" :md="24" :sm="24" :xs="24">
            <Card title="线索信息">
              <Descriptions :column="2" bordered size="small">
                <Descriptions.Item label="企业名称" :span="2">
                  {{ detail.enterpriseName || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="当前阶段">
                  {{
                    RADAR_STAGE_LABEL_MAP[detail.stage] || detail.stage || '-'
                  }}
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  <Tag :color="renderPriority(detail.priorityLevel).color">
                    {{ renderPriority(detail.priorityLevel).text }}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="线索来源">
                  {{ detail.leadSource || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="园区">
                  {{ detail.parkName || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="联系电话">
                  {{ detail.phoneNumber || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="联系人">
                  {{ detail.contactName || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="负责人">
                  {{ detail.ownerName || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="意向面积">
                  {{
                    detail.intentArea === null ||
                    detail.intentArea === undefined
                      ? '-'
                      : `${formatNumber(detail.intentArea)} ㎡`
                  }}
                </Descriptions.Item>
                <Descriptions.Item label="最近信号">
                  {{ detail.latestSignalType || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="最近信号时间">
                  {{ formatTime(detail.latestSignalTime) }}
                </Descriptions.Item>
                <Descriptions.Item label="最近联系时间">
                  {{ formatTime(detail.latestContactTime) }}
                </Descriptions.Item>
                <Descriptions.Item label="失效原因" :span="2">
                  {{ detail.invalidReason || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {{ formatTime(detail.createTime) }}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {{ formatTime(detail.updateTime) }}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col :lg="10" :md="24" :sm="24" :xs="24">
            <Card title="企业信息">
              <Descriptions :column="1" bordered size="small">
                <Descriptions.Item label="统一社会信用代码">
                  {{ detail.unifiedSocialCreditCode || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="行业">
                  {{ detail.industryName || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="城市">
                  {{ detail.city || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="地址">
                  {{ detail.address || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="首次来源">
                  {{ detail.sourceFirst || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="最近来源">
                  {{ detail.sourceLatest || '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="注册资本">
                  {{ formatNumber(detail.registerCapital) }}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card class="mt-4" title="最近采集任务">
              <Descriptions :column="1" bordered size="small">
                <Descriptions.Item label="任务状态">
                  {{ formatCollectTaskStatus(detail.collectTask?.status) }}
                </Descriptions.Item>
                <Descriptions.Item label="新增 / 更新 / 跳过">
                  {{
                    detail.collectTask
                      ? `${detail.collectTask.created} / ${detail.collectTask.updated} / ${detail.collectTask.skipped}`
                      : '-'
                  }}
                </Descriptions.Item>
                <Descriptions.Item label="任务总量">
                  {{ detail.collectTask?.total ?? '-' }}
                </Descriptions.Item>
                <Descriptions.Item label="开始时间">
                  {{ formatTime(detail.collectTask?.startedAt) }}
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {{ formatTime(detail.collectTask?.completedAt) }}
                </Descriptions.Item>
                <Descriptions.Item label="错误原因">
                  {{ detail.collectTask?.errorReason || '-' }}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Card title="触达记录">
          <Table
            :columns="outreachColumns"
            :data-source="detail.outreachTasks"
            :pagination="false"
            :scroll="{ x: 1380 }"
            row-key="taskId"
            size="small"
          />
          <div
            v-if="detail.outreachTasks.length > 0"
            class="text-text-secondary mt-3 text-sm"
          >
            已记录
            {{ detail.outreachSummary?.count || 0 }} 条触达任务，最近发送时间：
            {{ formatTime(detail.outreachSummary?.latestSentAt) }}
          </div>
          <Empty v-else class="py-6" description="当前线索暂无触达记录" />
        </Card>
      </template>

      <Empty v-else description="未找到对应线索" />
    </div>
  </Page>
</template>
