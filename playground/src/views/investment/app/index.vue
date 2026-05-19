<script lang="ts" setup>
import type { Component } from 'vue';

import type { InvestmentAgent } from '../agent/data';
import type { RadarLead } from '../radar/data';

import type {
  PublicOpportunityItem,
  RadarOutreachTaskListItem,
  RadarOutreachTaskSummary,
} from '#/api/investment';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { formatDateTime } from '@vben/utils';

import {
  AppstoreOutlined,
  CalendarOutlined,
  HomeOutlined,
  PhoneOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Empty,
  Spin,
  Statistic,
  Tag,
} from 'ant-design-vue';

import {
  getEffectivePublicOpportunityList,
  getInvestmentList,
  getRadarLeadList,
  getRadarOutreachTaskList,
} from '#/api/investment';

import {
  formatArea,
  formatDateOnly,
  getOpportunityTypeMeta,
  getPriorityColor,
  getStageLabel,
  getTaskStatusMeta,
  mapChannel,
  mapTaskType,
} from '../radar/mobile-utils';

defineOptions({ name: 'InvestmentAppWorkbench' });

interface ListResponse<T> {
  items?: T[];
  page?: {
    total?: number;
  };
  total?: number;
}

interface QuickAction {
  description: string;
  icon: Component;
  label: string;
  route: string;
  tone: 'blue' | 'cyan' | 'green' | 'orange' | 'purple';
}

interface ManagementAction {
  description: string;
  icon: Component;
  label: string;
  route: string;
  tone: 'blue' | 'cyan' | 'green' | 'orange' | 'purple';
}

interface OverviewCard {
  hint: string;
  label: string;
  route: string;
  suffix: string;
  tone: 'blue' | 'cyan' | 'green' | 'orange';
  value: number;
}

const router = useRouter();
const loading = ref(false);
const sectionErrors = ref<string[]>([]);
const todayMeetingTotal = ref(0);
const recentMeetingTotal = ref(0);
const highPriorityTotal = ref(0);
const visitCandidateTotal = ref(0);
const opportunityTotal = ref(0);
const meetingItems = ref<InvestmentAgent[]>([]);
const leadItems = ref<RadarLead[]>([]);
const taskItems = ref<RadarOutreachTaskListItem[]>([]);
const opportunityItems = ref<PublicOpportunityItem[]>([]);
const taskSummary = ref<RadarOutreachTaskSummary>(createEmptyTaskSummary());

const pageDateText = new Intl.DateTimeFormat('zh-CN', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
}).format(new Date());

const quickActions: QuickAction[] = [
  {
    description: '登记客户和会谈',
    icon: UserAddOutlined,
    label: '招商记录',
    route: '/investment/mobile',
    tone: 'orange',
  },
  {
    description: '查看 A/B 级线索',
    icon: RadarChartOutlined,
    label: '智能雷达',
    route: '/investment/radar/mobile',
    tone: 'blue',
  },
  {
    description: '统计线索、触达和公开机会',
    icon: CalendarOutlined,
    label: '招商看板',
    route: '/investment/radar/mobile-dashboard',
    tone: 'green',
  },
  {
    description: '执行电话/短信任务',
    icon: ThunderboltOutlined,
    label: '触达任务',
    route: '/investment/radar/mobile-tasks',
    tone: 'purple',
  },
  {
    description: '企业选址和扩产需求',
    icon: AppstoreOutlined,
    label: '公开需求',
    route: '/investment/radar/mobile-public-demands',
    tone: 'cyan',
  },
  {
    description: '厂房/仓库/办公供给',
    icon: HomeOutlined,
    label: '公开房源',
    route: '/investment/radar/mobile-factory-listings',
    tone: 'green',
  },
];

