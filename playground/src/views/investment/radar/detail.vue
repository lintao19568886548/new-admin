<script lang="ts" setup>
import type {
  LeadScoreBreakdown,
  RadarLeadDetail,
  RadarLeadNavigationItem,
  RadarOutreachTaskItem,
  RadarSalesUser,
} from '#/api/investment';

import { computed, h, onMounted, ref, watch } from 'vue';
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
  Empty,
  Input,
  message,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  assignRadarLeadOwner,
  closeRadarLead,
  getRadarLeadDetail,
  getRadarLeadScoreBreakdown,
  getRadarSalesUserList,
  recalculateRadarLeadScore,
} from '#/api/investment';

import OutreachSuggestionPanel from './components/OutreachSuggestionPanel.vue';
import PropertyMatchPanel from './components/PropertyMatchPanel.vue';
import SopVisitPanel from './components/SopVisitPanel.vue';
import { RADAR_STAGE_LABEL_MAP } from './data';

defineOptions({ name: 'InvestmentRadarDetail' });

const route = useRoute();
const router = useRouter();
const isMobile = useMediaQuery('(max-width: 767px)');
const loading = ref(true);
const loadError = ref('');
const detail = ref<null | RadarLeadDetail>(null);
const scoreBreakdownLoading = ref(false);
const scoreRecalculating = ref(false);
const scoreBreakdownItems = ref<LeadScoreBreakdown[]>([]);
const ownerAssigning = ref(false);
const leadClosing = ref(false);
const salesUsers = ref<RadarSalesUser[]>([]);
const selectedOwnerUserId = ref<number | undefined>();

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
  BLACKLIST: { color: 'black', label: '黑名单' },
  NEGATIVE: { color: 'red', label: '负向反馈' },
  NO_REPLY: { color: 'default', label: '未回复' },
  POSITIVE: { color: 'green', label: '正向反馈' },
  REPLIED: { color: 'cyan', label: '已回复' },
  UNSUBSCRIBED: { color: 'orange', label: '退订/拒触' },
};

const taskTypeLabelMap: Record<string, string> = {
  FOLLOW_UP: '跟进',
  OUTREACH: '外呼触达',
  VISIT: '预约拜访',
};

const eventTypeLabelMap: Record<string, string> = {
  EVENT_EA_EXPAND: '环评扩产信号',
  FACTORY_RENT_DEMAND: '租厂需求信号',
  KEYWORD_EXPAND: '关键词：扩建',
  KEYWORD_NEW_LINE: '关键词：新增产线',
  KEYWORD_RECRUITMENT: '关键词：招聘',
  KEYWORD_RELOCATION: '关键词：搬迁',
  KEYWORD_WAREHOUSE: '关键词：仓储',
  NEWS_EXPAND: '新闻扩产信号',
  PUBLIC_FACTORY_DEMAND: '公开厂房需求信号',
  RECRUITMENT_EXPAND: '招聘扩产信号',
  RELOCATION: '搬迁信号',
  UNKNOWN: '未知信号',
};

const summary = computed(() => ({
  intentScore: detail.value?.intentScore ?? 0,
  matchScore: detail.value?.matchScore ?? 0,
  reachableScore: detail.value?.reachableScore ?? 0,
  totalScore: detail.value?.totalScore ?? 0,
}));

const salesUserOptions = computed(() =>
  salesUsers.value.map((item) => ({
    label: `${item.userName}${item.parkName ? ` · ${item.parkName}` : ''}`,
    value: item.userId,
  })),
);

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