const managementActions: ManagementAction[] = [
  {
    description: '复核公开来源线索并转雷达潜客',
    icon: RadarChartOutlined,
    label: '外部线索',
    route: '/investment/radar/mobile-external-leads',
    tone: 'blue',
  },
  {
    description: '复核扩产、搬迁和租厂信号',
    icon: ThunderboltOutlined,
    label: '企业信号',
    route: '/investment/radar/mobile-signal-events',
    tone: 'orange',
  },
  {
    description: '查看企业画像、标签和关联信号',
    icon: AppstoreOutlined,
    label: '企业画像',
    route: '/investment/radar/mobile-enterprise-profiles',
    tone: 'green',
  },
  {
    description: '维护评分规则并重算 demo 线索评分',
    icon: SettingOutlined,
    label: '评分规则',
    route: '/investment/radar/mobile-score-rules',
    tone: 'purple',
  },
  {
    description: '查看采集源状态、启停数据源和运行采集',
    icon: SettingOutlined,
    label: '数据源',
    route: '/investment/radar/mobile-crawler-sources',
    tone: 'cyan',
  },
  {
    description: '查看采集队列、日志和失败 URL 重试',
    icon: CalendarOutlined,
    label: '采集任务',
    route: '/investment/radar/mobile-crawler-tasks',
    tone: 'blue',
  },
];

const overviewCards = computed<OverviewCard[]>(() => [
  {
    hint:
      meetingItems.value.length > 0
        ? `列表展示 ${meetingItems.value.length} 条`
        : '暂无今日安排',
    label: '今日会谈',
    route: '/investment/mobile',
    suffix: '场',
    tone: 'orange',
    value: todayMeetingTotal.value,
  },
  {
    hint: 'A/B 级重点客户',
    label: '重点线索',
    route: '/investment/radar/mobile',
    suffix: '条',
    tone: 'blue',
    value: highPriorityTotal.value,
  },
  {
    hint: '已回复可推进',
    label: '待安排带看',
    route: '/investment/radar/mobile',
    suffix: '条',
    tone: 'green',
    value: visitCandidateTotal.value,
  },
  {
    hint: `待执行 ${taskSummary.value.pendingTasks}`,
    label: '触达任务',
    route: '/investment/radar/mobile-tasks',
    suffix: '项',
    tone: 'cyan',
    value: taskSummary.value.totalTasks,
  },
]);

const partialErrorText = computed(() => {
  if (sectionErrors.value.length === 0) {
    return '';
  }
  return `${sectionErrors.value.join('、')}加载失败，其余数据已展示。`;
});

const meetingSectionTitle = computed(() =>
  todayMeetingTotal.value > 0 ? '今日会谈' : '近期会谈',
);

const meetingSectionHint = computed(() =>
  todayMeetingTotal.value > 0
    ? '今天需要推进的客户沟通'
    : `暂无今日会谈，显示最近 ${recentMeetingTotal.value} 条记录`,
);

function createEmptyTaskSummary(): RadarOutreachTaskSummary {
  return {
    callTasks: 0,
    failedTasks: 0,
    pendingTasks: 0,
    positiveReplies: 0,
    repliedTasks: 0,
    sentTasks: 0,
    smsTasks: 0,
    totalTasks: 0,
  };
}

function getListItems<T>(result?: ListResponse<T>) {
  return Array.isArray(result?.items) ? result.items : [];
}

function getListTotal<T>(result?: ListResponse<T>) {
  return Number(
    result?.total ?? result?.page?.total ?? result?.items?.length ?? 0,
  );
}

function unwrapSettled<T>(
  result: PromiseSettledResult<T>,
  label: string,
  errors: string[],
) {
  if (result.status === 'fulfilled') {
    return result.value;
  }
  console.error(`${label}加载失败:`, result.reason);
  errors.push(label);
  return undefined;
}

function padDateNumber(value: number) {
  return String(value).padStart(2, '0');
}

function toDateTimeParam(date: Date) {
  const year = date.getFullYear();
  const month = padDateNumber(date.getMonth() + 1);
  const day = padDateNumber(date.getDate());
  const hour = padDateNumber(date.getHours());
  const minute = padDateNumber(date.getMinutes());
  const second = padDateNumber(date.getSeconds());
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return {
    endTime: toDateTimeParam(end),
    startTime: toDateTimeParam(start),
  };
}