const scoreBreakdownColumns = [
  {
    customRender: ({ record }: { record: LeadScoreBreakdown }) =>
      h('div', { class: 'font-medium' }, record.ruleName),
    dataIndex: 'ruleName',
    key: 'ruleName',
    title: '规则',
    width: 220,
  },
  {
    customRender: ({ record }: { record: LeadScoreBreakdown }) =>
      record.eventTitle || '-',
    dataIndex: 'eventTitle',
    key: 'eventTitle',
    title: '命中信号',
    width: 260,
  },
  {
    customRender: ({ record }: { record: LeadScoreBreakdown }) =>
      formatEventType(record.eventType),
    dataIndex: 'eventType',
    key: 'eventType',
    title: '事件类型',
    width: 140,
  },
  {
    dataIndex: 'scoreDelta',
    key: 'scoreDelta',
    title: '加分',
    width: 90,
  },
  {
    dataIndex: 'reason',
    key: 'reason',
    title: '原因',
    width: 360,
  },
  {
    customRender: ({ text }: { text?: null | string }) => formatTime(text),
    dataIndex: 'createTime',
    key: 'createTime',
    title: '生成时间',
    width: 170,
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

function formatEventType(eventType?: null | string) {
  if (!eventType) {
    return '-';
  }
  return eventTypeLabelMap[eventType] || '其他信号';
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

function getTaskStatusMeta(status?: null | string) {
  if (!status) {
    return { color: 'default', label: '-' };
  }
  return taskStatusMetaMap[status] || { color: 'default', label: status };
}

function getReplyStatusMeta(status?: null | string) {
  if (!status) {
    return { color: 'default', label: '-' };
  }
  return replyStatusMetaMap[status] || { color: 'default', label: status };
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
    loadError.value = '线索信息无效。';
    loading.value = false;
    return;
  }

  loading.value = true;
  loadError.value = '';

  try {
    detail.value = await getRadarLeadDetail(leadId.value);
    selectedOwnerUserId.value = detail.value.ownerUserId || undefined;
    await loadSalesUsers();
    await loadScoreBreakdown();
  } catch (error) {
    console.error('加载雷达线索详情失败:', error);
    detail.value = null;
    loadError.value = '线索详情加载失败，请检查详情接口是否可用。';
  } finally {
    loading.value = false;
  }
}

async function loadSalesUsers() {
  try {
    const result = await getRadarSalesUserList({
      parkId: detail.value?.parkId || undefined,
    });
    salesUsers.value = Array.isArray(result.items) ? result.items : [];
  } catch (error) {
    console.error('加载销售负责人失败:', error);
    salesUsers.value = [];
  }
}

async function loadScoreBreakdown() {
  if (!Number.isFinite(leadId.value) || leadId.value <= 0) {
    return;
  }
  scoreBreakdownLoading.value = true;
  try {
    const result = await getRadarLeadScoreBreakdown(leadId.value);
    scoreBreakdownItems.value = result.items;
  } catch (error) {
    console.error('鍔犺浇璇勫垎鎷嗚В澶辫触:', error);
    scoreBreakdownItems.value = [];
  } finally {
    scoreBreakdownLoading.value = false;
  }
}

async function assignOwner() {
  if (!detail.value || !selectedOwnerUserId.value || ownerAssigning.value) {
    return;
  }
  ownerAssigning.value = true;
  try {
    const result = await assignRadarLeadOwner(leadId.value, {
      assignReason: '线索详情人工调整负责人',
      ownerUserId: selectedOwnerUserId.value,
    });
    detail.value = {
      ...detail.value,
      ownerName: result.ownerName,
      ownerUserId: result.ownerUserId,
      stage: result.stage,
    };
    message.success('负责人已更新');
  } catch (error) {
    console.error('分配负责人失败:', error);
    message.error('分配负责人失败');
  } finally {
    ownerAssigning.value = false;
  }
}

function updateDetailAfterClose(result: {
  invalidReason?: null | string;
  stage: string;
  updateTime?: string;
}) {
  if (!detail.value) {
    return;
  }
  detail.value = {
    ...detail.value,
    invalidReason: result.invalidReason || null,
    stage: result.stage,
    updateTime: result.updateTime || detail.value.updateTime,
  };
}

async function closeLead(stage: 'DEAL' | 'INVALID', reason = '') {
  if (!detail.value || leadClosing.value) {
    return;
  }
  leadClosing.value = true;
  try {
    const result = await closeRadarLead(leadId.value, {
      reason,
      stage,
    });
    updateDetailAfterClose(result);
    message.success(stage === 'DEAL' ? '已标记成交' : '已标记失效');
  } catch (error) {
    console.error('更新线索转化结果失败:', error);
    message.error('更新线索转化结果失败');
  } finally {
    leadClosing.value = false;
  }
}

function markDeal() {
  Modal.confirm({
    content: '确认后将关闭该线索的待处理提醒，并取消未执行触达任务。',
    okText: '确认成交',
    onOk: () => closeLead('DEAL'),
    title: '标记为成交',
  });
}

function markInvalid() {
  const reason = ref('');
  Modal.confirm({
    content: () =>
      h(Input.TextArea, {
        autoSize: { maxRows: 6, minRows: 3 },
        onChange: (event: Event) => {
          reason.value = (event.target as HTMLTextAreaElement).value;
        },
        placeholder: '请填写失效原因',
      }),
    okText: '确认失效',
    onOk: () => {
      if (!reason.value.trim()) {
        message.warning('请填写失效原因');
        return Promise.reject(new Error('INVALID_REASON_REQUIRED'));
      }
      return closeLead('INVALID', reason.value.trim());
    },
    title: '标记为失效',
  });
}

async function recalculateScore() {
  if (scoreRecalculating.value) {
    return;
  }
  scoreRecalculating.value = true;
  try {
    const result = await recalculateRadarLeadScore(leadId.value);
    detail.value = detail.value
      ? {
          ...detail.value,
          intentScore: result.intentScore,
          priorityLevel: result.priorityLevel,
          totalScore: result.totalScore,
        }
      : detail.value;
    await loadScoreBreakdown();
  } catch (error) {
    console.error('閲嶇畻闆疯揪绾跨储璇勫垎澶辫触:', error);
  } finally {
    scoreRecalculating.value = false;
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
    <div v-if="isMobile" class="radar-detail-mobile">
      <div class="radar-mobile-topbar">
        <Button size="small" @click="goBack">返回</Button>
        <Button
          size="small"
          type="primary"
          :loading="loading"
          @click="loadDetail"
        >
          刷新
        </Button>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <template v-if="loading">
        <Card>
          <Skeleton active :paragraph="{ rows: 6 }" />
        </Card>
      </template>

      <template v-else-if="detail">
        <section class="radar-mobile-hero">
          <div class="radar-mobile-hero-head">
            <div>
              <div class="radar-mobile-hero-title">
                {{ detail.enterpriseName || '雷达线索' }}
              </div>
              <div class="radar-mobile-hero-subtitle">
                {{ detail.parkName || '未分配园区' }} ·
                {{ detail.ownerName || '未分配负责人' }}
              </div>
            </div>
            <Tag :color="renderPriority(detail.priorityLevel).color">
              {{ renderPriority(detail.priorityLevel).text }}
            </Tag>
          </div>
          <div class="radar-mobile-tag-row">
            <Tag color="blue">
              {{ RADAR_STAGE_LABEL_MAP[detail.stage] || detail.stage || '-' }}
            </Tag>
            <span>{{ detail.leadSource || '-' }}</span>
            <span>{{ detail.phoneNumber || '暂无电话' }}</span>
          </div>
          <div
            v-if="!['DEAL', 'INVALID'].includes(detail.stage)"
            class="radar-mobile-close-actions"
          >
            <Button block :loading="leadClosing" @click="markInvalid">
              标记失效
            </Button>
            <Button
              block
              type="primary"
              :loading="leadClosing"
              @click="markDeal"
            >
              标记成交
            </Button>
          </div>
        </section>

        <div class="radar-mobile-score-grid">
          <Card class="radar-mobile-score-card">
            <Statistic title="总分" :value="summary.totalScore" />
          </Card>
          <Card class="radar-mobile-score-card">
            <Statistic title="意图" :value="summary.intentScore" />
          </Card>
          <Card class="radar-mobile-score-card">
            <Statistic title="匹配" :value="summary.matchScore" />
          </Card>
          <Card class="radar-mobile-score-card">
            <Statistic title="触达" :value="summary.reachableScore" />
          </Card>
        </div>

        <section class="radar-mobile-section">
          <div class="radar-mobile-section-head">
            <h3>线索信息</h3>
          </div>
          <div class="radar-mobile-info-list">
            <div>
              <span>联系人</span>
              <strong>{{ detail.contactName || '-' }}</strong>
            </div>
            <div>
              <span>意向面积</span>
              <strong>
                {{
                  detail.intentArea === null || detail.intentArea === undefined
                    ? '-'
                    : `${formatNumber(detail.intentArea)}㎡`
                }}
              </strong>
            </div>
            <div>
              <span>负责人</span>
              <div class="radar-owner-select-wrap">
                <Select
                  v-model:value="selectedOwnerUserId"
                  class="radar-owner-select"
                  placeholder="选择负责人"
                  :options="salesUserOptions"
                />
                <Button
                  :disabled="
                    !selectedOwnerUserId ||
                    selectedOwnerUserId === detail.ownerUserId
                  "
                  :loading="ownerAssigning"
                  size="small"
                  type="primary"
                  @click="assignOwner"
                >
                  保存
                </Button>
              </div>
            </div>
            <div>
              <span>最近信号</span>
              <strong>{{ detail.latestSignalType || '-' }}</strong>
            </div>
            <div>
              <span>信号时间</span>
              <strong>{{ formatTime(detail.latestSignalTime) }}</strong>
            </div>
            <div>
              <span>最近联系</span>
              <strong>{{ formatTime(detail.latestContactTime) }}</strong>
            </div>
            <div>
              <span>失效原因</span>
              <strong>{{ detail.invalidReason || '-' }}</strong>
            </div>
          </div>
        </section>

        <section class="radar-mobile-section">
          <div class="radar-mobile-section-head">
            <h3>企业信息</h3>
          </div>
          <div class="radar-mobile-info-list">
            <div>
              <span>行业</span>
              <strong>{{ detail.industryName || '-' }}</strong>
            </div>
            <div>
              <span>城市</span>
              <strong>{{ detail.city || '-' }}</strong>
            </div>
            <div>
              <span>注册资本</span>
              <strong>{{ formatNumber(detail.registerCapital) }}</strong>
            </div>
            <div>
              <span>信用代码</span>
              <strong>{{ detail.unifiedSocialCreditCode || '-' }}</strong>
            </div>
            <div class="radar-mobile-info-wide">
              <span>地址</span>
              <strong>{{ detail.address || '-' }}</strong>
            </div>
            <div class="radar-mobile-info-wide">
              <span>来源</span>
              <strong>
                {{ detail.sourceFirst || '-' }} /
                {{ detail.sourceLatest || '-' }}
              </strong>
            </div>
          </div>
        </section>

        <section class="radar-mobile-section">
          <div class="radar-mobile-section-head">
            <h3>评分拆解</h3>
            <Button
              size="small"
              type="primary"
              :loading="scoreRecalculating"
              @click="recalculateScore"
            >
              重算
            </Button>
          </div>
          <Spin :spinning="scoreBreakdownLoading">
            <div
              v-if="scoreBreakdownItems.length > 0"
              class="radar-mobile-list"
            >
              <div
                v-for="item in scoreBreakdownItems"
                :key="item.breakdownId"
                class="radar-mobile-mini-card"
              >
                <div class="radar-mobile-mini-head">
                  <strong>{{ item.ruleName }}</strong>
                  <Tag color="green">+{{ item.scoreDelta }}</Tag>
                </div>
                <div class="radar-mobile-mini-meta">
                  {{ formatEventType(item.eventType) }}
                </div>
                <p>{{ item.reason || '-' }}</p>
              </div>
            </div>
            <Empty v-else description="暂无评分拆解" />
          </Spin>
        </section>

        <section class="radar-mobile-section">
          <div class="radar-mobile-section-head">
            <h3>触达记录</h3>
            <span>{{ detail.outreachSummary?.count || 0 }} 条</span>
          </div>
          <div v-if="detail.outreachTasks.length > 0" class="radar-mobile-list">
            <div
              v-for="task in detail.outreachTasks"
              :key="task.taskId"
              class="radar-mobile-mini-card"
            >
              <div class="radar-mobile-mini-head">
                <strong>{{ mapTaskType(task.taskType) }}</strong>
                <Tag :color="getTaskStatusMeta(task.status).color">
                  {{ getTaskStatusMeta(task.status).label }}
                </Tag>
              </div>
              <div class="radar-mobile-tag-row">
                <Tag color="blue">{{ mapChannel(task.channel) }}</Tag>
                <Tag :color="getReplyStatusMeta(task.replyStatus).color">
                  {{ getReplyStatusMeta(task.replyStatus).label }}
                </Tag>
              </div>
              <div class="radar-mobile-card-meta">
                <span>号码：{{ task.phoneNumber || '-' }}</span>
                <span>发送：{{ formatTime(task.sentAt) }}</span>
                <span>回复：{{ formatTime(task.replyTime) }}</span>
                <span>操作人：{{ task.sentByName || '-' }}</span>
              </div>
              <p v-if="renderResult(task) !== '-'">{{ renderResult(task) }}</p>
            </div>
          </div>
          <Empty v-else description="暂无触达记录" />
        </section>

        <div class="radar-mobile-bottom-actions">
          <Button
            block
            :disabled="!detail.navigation?.previousLead"
            @click="navigateLead(detail.navigation?.previousLead?.leadId)"
          >
            上一条
          </Button>
          <Button
            block
            type="primary"
            :disabled="!detail.navigation?.nextLead"
            @click="navigateLead(detail.navigation?.nextLead?.leadId)"
          >
            下一条
          </Button>
        </div>
      </template>

      <Empty v-else description="未找到对应线索" />
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">雷达线索详情</div>
          <div class="text-text-secondary text-sm">
            查看单条线索、企业信息、采集情况与触达记录。
          </div>
        </div>
        <Space wrap>
          <Button @click="goBack">返回雷达主列表</Button>
          <Button
            v-if="detail && !['DEAL', 'INVALID'].includes(detail.stage)"
            :loading="leadClosing"
            @click="markInvalid"
          >
            标记失效
          </Button>
          <Button
            v-if="detail && !['DEAL', 'INVALID'].includes(detail.stage)"
            type="primary"
            :loading="leadClosing"
            @click="markDeal"
          >
            标记成交
          </Button>
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
              {{ detail.enterpriseName || '雷达线索' }}
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

        <Card class="radar-detail-list-card" title="评分拆解">
          <template #extra>
            <Space>
              <Button
                :loading="scoreBreakdownLoading"
                @click="loadScoreBreakdown"
              >
                刷新拆解
              </Button>
              <Button
                type="primary"
                :loading="scoreRecalculating"
                @click="recalculateScore"
              >
                重算当前评分
              </Button>
            </Space>
          </template>
          <div v-if="scoreBreakdownLoading" class="radar-detail-loading">
            <Skeleton active :paragraph="{ rows: 3 }" />
          </div>
          <Table
            v-else-if="scoreBreakdownItems.length > 0"
            bordered
            class="radar-detail-table"
            :columns="scoreBreakdownColumns"
            :data-source="scoreBreakdownItems"
            :pagination="false"
            row-key="breakdownId"
            :scroll="{ x: 1180 }"
            size="small"
          />
          <Empty
            v-else
            class="radar-detail-empty"
            description="暂无评分拆解，请先重算当前评分"
          />
        </Card>

        <div class="radar-detail-desktop-grid">
          <div class="radar-detail-main-column">
            <Card class="radar-detail-info-card" title="线索信息">
              <Descriptions
                class="radar-detail-descriptions"
                :column="2"
                bordered
                size="small"
              >
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
                  <Space>
                    <Select
                      v-model:value="selectedOwnerUserId"
                      class="radar-owner-select"
                      placeholder="选择负责人"
                      :options="salesUserOptions"
                    />
                    <Button
                      :disabled="
                        !selectedOwnerUserId ||
                        selectedOwnerUserId === detail.ownerUserId
                      "
                      :loading="ownerAssigning"
                      size="small"
                      type="primary"
                      @click="assignOwner"
                    >
                      保存
                    </Button>
                  </Space>
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
                <Descriptions.Item label="最近联系时间" :span="2">
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

            <PropertyMatchPanel :lead-id="leadId" />

            <SopVisitPanel :lead-id="leadId" />

            <Card class="radar-detail-list-card" title="触达记录">
              <Table
                v-if="detail.outreachTasks.length > 0"
                bordered
                class="radar-detail-table"
                :columns="outreachColumns"
                :data-source="detail.outreachTasks"
                :pagination="false"
                :scroll="{ x: 1140 }"
                row-key="taskId"
                size="small"
              />
              <div
                v-if="detail.outreachTasks.length > 0"
                class="text-text-secondary mt-3 text-sm"
              >
                已记录
                {{ detail.outreachSummary?.count || 0 }}
                条触达任务，最近发送时间：
                {{ formatTime(detail.outreachSummary?.latestSentAt) }}
              </div>
              <Empty
                v-else
                class="radar-detail-empty"
                description="当前线索暂无触达记录"
              />
            </Card>
          </div>

          <div class="radar-detail-side-column">
            <Card class="radar-detail-info-card" title="企业信息">
              <Descriptions
                class="radar-detail-descriptions"
                :column="1"
                bordered
                size="small"
              >
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

            <Card class="radar-detail-info-card" title="最近采集任务">
              <Descriptions
                class="radar-detail-descriptions"
                :column="1"
                bordered
                size="small"
              >
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

            <OutreachSuggestionPanel
              :lead-id="leadId"
              visible
              @task-created="loadDetail"
            />
          </div>
        </div>
      </template>

      <Empty v-else description="未找到对应线索" />
    </div>
  </Page>
</template>

<style scoped>
.radar-detail-mobile {
  min-height: 100%;
  padding: 12px 12px calc(var(--app-safe-area-bottom) + 24px);
  overflow-y: auto;
  background: #f6f7f9;
}

.dark .radar-detail-mobile {
  background: #111315;
}

.radar-mobile-topbar,
.radar-mobile-hero-head,
.radar-mobile-section-head,
.radar-mobile-mini-head,
.radar-mobile-bottom-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.radar-mobile-topbar {
  margin-bottom: 12px;
}

.radar-mobile-hero,
.radar-mobile-section,
.radar-mobile-mini-card {
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgb(15 23 42 / 6%);
}

.radar-mobile-hero {
  padding: 14px;
  margin-bottom: 12px;
}

.radar-mobile-hero-title {
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.radar-mobile-hero-subtitle,
.radar-mobile-mini-meta,
.radar-mobile-card-meta,
.radar-mobile-tag-row {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-hero-subtitle {
  margin-top: 3px;
}

.radar-mobile-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
}

.radar-mobile-close-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.radar-mobile-score-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.radar-mobile-score-card {
  border: 1px solid var(--ant-color-border-secondary);
}

.radar-mobile-score-card :deep(.ant-card-body) {
  padding: 10px 4px;
  text-align: center;
}

.radar-mobile-score-card :deep(.ant-statistic-title) {
  margin-bottom: 2px;
  font-size: 11px;
  line-height: 16px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-score-card :deep(.ant-statistic-content) {
  font-size: 18px;
  line-height: 24px;
  color: var(--ant-color-text);
}

.radar-mobile-section {
  padding: 14px;
  margin-bottom: 12px;
}

.radar-mobile-section-head {
  margin-bottom: 10px;
}

.radar-mobile-section-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ant-color-text);
}

.radar-mobile-section-head span {
  font-size: 12px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-info-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.radar-mobile-info-list > div {
  min-width: 0;
}

.radar-mobile-info-list span {
  display: block;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-info-list strong {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.radar-mobile-info-wide {
  grid-column: 1 / -1;
}

.radar-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-mini-card {
  padding: 12px;
}

.radar-mobile-mini-card strong {
  color: var(--ant-color-text);
}

.radar-mobile-mini-card p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
}

.radar-mobile-card-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 10px;
}

.radar-mobile-bottom-actions {
  position: sticky;
  bottom: 0;
  padding-top: 8px;
  padding-bottom: var(--app-safe-area-bottom);
  background: linear-gradient(to top, #f6f7f9 74%, rgb(246 247 249 / 0%));
}

.dark .radar-mobile-bottom-actions {
  background: linear-gradient(to top, #111315 74%, rgb(17 19 21 / 0%));
}

.radar-detail-desktop-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, 1fr);
  gap: 16px;
  align-items: start;
}

.radar-detail-main-column,
.radar-detail-side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.radar-detail-list-card :deep(.ant-card-body) {
  padding: 12px 18px 16px;
}

.radar-detail-info-card :deep(.ant-card-body) {
  padding: 14px 18px 16px;
}

.radar-detail-descriptions :deep(.ant-descriptions-view) {
  overflow: hidden;
  border-radius: 8px;
}

.radar-detail-descriptions :deep(.ant-descriptions-item-label) {
  width: 126px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  background: var(--ant-color-fill-quaternary);
}

.radar-detail-descriptions :deep(.ant-descriptions-item-content) {
  min-width: 0;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.radar-detail-table :deep(.ant-table) {
  border-radius: 8px;
}

.radar-detail-table :deep(.ant-table-thead > tr > th) {
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

.radar-detail-table :deep(.ant-table-tbody > tr > td) {
  padding: 9px 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

.radar-detail-table :deep(.ant-table-tbody > tr > td:empty)::before {
  color: var(--ant-color-text-tertiary);
  content: '-';
}

.radar-owner-select {
  width: 220px;
  max-width: 100%;
}

.radar-owner-select-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.radar-detail-empty {
  padding: 22px 0;
}

.radar-detail-loading {
  padding: 8px 0;
}

@media (max-width: 1199px) {
  .radar-detail-desktop-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