function formatNumber(value?: null | number) {
  if (value === null || value === undefined) {
    return '-';
  }
  return Number(value).toLocaleString('zh-CN');
}

function formatMeetingTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function formatLeadArea(value?: null | number) {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${formatNumber(value)} ㎡`;
}

function formatSignalTime(value?: null | string) {
  return value ? formatDateOnly(value) : '-';
}

function getIntentColor(level?: null | string) {
  if (level === '很高') {
    return 'red';
  }
  if (level === '高') {
    return 'orange';
  }
  if (level === '一般') {
    return 'blue';
  }
  if (level === '低') {
    return 'green';
  }
  return 'default';
}

function getOpportunityRoute(type?: null | string) {
  return type === 'SUPPLY'
    ? '/investment/radar/mobile-factory-listings'
    : '/investment/radar/mobile-public-demands';
}

function getFollowHint(lead: RadarLead) {
  if (!lead.latestContactTime) {
    return '暂无跟进记录';
  }

  const latestTime = new Date(lead.latestContactTime).getTime();
  if (Number.isNaN(latestTime)) {
    return '跟进时间未知';
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(0, Math.floor((Date.now() - latestTime) / dayMs));
  if (days === 0) {
    return '今日已跟进';
  }
  return `${days} 天前跟进`;
}

function mergePriorityLeads(aLeads: RadarLead[], bLeads: RadarLead[]) {
  const visited = new Set<number>();
  return [...aLeads, ...bLeads]
    .filter((item) => {
      if (visited.has(item.leadId)) {
        return false;
      }
      visited.add(item.leadId);
      return true;
    })
    .sort((a, b) => Number(b.totalScore || 0) - Number(a.totalScore || 0))
    .slice(0, 6);
}

function resolveMeetingItems(
  todayResult?: ListResponse<InvestmentAgent>,
  recentResult?: ListResponse<InvestmentAgent>,
) {
  const todayItems = getListItems(todayResult);
  if (todayItems.length > 0) {
    return todayItems.slice(0, 4);
  }
  return getListItems(recentResult).slice(0, 4);
}

function goTo(route: string) {
  router.push(route);
}

function goToLeadDetail(leadId: number) {
  router.push(`/investment/radar/mobile/${leadId}`);
}

async function loadWorkbench() {
  loading.value = true;
  const errors: string[] = [];
  const todayRange = getTodayRange();

  const [
    todayMeetingResult,
    recentMeetingResult,
    aLeadResult,
    bLeadResult,
    visitCandidateResult,
    taskResult,
    opportunityResult,
  ] = await Promise.allSettled([
    getInvestmentList({
      currentPage: 1,
      currentPark: -1,
      endTime: todayRange.endTime,
      pageSize: 4,
      startTime: todayRange.startTime,
    }) as Promise<ListResponse<InvestmentAgent>>,
    getInvestmentList({
      currentPage: 1,
      currentPark: -1,
      pageSize: 4,
    }) as Promise<ListResponse<InvestmentAgent>>,
    getRadarLeadList({
      currentPage: 1,
      pageSize: 4,
      priorityLevel: 'A',
    }),
    getRadarLeadList({
      currentPage: 1,
      pageSize: 4,
      priorityLevel: 'B',
    }),
    getRadarLeadList({
      currentPage: 1,
      pageSize: 1,
      stage: 'REPLIED',
    }),
    getRadarOutreachTaskList({
      currentPage: 1,
      pageSize: 5,
    }),
    getEffectivePublicOpportunityList({
      currentPage: 1,
      pageSize: 4,
    }),
  ]);

  const todayMeetingData = unwrapSettled(
    todayMeetingResult,
    '今日会谈',
    errors,
  );
  const recentMeetingData = unwrapSettled(
    recentMeetingResult,
    '近期会谈',
    errors,
  );
  const aLeadData = unwrapSettled(aLeadResult, 'A 级线索', errors);
  const bLeadData = unwrapSettled(bLeadResult, 'B 级线索', errors);
  const visitCandidateData = unwrapSettled(
    visitCandidateResult,
    '待带看线索',
    errors,
  );
  const taskData = unwrapSettled(taskResult, '触达任务', errors);
  const opportunityData = unwrapSettled(opportunityResult, '公开机会', errors);

  todayMeetingTotal.value = getListTotal(todayMeetingData);
  recentMeetingTotal.value = getListTotal(recentMeetingData);
  meetingItems.value = resolveMeetingItems(todayMeetingData, recentMeetingData);

  highPriorityTotal.value = getListTotal(aLeadData) + getListTotal(bLeadData);
  visitCandidateTotal.value = getListTotal(visitCandidateData);
  leadItems.value = mergePriorityLeads(
    getListItems(aLeadData),
    getListItems(bLeadData),
  );

  taskItems.value = getListItems(taskData);
  taskSummary.value = taskData?.summary || createEmptyTaskSummary();

  opportunityItems.value = getListItems(opportunityData);
  opportunityTotal.value = getListTotal(opportunityData);
  sectionErrors.value = errors;
  loading.value = false;
}

onMounted(() => {
  void loadWorkbench();
});
</script>

<template>
  <div class="investment-app-page">
    <div class="workbench-toolbar">
      <span>{{ pageDateText }}</span>
      <Button
        class="refresh-button"
        size="small"
        type="text"
        :loading="loading"
        @click="loadWorkbench"
      >
        <template #icon>
          <ReloadOutlined />
        </template>
        刷新
      </Button>
    </div>

    <Alert
      v-if="partialErrorText"
      class="workbench-alert"
      type="warning"
      show-icon
      :message="partialErrorText"
    />

    <Spin :spinning="loading">
      <section class="overview-grid" aria-label="招商关键统计">
        <Card
          v-for="card in overviewCards"
          :key="card.label"
          class="overview-card"
          :class="`overview-card-${card.tone}`"
          hoverable
          role="button"
          tabindex="0"
          @click="goTo(card.route)"
          @keydown.enter="goTo(card.route)"
          @keydown.space.prevent="goTo(card.route)"
        >
          <Statistic
            :suffix="card.suffix"
            :title="card.label"
            :value="card.value"
          />
          <span class="overview-hint">{{ card.hint }}</span>
        </Card>
      </section>

      <section class="section-panel">
        <div class="section-heading">
          <div>
            <h2>快捷入口</h2>
          </div>
        </div>
        <div class="quick-grid">
          <button
            v-for="action in quickActions"
            :key="action.route"
            type="button"
            class="quick-action"
            :class="`quick-action-${action.tone}`"
            :aria-label="`${action.label}：${action.description}`"
            :title="action.description"
            @click="goTo(action.route)"
          >
            <span class="quick-icon">
              <component :is="action.icon" />
            </span>
            <strong>{{ action.label }}</strong>
          </button>
        </div>
      </section>

      <section class="section-panel">
        <div class="section-heading">
          <div>
            <h2>雷达管理</h2>
          </div>
        </div>
        <div class="management-grid">
          <button
            v-for="action in managementActions"
            :key="action.route"
            type="button"
            class="management-action"
            :class="`quick-action-${action.tone}`"
            :aria-label="`${action.label}：${action.description}`"
            :title="action.description"
            @click="goTo(action.route)"
          >
            <span class="quick-icon">
              <component :is="action.icon" />
            </span>
            <strong>{{ action.label }}</strong>
          </button>
        </div>
      </section>

      <section class="section-panel">
        <div class="section-heading">
          <div>
            <h2>重点线索</h2>
            <p>A/B 级客户优先跟进，卡片点击进入潜客详情。</p>
          </div>
          <Button
            size="small"
            type="link"
            @click="goTo('/investment/radar/mobile')"
          >
            全部
          </Button>
        </div>

        <div v-if="leadItems.length > 0" class="lead-list">
          <article
            v-for="lead in leadItems"
            :key="lead.leadId"
            class="lead-card"
            @click="goToLeadDetail(lead.leadId)"
          >
            <div class="card-title-row">
              <h3>{{ lead.enterpriseName }}</h3>
              <Tag :color="getPriorityColor(lead.priorityLevel)">
                {{ lead.priorityLevel }} 级
              </Tag>
            </div>
            <div class="lead-meta">
              <span>总分 {{ lead.totalScore }}</span>
              <span>{{ getStageLabel(lead.stage) }}</span>
              <span>{{ lead.parkName || '未分配园区' }}</span>
            </div>
            <div class="info-grid">
              <div>
                <span>意向面积</span>
                <strong>{{ formatLeadArea(lead.intentArea) }}</strong>
              </div>
              <div>
                <span>最近信号</span>
                <strong>{{ lead.latestSignalType || '-' }}</strong>
              </div>
            </div>
            <div class="card-foot">
              <span>{{ getFollowHint(lead) }}</span>
              <a
                v-if="lead.phoneNumber"
                :href="`tel:${lead.phoneNumber}`"
                class="phone-link"
                @click.stop
              >
                <PhoneOutlined />
                {{ lead.phoneNumber }}
              </a>
            </div>
          </article>
        </div>
        <Empty v-else class="empty-block" description="暂无 A/B 级重点线索" />
      </section>

      <section class="section-panel">
        <div class="section-heading">
          <div>
            <h2>{{ meetingSectionTitle }}</h2>
            <p>{{ meetingSectionHint }}</p>
          </div>
          <Button size="small" type="link" @click="goTo('/investment/mobile')">
            记录
          </Button>
        </div>

        <div v-if="meetingItems.length > 0" class="meeting-list">
          <article
            v-for="item in meetingItems"
            :key="`${item.investmentId || item.tenantName}-${item.meetingTime}`"
            class="meeting-card"
          >
            <div class="meeting-time">
              <CalendarOutlined />
              {{ formatMeetingTime(item.meetingTime) }}
            </div>
            <div class="card-title-row">
              <h3>{{ item.tenantName || item.agentName }}</h3>
              <Tag :color="getIntentColor(item.intentLevel)">
                {{ item.intentLevel || '未评级' }}
              </Tag>
            </div>
            <div class="meeting-detail">
              <span>{{ item.agentName || '未填写联系人' }}</span>
              <span>{{ item.progress || '暂无进展' }}</span>
              <span>{{ item.parkName || '未关联园区' }}</span>
            </div>
            <p v-if="item.remark" class="meeting-remark">{{ item.remark }}</p>
          </article>
        </div>
        <Empty v-else class="empty-block" description="暂无会谈记录" />
      </section>

      <section class="section-panel">
        <div class="section-heading">
          <div>
            <h2>触达任务</h2>
            <p>优先处理待执行任务和有回复的客户。</p>
          </div>
          <Button
            size="small"
            type="link"
            @click="goTo('/investment/radar/mobile-tasks')"
          >
            任务
          </Button>
        </div>

        <div class="task-summary">
          <Card class="task-summary-card" size="small">
            <Statistic title="待执行" :value="taskSummary.pendingTasks" />
          </Card>
          <Card class="task-summary-card" size="small">
            <Statistic title="已发送" :value="taskSummary.sentTasks" />
          </Card>
          <Card class="task-summary-card" size="small">
            <Statistic title="正向回复" :value="taskSummary.positiveReplies" />
          </Card>
        </div>

        <div v-if="taskItems.length > 0" class="task-list">
          <article
            v-for="task in taskItems"
            :key="task.taskId"
            class="task-card"
            @click="goToLeadDetail(task.leadId)"
          >
            <div class="card-title-row">
              <h3>{{ task.enterpriseName }}</h3>
              <Tag :color="getTaskStatusMeta(task.status).color">
                {{ getTaskStatusMeta(task.status).label }}
              </Tag>
            </div>
            <div class="task-meta">
              <span>{{ mapTaskType(task.taskType) }}</span>
              <span>{{ mapChannel(task.channel) }}</span>
              <span>{{
                task.contactName || task.phoneNumber || '未填写对象'
              }}</span>
            </div>
            <div class="card-foot">
              <span>
                计划 {{ formatMeetingTime(task.scheduledAt || task.sentAt) }}
              </span>
              <span>{{ getStageLabel(task.stage) }}</span>
            </div>
          </article>
        </div>
        <Empty v-else class="empty-block" description="暂无触达任务" />
      </section>

      <section class="section-panel">
        <div class="section-heading">
          <div>
            <h2>公开机会</h2>
            <p>共 {{ opportunityTotal }} 条有效需求和房源供给。</p>
          </div>
          <Button
            size="small"
            type="link"
            @click="goTo('/investment/radar/mobile-public-demands')"
          >
            需求
          </Button>
        </div>

        <div v-if="opportunityItems.length > 0" class="opportunity-list">
          <article
            v-for="item in opportunityItems"
            :key="item.opportunityId"
            class="opportunity-card"
            @click="goTo(getOpportunityRoute(item.opportunityType))"
          >
            <div class="card-title-row">
              <h3>{{ item.title || '未命名机会' }}</h3>
              <Tag :color="getOpportunityTypeMeta(item.opportunityType).color">
                {{ getOpportunityTypeMeta(item.opportunityType).label }}
              </Tag>
            </div>
            <div class="opportunity-meta">
              <span>{{
                [item.city, item.district].filter(Boolean).join(' / ') || '-'
              }}</span>
              <span>{{ item.sourceSite || '-' }}</span>
              <span>{{ formatSignalTime(item.publishedAt) }}</span>
            </div>
            <div class="info-grid">
              <div>
                <span>面积</span>
                <strong>{{ formatArea(item) }}</strong>
              </div>
              <div>
                <span>预算/租金</span>
                <strong>{{ item.priceText || '-' }}</strong>
              </div>
            </div>
          </article>
        </div>
        <Empty v-else class="empty-block" description="暂无公开机会" />
      </section>
    </Spin>
  </div>
</template>

<style scoped>
.investment-app-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 10px 12px calc(72px + env(safe-area-inset-bottom));
  color: #111827;
  background: #f3f6fb;
}

.workbench-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #64748b;
}

.refresh-button {
  flex: 0 0 auto;
  height: 28px;
  padding: 0 8px;
  color: #2563eb;
}

.workbench-alert {
  margin-bottom: 12px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.overview-card {
  min-width: 0;
  cursor: pointer;
  box-shadow: 0 8px 20px rgb(15 23 42 / 6%);
}

.overview-card :deep(.ant-card-body) {
  padding: 14px;
}

.overview-card :deep(.ant-statistic-title),
.overview-hint {
  display: block;
  overflow: hidden;
  font-size: 12px;
  color: #64748b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-card :deep(.ant-statistic-title) {
  margin-bottom: 8px;
}

.overview-card :deep(.ant-statistic-content) {
  font-size: 26px;
  font-weight: 760;
  line-height: 1;
  color: #111827;
}

.overview-card :deep(.ant-statistic-content-suffix) {
  margin-inline-start: 2px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.overview-hint {
  margin-top: 6px;
}

.overview-card-orange {
  border-left: 4px solid #f97316;
}

.overview-card-blue {
  border-left: 4px solid #2563eb;
}

.overview-card-green {
  border-left: 4px solid #16a34a;
}

.overview-card-cyan {
  border-left: 4px solid #0891b2;
}

.section-panel {
  padding: 14px;
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid rgb(148 163 184 / 24%);
  border-radius: 10px;
  box-shadow: 0 8px 20px rgb(15 23 42 / 5%);
}

.section-heading {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
}

.section-heading p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.quick-grid,
.management-grid,
.lead-list,
.meeting-list,
.task-list,
.opportunity-list {
  display: grid;
  gap: 10px;
}

.quick-grid,
.management-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.quick-action,
.management-action {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  min-width: 0;
  min-height: 84px;
  padding: 10px 6px;
  text-align: center;
  cursor: pointer;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  border: 1px solid rgb(148 163 184 / 24%);
  border-radius: 10px;
  box-shadow: 0 8px 18px rgb(15 23 42 / 7%);
}

.quick-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  font-size: 18px;
  border-radius: 10px;
}

.quick-action .quick-icon,
.management-action .quick-icon {
  margin: 0 auto;
}

.quick-action-orange .quick-icon {
  color: #ea580c;
  background: #ffedd5;
}

.quick-action-blue .quick-icon {
  color: #2563eb;
  background: #dbeafe;
}

.quick-action-purple .quick-icon {
  color: #7c3aed;
  background: #ede9fe;
}

.quick-action-cyan .quick-icon {
  color: #0891b2;
  background: #cffafe;
}

.quick-action-green .quick-icon {
  color: #16a34a;
  background: #dcfce7;
}

.quick-action strong,
.management-action strong {
  display: block;
  overflow: hidden;
  font-size: 12px;
  font-weight: 650;
  line-height: 16px;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-card,
.meeting-card,
.task-card,
.opportunity-card {
  min-width: 0;
  padding: 13px;
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 9px;
}

.meeting-card {
  cursor: default;
}

.card-title-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.card-title-row h3 {
  display: -webkit-box;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  color: #111827;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
  white-space: normal;
  -webkit-box-orient: vertical;
}

.lead-meta,
.meeting-detail,
.task-meta,
.opportunity-meta,
.card-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  margin-top: 9px;
  font-size: 12px;
  color: #64748b;
}

.lead-meta span,
.meeting-detail span,
.task-meta span,
.opportunity-meta span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.info-grid div {
  min-width: 0;
  padding: 9px;
  background: #fff;
  border-radius: 8px;
}

.info-grid span,
.info-grid strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-grid span {
  margin-bottom: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.info-grid strong {
  font-size: 13px;
  font-weight: 650;
  color: #1f2937;
}

.card-foot {
  justify-content: space-between;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid rgb(148 163 184 / 22%);
}

.phone-link {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: #2563eb;
}

.meeting-time {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: #ea580c;
}

.meeting-remark {
  display: -webkit-box;
  margin: 10px 0 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.55;
  color: #475569;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.task-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 10px;
}

.task-summary-card :deep(.ant-card-body) {
  padding: 9px 10px;
}

.task-summary-card :deep(.ant-statistic-title) {
  margin-bottom: 4px;
  font-size: 12px;
  line-height: 18px;
  color: #64748b;
}

.task-summary-card :deep(.ant-statistic-content) {
  font-size: 20px;
  line-height: 26px;
  color: #111827;
}

.empty-block {
  padding: 18px 0;
}

@media (min-width: 520px) {
  .investment-app-page {
    max-width: 520px;
    margin: 0 auto;
  }

  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

:global(.dark) .investment-app-page {
  color: #e5e7eb;
  background: #111827;
}

:global(.dark) .overview-card,
:global(.dark) .section-panel {
  background: #1f2937;
  border-color: rgb(71 85 105 / 70%);
}

:global(.dark) .quick-action,
:global(.dark) .lead-card,
:global(.dark) .meeting-card,
:global(.dark) .task-card,
:global(.dark) .opportunity-card {
  background: #111827;
  border-color: rgb(71 85 105 / 70%);
}

:global(.dark) .card-title-row h3,
:global(.dark) .overview-card .ant-statistic-content,
:global(.dark) .quick-content strong,
:global(.dark) .info-grid strong {
  color: #f8fafc;
}

:global(.dark) .info-grid div {
  background: #1f2937;
}

:global(.dark) .task-summary-card .ant-statistic-content {
  color: #f8fafc;
}
</style>
